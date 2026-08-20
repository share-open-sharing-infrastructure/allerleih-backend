/// <reference path="../../pb_data/types.d.ts" />

/**
 * Weekly Digest job body (extracted from digest.pb.js — mirrors the jobs/retention.js split so
 * the job logic is unit-reachable via the POST /api/_test/run-digest test route, since cron
 * schedules can't be fired on demand).
 *
 * Sections:
 * 1. Items from the user's trusted people (owner.trusts contains the user)
 * 2. Items from the user's groups
 * 3. All other new public items (trusteesOnly=false, no groups)
 *
 * Respects BOTH user_preferences.emailNotifications (the master switch — opted out of ALL mail)
 * and user_preferences.digestEmails (digest-only opt-out, e.g. via the one-click unsubscribe
 * link — see services/unsubscribe.js). Either false skips the digest; a missing prefs row means
 * opted in to both (see the #607 digestEmails migration's backfill + applyUnsubscribe's B2
 * hardening). Skipped entirely in DRY_MODE.
 *
 * #607: sends with kind: 'bulk' (Precedence: bulk, optional DIGEST_SENDER_* identity), a
 * per-recipient one-click unsubscribe link, one shared mail client for the whole run, and
 * sleep()-based pacing between sends (DIGEST_PACING_MS) plus a longer pause every
 * DIGEST_BATCH_SIZE sends (DIGEST_BATCH_PAUSE_MS) — a courtesy to the receiving mail server on a
 * large run, not a hard rate limit.
 *
 * #607 review follow-up: `fetchDigestInputs()` (user/opt-out/group-membership gathering) and
 * `categorizeItemsForUser()` (the trusted/group/public visibility split — the single most
 * security-sensitive piece of this file, since it decides who sees which item) are extracted as
 * their own named, independently unit-testable functions (see tests/digest-internals.test.mjs) —
 * this is a pure refactor, the semantics are unchanged. `renderItemList()` no longer takes the
 * PocketBase `app` directly; the caller resolves `assetBase(app)`/`siteBase(app)` exactly ONCE per
 * run and passes the two strings down, instead of every one of the up-to-5 call sites per
 * recipient recomputing them.
 */

const { sendNotificationEmail, renderMailBody, KIND_BULK } = require(`${__hooks}/services/mail.js`)
const { unsubscribeUrl } = require(`${__hooks}/services/unsubscribe.js`)
const { assetBase, siteBase } = require(`${__hooks}/utils/urls.js`)
const { DIGEST_PACING_MS, DIGEST_BATCH_SIZE, DIGEST_BATCH_PAUSE_MS } = require(`${__hooks}/constants.js`)

const PAGE = 200

