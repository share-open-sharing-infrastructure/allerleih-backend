/// <reference path="../pb_data/types.d.ts" />

/**
 * Weekly Digest — sends "Dein Wochen-Rückblick" every Sunday at 12:00 noon.
 *
 * Sections:
 * 1. Items from the user's trusted people (owner.trusts contains the user)
 * 2. Items from the user's groups
 * 3. All other new public items (trusteesOnly=false, no groups)
 *
 * Respects user_preferences.emailNotifications (default: opted-in).
 * Skipped entirely in DRY_MODE.
 */

cronAdd('weekly_digest', '0 12 * * 0', () => {
    const { DRY_MODE } = require(`${__hooks}/constants.js`)
    const { sendNotificationEmail } = require(`${__hooks}/services/mail.js`)

    if (DRY_MODE) {
        $app.logger().debug('[digest] Skipped — DRY_MODE is enabled')
        return
    }

    function escapeHtml(str) {
        if (!str) return ''
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
    }

    function renderItemList(items, max, ownerNames, allowUploadedImages) {
        if (!items || items.length === 0) return ''

        const appUrl = $app.settings().meta.appURL || 'https://allerleih.org'
        const limit = max || 5
        const visible = items.slice(0, limit)

        let html = ''
        for (const item of visible) {
            const name = item.get('name') || 'Unbenannter Gegenstand'
            const categories = item.get('categories') || []
            const categoryStr = Array.isArray(categories) && categories.length > 0
                ? categories.join(', ')
                : ''
            const itemUrl = appUrl + '/items/' + item.id
            const ownerId = item.get('owner')
            const ownerName = ownerNames[ownerId] || ''

            // Resolve image URL:
            // - Uploaded files are behind auth, so only include them for public items
            // - externalImgUrl is always accessible (external host, no auth)
            let imgUrl = ''
            const imageFiles = item.get('image') || []
            const images = Array.isArray(imageFiles) ? imageFiles : [imageFiles]
            const externalImg = item.get('externalImgUrl')
            if (allowUploadedImages && images.length > 0 && images[0]) {
                imgUrl = appUrl + '/api/files/items_public/' + item.id + '/' + images[0]
            } else if (externalImg) {
                imgUrl = externalImg
            }

            html += '<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 12px; border-bottom: 1px solid #EBE6D9; padding-bottom: 12px;"><tr>'
            if (imgUrl) {
                html += '<td width="64" style="vertical-align: top; padding-right: 12px;">'
                html += '<a href="' + itemUrl + '"><img src="' + imgUrl + '" width="64" height="64" style="width: 64px; height: 64px; object-fit: cover; border-radius: 8px; display: block;" alt="' + escapeHtml(name) + '"></a>'
                html += '</td>'
            }
            html += '<td style="vertical-align: top;">'
            html += '<a href="' + itemUrl + '" style="color: #1F1F1F; text-decoration: none; font-weight: 600; font-size: 15px; display: block; margin-bottom: 2px;">' + escapeHtml(name) + '</a>'
            if (ownerName) {
                html += '<span style="color: #6B6B6B; font-size: 13px;">von ' + escapeHtml(ownerName) + '</span><br>'
            }
            if (categoryStr) {
                html += '<span style="color: #6B6B6B; font-size: 13px;">' + escapeHtml(categoryStr) + '</span><br>'
            }
            html += '<a href="' + itemUrl + '" style="color: #5B6EC7; font-size: 13px; text-decoration: underline;">Ansehen &rarr;</a>'
            html += '</td>'
            html += '</tr></table>'
        }

        if (items.length > limit) {
            html += '<p style="color: #6B6B6B; font-size: 13px; margin-top: 4px;">+ ' + (items.length - limit) + ' weitere neue Gegenst&auml;nde</p>'
        }

        return html
    }

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const cutoffStr = cutoff.toISOString().replace('T', ' ')

    const PAGE = 200

    // Fetch all items created in the last 7 days (paginated)
    const newItems = []
    try {
        let offset = 0
        for (;;) {
            const batch = $app.findRecordsByFilter(
                'items',
                'created > {:cutoff}',
                '-created',
                PAGE,
                offset,
                { cutoff: cutoffStr }
            )
            for (const item of batch) newItems.push(item)
            if (batch.length < PAGE) break
            offset += PAGE
        }
    } catch (err) {
        $app.logger().error('[digest] Failed to fetch new items', 'error', err.toString())
        return
    }

    if (newItems.length === 0) {
        $app.logger().info('[digest] No new items this week, skipping digest')
        return
    }

    // Fetch all users excluding deleted accounts (paginated)
    const users = []
    try {
        let offset = 0
        for (;;) {
            const batch = $app.findRecordsByFilter('users', 'deleted = false', '', PAGE, offset)
            for (const u of batch) users.push(u)
            if (batch.length < PAGE) break
            offset += PAGE
        }
    } catch (err) {
        $app.logger().error('[digest] Failed to fetch users', 'error', err.toString())
        return
    }

    // Build a map of userId -> user record (for owner trust lookups + username)
    const usersById = {}
    const ownerNames = {}
    for (const u of users) {
        usersById[u.id] = u
        ownerNames[u.id] = u.get('username') || ''
    }

    // Build a set of users who opted out of email notifications (paginated)
    const optedOut = new Set()
    try {
        let offset = 0
        for (;;) {
            const batch = $app.findRecordsByFilter('user_preferences', 'emailNotifications = false', '', PAGE, offset)
            for (const p of batch) optedOut.add(p.get('user'))
            if (batch.length < PAGE) break
            offset += PAGE
        }
    } catch (err) {
        // No prefs found or collection empty — everyone is opted in
    }

    // Pre-compute: group memberships per user (paginated)
    const userGroups = {}
    try {
        let offset = 0
        for (;;) {
            const batch = $app.findRecordsByFilter('group_members', 'id != ""', '', PAGE, offset)
            for (const m of batch) {
                const userId = m.get('user')
                const groupId = m.get('group')
                if (!userGroups[userId]) userGroups[userId] = new Set()
                userGroups[userId].add(groupId)
            }
            if (batch.length < PAGE) break
            offset += PAGE
        }
    } catch (err) {
        // No memberships — group sections will be empty
    }

    let sentCount = 0

    for (const user of users) {
        const userId = user.id
        const email = user.email()
        const username = user.get('username') || 'Nutzer:in'

        // Skip users without email or who opted out
        if (!email) continue
        if (optedOut.has(userId)) continue

        // Get this user's trust list
        const trustedUserIds = user.get('trusts') || []
        const trustedSet = new Set(Array.isArray(trustedUserIds) ? trustedUserIds : [trustedUserIds])

        // Get this user's group IDs
        const myGroups = userGroups[userId] || new Set()

        // Categorize items for this user
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

            const isInItemGroup = itemGroupList.length > 0 && itemGroupList.some(gId => myGroups.has(gId))

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
            } else {
                publicItems.push(item)
            }
        }

        // Skip if nothing relevant for this user
        if (trustedItems.length === 0 && groupItems.length === 0 && publicItems.length === 0) {
            continue
        }

        // Render item lists as HTML (max 5 per section)
        // Only public items get uploaded-file thumbnails (no auth required);
        // trusted/group items only show externalImgUrl (auth-gated files would 403 in email clients)
        const trustedHtml = renderItemList(trustedItems, 5, ownerNames, false)
        const groupHtml = renderItemList(groupItems, 5, ownerNames, false)
        const publicHtml = renderItemList(publicItems, 5, ownerNames, true)

        const body = $template
            .loadFiles(`${__hooks}/views/mail/weekly_digest.html`)
            .render({
                RECIPIENT_NAME: username,
                TRUSTED_ITEMS_HTML: trustedHtml,
                GROUP_ITEMS_HTML: groupHtml,
                PUBLIC_ITEMS_HTML: publicHtml,
            })

        try {
            sendNotificationEmail($app, {
                to: email,
                subject: 'Dein Wochen-Rückblick auf AllerLeih',
                body: body,
            })
            sentCount++
        } catch (err) {
            $app.logger().error(
                '[digest] Failed to send digest email',
                'error', err.toString(),
                'userId', userId
            )
        }
    }

    $app.logger().info(
        '[digest] Weekly digest completed',
        'emailsSent', sentCount,
        'newItems', newItems.length
    )
})
