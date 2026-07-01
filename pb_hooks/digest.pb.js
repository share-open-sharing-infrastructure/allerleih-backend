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

    function renderItemList(items, max, ownerNames) {
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
            const itemUrl = 'https://allerleih.org/items/' + item.id
            const ownerId = item.get('owner')
            const ownerName = ownerNames[ownerId] || ''

            // Resolve image URL: prefer uploaded file, fall back to externalImgUrl
            let imgUrl = ''
            const imageFile = item.get('image')
            const externalImg = item.get('externalImgUrl')
            if (imageFile) {
                imgUrl = appUrl + '/api/files/items/' + item.id + '/' + imageFile
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
                html += '<span style="color: #6B6B6B; font-size: 13px;">' + categoryStr + '</span><br>'
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

    // Fetch all items created in the last 7 days
    let newItems
    try {
        newItems = $app.findRecordsByFilter(
            'items',
            'created > {:cutoff}',
            '-created',
            0, // no limit
            0,
            { cutoff: cutoffStr }
        )
    } catch (err) {
        $app.logger().info('[digest] No new items this week')
        return
    }

    if (!newItems || newItems.length === 0) {
        $app.logger().info('[digest] No new items this week, skipping digest')
        return
    }

    // Fetch all users (excluding deleted accounts)
    let users
    try {
        users = $app.findRecordsByFilter('users', 'deleted = false', '', 0, 0)
    } catch (err) {
        $app.logger().error('[digest] Failed to fetch users', 'error', err.toString())
        return
    }

    // Build a map of userId -> username for item owner display
    const ownerNames = {}
    for (const u of users) {
        ownerNames[u.id] = u.get('username') || ''
    }

    // Build a set of users who opted out of email notifications
    const optedOut = new Set()
    try {
        const prefs = $app.findRecordsByFilter('user_preferences', 'emailNotifications = false', '', 0, 0)
        for (const p of prefs) {
            optedOut.add(p.get('user'))
        }
    } catch (err) {
        // No prefs found or collection empty — everyone is opted in
    }

    // Pre-compute: group memberships per user
    let allMemberships
    try {
        allMemberships = $app.findRecordsByFilter('group_members', 'id != ""', '', 0, 0)
    } catch (err) {
        allMemberships = []
    }

    // Map: userId -> Set of groupIds they belong to
    const userGroups = {}
    for (const m of allMemberships) {
        const userId = m.get('user')
        const groupId = m.get('group')
        if (!userGroups[userId]) userGroups[userId] = new Set()
        userGroups[userId].add(groupId)
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

            // Check if from a trusted person
            if (trustedSet.has(ownerId)) {
                trustedItems.push(item)
                continue
            }

            // Check if from a group the user belongs to
            if (itemGroupList.length > 0) {
                let inGroup = false
                for (const gId of itemGroupList) {
                    if (myGroups.has(gId)) {
                        inGroup = true
                        break
                    }
                }
                if (inGroup) {
                    groupItems.push(item)
                    continue
                }
            }

            // Public items: not trusteesOnly and not group-only
            if (!isTrusteesOnly && itemGroupList.length === 0) {
                publicItems.push(item)
            }
        }

        // Skip if nothing relevant for this user
        if (trustedItems.length === 0 && groupItems.length === 0 && publicItems.length === 0) {
            continue
        }

        // Render item lists as HTML (max 5 per section)
        const trustedHtml = renderItemList(trustedItems, 5, ownerNames)
        const groupHtml = renderItemList(groupItems, 5, ownerNames)
        const publicHtml = renderItemList(publicItems, 5, ownerNames)

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