function escapeHtml(str) {
    if (!str) return ''
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

/**
 * Render up to `max` items as an HTML list. `asset`/`site` are the already-resolved
 * assetBase(app)/siteBase(app) strings (see runWeeklyDigest — resolved once per run, not once per
 * call) — this function itself no longer touches PocketBase at all, which also makes it directly
 * callable from a plain-Node test (tests/digest-internals.test.mjs) without any `app`/hook stubs.
 */
function renderItemList(asset, site, items, max, ownerNames, allowUploadedImages) {
    if (!items || items.length === 0) return ''

    const limit = max || 5
    const visible = items.slice(0, limit)

    let html = ''
    for (const item of visible) {
        const name = item.get('name') || 'Unbenannter Gegenstand'
        const categories = item.get('categories') || []
        const categoryStr = Array.isArray(categories) && categories.length > 0 ? categories.join(', ') : ''
        // #607 B1: item links are FRONTEND pages, never the backend origin.
        const itemUrl = site + '/items/' + item.id
        const ownerId = item.get('owner')
        const ownerName = ownerNames[ownerId] || ''

        // Resolve image URL:
        // - Files are served via the `items_searchable` view, NOT `items_public` — the latter's
        //   `image` column is a masking CASE expression (1781900049_items_public_mask_grouped.js)
        //   that PocketBase types as `json`, so it never serves a file at all (404, #622).
        // - PocketBase's file-serving endpoint enforces only the field's `protected` flag (false
        //   here), NOT the collection's viewRule — so this URL works for an unauthenticated mail
        //   client, with no token and no expiry, exactly as a mail image needs to.
        // - `allowUploadedImages` (computed by the caller) is therefore the ONLY barrier: it is
        //   true only for genuinely public items (trusteesOnly = false, no groups — the auth-free
        //   first branch of the items_searchable view rule), so trustees-only/group items always
        //   fall through to externalImgUrl instead, never an uploaded-file URL.
        // - `?thumb=0x300` is whitelisted in pb_migrations/1784402877_image_thumbs.js and matches
        //   the frontend's own request shape ($lib/utils/utils.ts#itemImageUrl in share-mvp).
        // - externalImgUrl is always accessible (external host, no auth) regardless of visibility.
        let imgUrl = ''
        const imageFiles = item.get('image') || []
        const images = Array.isArray(imageFiles) ? imageFiles : [imageFiles]
        const externalImg = item.get('externalImgUrl')
        if (allowUploadedImages && images.length > 0 && images[0]) {
            imgUrl = asset + '/api/files/items_searchable/' + item.id + '/' + images[0] + '?thumb=0x300'
        } else if (externalImg) {
            imgUrl = externalImg
        }

        html +=
            '<table cellpadding="0" cellspacing="0" border="0" width="100%" role="presentation" style="margin-bottom: 12px; border-bottom: 1px solid #EBE6D9; padding-bottom: 12px;"><tr>'
        if (imgUrl) {
            html += '<td width="64" style="vertical-align: top; padding-right: 12px;">'
            html +=
                '<a href="' +
                itemUrl +
                '"><img src="' +
                // #622: escape — the items_searchable branch above is a PocketBase-sanitised
                // filename, but externalImgUrl comes from the CSV import / partner integrations
                // (integrations/leihbackend.js, winbiap.js) and may contain a `"` that would
                // otherwise break out of the attribute and inject markup into every recipient's digest.
                escapeHtml(imgUrl) +
                '" width="64" height="64" style="width: 64px; height: 64px; object-fit: cover; border-radius: 8px; display: block;" alt="' +
                escapeHtml(name) +
                '"></a>'
            html += '</td>'
        }
        html += '<td style="vertical-align: top;">'
        html +=
            '<a href="' +
            itemUrl +
            '" style="color: #1F1F1F; text-decoration: none; font-weight: 600; font-size: 15px; display: block; margin-bottom: 2px;">' +
            escapeHtml(name) +
            // #607 B1: unconditional break after the name — without it, an item with NEITHER an
            // owner NOR a category glues the name link straight onto the "Ansehen" link below
            // (the owner/category <br>s that follow are each conditional on that field existing).
            '</a><br>'
        if (ownerName) {
            html += '<span style="color: #6B6B6B; font-size: 13px;">von ' + escapeHtml(ownerName) + '</span><br>'
        }
        if (categoryStr) {
            html += '<span style="color: #6B6B6B; font-size: 13px;">' + escapeHtml(categoryStr) + '</span><br>'
        }
        html +=
            '<a href="' +
            itemUrl +
            '" style="color: #5B6EC7; font-size: 13px; text-decoration: underline;" aria-label="' +
            escapeHtml(name) +
            ' ansehen">Ansehen &rarr;</a>'
        html += '</td>'
        html += '</tr></table>'
    }

    if (items.length > limit) {
        html +=
            '<p style="color: #6B6B6B; font-size: 13px; margin-top: 4px;">+ ' +
            (items.length - limit) +
            ' weitere neue Gegenst&auml;nde</p>'
    }

    return html
}

/** Page through every record matching `filter` and return them all as an array. */
function findAllPaged(app, collection, filter, sort, params) {
    const all = []
    let offset = 0
    for (;;) {
        const batch = app.findRecordsByFilter(collection, filter, sort || '', PAGE, offset, params || {})
        for (const rec of batch) all.push(rec)
        if (batch.length < PAGE) break
        offset += PAGE
    }
    return all
}

/**
 * Gather everything runWeeklyDigest needs about the current user population: the recipient list,
 * a per-user username map (for "von <Name>" bylines), the two independent opt-out sets (the
 * `emailNotifications` master switch vs. the digest-only `digestEmails`), and each user's group
 * memberships. `newItems` is threaded through unchanged so the returned object is the complete,
 * self-contained bundle the per-recipient loop needs.
 *
 * The `users` fetch is allowed to throw — the caller aborts the whole run on that failure exactly
 * as before this extraction. The opt-out and group-membership queries are best-effort: a failure
 * there defaults to "nobody opted out" / "no memberships", same as the original inline code (an
 * empty `user_preferences`/`group_members` collection is the common case, not an error condition).
 */
function fetchDigestInputs(app, newItems) {
    const users = findAllPaged(app, 'users', 'deleted = false', '')

    const usersById = {}
    const ownerNames = {}
    for (const u of users) {
        usersById[u.id] = u
        ownerNames[u.id] = u.get('username') || ''
    }

    const emailOptedOut = new Set()
    const digestOptedOut = new Set()
    try {
        const prefs = findAllPaged(app, 'user_preferences', 'emailNotifications = false || digestEmails = false', '')
        for (const p of prefs) {
            const userId = p.get('user')
            if (p.get('emailNotifications') === false) emailOptedOut.add(userId)
            if (p.get('digestEmails') === false) digestOptedOut.add(userId)
        }
    } catch (err) {
        // No prefs found / collection empty — everyone is opted in to both.
    }

    const userGroups = {}
    try {
        const memberships = findAllPaged(app, 'group_members', 'id != ""', '')
        for (const m of memberships) {
            const userId = m.get('user')
            const groupId = m.get('group')
            if (!userGroups[userId]) userGroups[userId] = new Set()
            userGroups[userId].add(groupId)
        }
    } catch (err) {
        // No memberships — group sections will be empty
    }

    return { newItems, users, usersById, ownerNames, emailOptedOut, digestOptedOut, userGroups }
}

/**
 * Split `newItems` into this recipient's three digest sections — trusted / group / public — or
 * exclude an item entirely. Never includes the recipient's own items. Pure w.r.t. its inputs (no
 * `app`/PocketBase access), so it is directly unit-testable without a PocketBase instance — this
 * is the single most security-sensitive piece of the digest: it decides who sees which item.
 *
 * @param {object} params
 * @param {object} params.user - The recipient's user record.
 * @param {object[]} params.newItems - All candidate items for this run.
 * @param {Record<string, object>} params.usersById - owner id -> user record (deleted-filtered).
 * @param {Set<string>} params.myGroups - Group ids the recipient belongs to.
 * @param {Set<string>} params.trustedSet - User ids the recipient trusts.
 */
function categorizeItemsForUser({ user, newItems, usersById, myGroups, trustedSet }) {
    const userId = user.id
    const trustedItems = []
    const groupItems = []
    const publicItems = []

    for (const item of newItems) {
        const ownerId = item.get('owner')

        // Skip user's own items
        if (ownerId === userId) continue

        const isTrusteesOnly = item.get('trusteesOnly')
        const itemGroups = item.get('groups') || []
        const itemGroupList = Array.isArray(itemGroups) ? itemGroups : [itemGroups]

        // --- Visibility check first ---
        // Determine if this user is allowed to see the item at all.
        // The owner's trust list controls trusteesOnly visibility.
        const ownerRecord = usersById[ownerId]
        const ownerTrusts = ownerRecord ? ownerRecord.get('trusts') || [] : []
        const ownerTrustSet = new Set(Array.isArray(ownerTrusts) ? ownerTrusts : [ownerTrusts])

        const isInItemGroup = itemGroupList.length > 0 && itemGroupList.some((gId) => myGroups.has(gId))

        let canSee = false
        if (!isTrusteesOnly && itemGroupList.length === 0) {
            // Public item — visible to everyone
            canSee = true
        } else if (isTrusteesOnly && ownerTrustSet.has(userId)) {
            // trusteesOnly — visible only if the owner trusts this user
            canSee = true
        } else if (itemGroupList.length > 0 && isInItemGroup) {
            // Group-only — visible if user is in one of the item's groups
            canSee = true
        }

        if (!canSee) continue

        // --- Categorize into sections ---
        // Priority: trusted person > group > public
        if (trustedSet.has(ownerId)) {
            trustedItems.push(item)
        } else if (isInItemGroup) {
            groupItems.push(item)
        } else if (!isTrusteesOnly && itemGroupList.length === 0) {
            publicItems.push(item)
        } else {
            // trusteesOnly item visible only because the owner trusts us
            // (we don't trust them back, and it isn't group-shared) — it is
            // NOT public, so keep it out of "Neu auf der Plattform".
            trustedItems.push(item)
        }
    }

    return { trustedItems, groupItems, publicItems }
}

function runWeeklyDigest(app) {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const cutoffStr = cutoff.toISOString().replace('T', ' ')

    let newItems
    try {
        newItems = findAllPaged(app, 'items', 'created > {:cutoff}', '-created', { cutoff: cutoffStr })
    } catch (err) {
        app.logger().error('[digest] Failed to fetch new items', 'error', err.toString())
        return { sent: 0, skippedOptOut: 0, failed: 0, newItems: 0 }
    }

    if (newItems.length === 0) {
        app.logger().info('[digest] No new items this week, skipping digest')
        return { sent: 0, skippedOptOut: 0, failed: 0, newItems: 0 }
    }

    let inputs
    try {
        inputs = fetchDigestInputs(app, newItems)
    } catch (err) {
        app.logger().error('[digest] Failed to fetch users', 'error', err.toString())
        return { sent: 0, skippedOptOut: 0, failed: 0, newItems: newItems.length }
    }
    const { users, usersById, ownerNames, emailOptedOut, digestOptedOut, userGroups } = inputs

    // #607 review S2b: resolved ONCE per run, not once per renderItemList()/template call (up to
    // 5x per recipient before this fix). `bases` is bound once here too (not rebuilt per
    // recipient) and passed to renderMailBody() as its `bases` override below, so that helper
    // doesn't re-resolve them via siteBase()/assetBase() on every recipient either.
    const asset = assetBase(app)
    const site = siteBase(app)
    const bases = { SITE_URL: site, ASSET_URL: asset }

    // #607 review N3: inlined directly (single call site) rather than via a `newMailClient(app)`
    // wrapper in services/mail.js — that wrapper was a bare `return app.newMailClient()` with no
    // logic of its own, and sendNotificationEmail() in the same file called `app.newMailClient()`
    // directly anyway, making the "right" way to get a client ambiguous on a read.
    const client = app.newMailClient()
    let sent = 0
    let skippedOptOut = 0
    let failed = 0

    for (const user of users) {
        const userId = user.id
        const email = user.email()
        const username = user.get('username') || 'Nutzer:in'

        if (!email) continue
        if (emailOptedOut.has(userId) || digestOptedOut.has(userId)) {
            skippedOptOut++
            continue
        }

        // Get this user's trust list
        const trustedUserIds = user.get('trusts') || []
        const trustedSet = new Set(Array.isArray(trustedUserIds) ? trustedUserIds : [trustedUserIds])

        // Get this user's group IDs
        const myGroups = userGroups[userId] || new Set()

        const { trustedItems, groupItems, publicItems } = categorizeItemsForUser({
            user,
            newItems,
            usersById,
            myGroups,
            trustedSet,
        })

        // Skip if nothing relevant for this user
        if (trustedItems.length === 0 && groupItems.length === 0 && publicItems.length === 0) {
            continue
        }

        // Render item lists as HTML (max 5 per section)
        // Only public items get uploaded-file thumbnails; trusted/group items show externalImgUrl
        // only. The file endpoint itself checks no auth at all (see the image-resolution doc
        // comment above) — allowUploadedImages here is the ONLY gate between a restricted item's
        // image and this mail.
        const trustedHtml = renderItemList(asset, site, trustedItems, 5, ownerNames, false)
        const groupHtml = renderItemList(asset, site, groupItems, 5, ownerNames, false)
        const publicHtml = renderItemList(asset, site, publicItems, 5, ownerNames, true)

        const body = renderMailBody(
            app,
            'weekly_digest',
            {
                RECIPIENT_NAME: username,
                TRUSTED_ITEMS_HTML: trustedHtml,
                GROUP_ITEMS_HTML: groupHtml,
                PUBLIC_ITEMS_HTML: publicHtml,
            },
            bases
        )

        try {
            sendNotificationEmail(app, {
                to: email,
                subject: 'Dein Wochen-Rückblick auf AllerLeih',
                body: body,
                kind: KIND_BULK,
                unsubscribeUrl: unsubscribeUrl(app, userId, 'digest'),
                client: client,
            })
            sent++
        } catch (err) {
            failed++
            app.logger().error('[digest] Failed to send digest email', 'error', err.toString(), 'userId', userId)
        }

        // Anti-burst pacing — a courtesy to the receiving mail server, not a hard rate limit.
        // `sent > 0` avoids a spurious batch pause before anything has actually gone out.
        if (DIGEST_PACING_MS > 0) sleep(DIGEST_PACING_MS)
        if (sent > 0 && DIGEST_BATCH_SIZE > 0 && sent % DIGEST_BATCH_SIZE === 0 && DIGEST_BATCH_PAUSE_MS > 0) {
            sleep(DIGEST_BATCH_PAUSE_MS)
        }
    }

    app.logger().info(
        '[digest] Weekly digest completed',
        'emailsSent', sent,
        'newItems', newItems.length,
        'skippedOptOut', skippedOptOut,
        'failed', failed
    )

    return { sent, skippedOptOut, failed, newItems: newItems.length }
}

module.exports = { runWeeklyDigest, renderItemList, fetchDigestInputs, categorizeItemsForUser }
