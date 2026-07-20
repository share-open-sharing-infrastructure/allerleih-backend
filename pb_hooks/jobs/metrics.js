/// <reference path="../../pb_data/types.d.ts" />

/**
 * Business-metrics project: computes the nightly `metrics_daily` snapshot consumed by
 * the share-mvp `/admin/metrics` and `/misc/stats` pages. Every value here is a count
 * or aggregate over counts — no per-user data is included in the returned object, and
 * nothing here is written back except the single upserted `metrics_daily` row.
 *
 * Time-based metrics (30d windows, acceptedAt/completedAt-derived figures) only
 * accumulate from the deployment of the acceptedAt/completedAt fields forward — there
 * is no backfill, since `updated` is not a reliable proxy (bumped by unrelated writes
 * like lastSeenAt pings). See docs/operations/metrics.md.
 */

const { now, daysAgoIso } = require(`${__hooks}/utils/common.js`)

const LENDING_STATUSES = ['pending', 'accepted', 'rejected', 'active', 'return_requested', 'completed', 'aborted']
const COUNTERFACTUAL_ANSWERS = [
    'pending',
    'would_buy',
    'not_important',
    'too_expensive',
    'borrow_elsewhere',
    'unsure',
    'skipped',
]

/** Count records matching `filter` without loading more than their ids/fields into memory at once. */
function countFilter(app, collection, filter, params) {
    return app.findRecordsByFilter(collection, filter, '', 0, 0, params || {}).length
}

/** Resolve `{id: username}` for a set of user ids, tolerating already-deleted users. */
function usernameMap(app, ids) {
    const unique = Array.from(new Set(ids.filter((id) => !!id)))
    if (unique.length === 0) return {}
    const map = {}
    app.findRecordsByIds('users', unique)
        .filter((r) => !!r)
        .forEach((u) => {
            map[u.id] = u.get('username')
        })
    return map
}

/** Group a list of records by a relation field id, returning [{userId, username, count}] sorted by count desc. */
function groupByOwner(app, records, ownerField) {
    const counts = new Map()
    records.forEach((r) => {
        const ownerId = r.get(ownerField)
        if (!ownerId) return
        counts.set(ownerId, (counts.get(ownerId) || 0) + 1)
    })
    const names = usernameMap(app, Array.from(counts.keys()))
    return Array.from(counts.entries())
        .map(([userId, count]) => ({ userId, username: names[userId] || '', count }))
        .sort((a, b) => b.count - a.count)
}

function computeUsers(app) {
    return {
        total: countFilter(app, 'users', 'deleted != true'),
        institutions: countFilter(app, 'users', 'deleted != true && isInstitution = true'),
        verified: countFilter(app, 'users', 'deleted != true && verified = true'),
    }
}

function computeItems(app) {
    const available = countFilter(app, 'items', 'status = "available"')
    const byPrivateUsers = countFilter(app, 'items', 'status = "available" && owner.isInstitution != true')
    const byInstitutionsNative = countFilter(
        app,
        'items',
        'status = "available" && owner.isInstitution = true && externalId = ""'
    )
    const externalItems = app.findRecordsByFilter(
        'items',
        'status = "available" && externalId != ""',
        '',
        0,
        0,
        {}
    )

    return {
        available,
        byPrivateUsers,
        byInstitutionsNative,
        external: externalItems.length,
        externalByInstitution: groupByOwner(app, externalItems, 'owner'),
    }
}

function computeLoans(app, cutoff30) {
    const byStatus = {}
    LENDING_STATUSES.forEach((status) => {
        byStatus[status] = countFilter(app, 'conversations', 'lendingStatus = {:s}', { s: status })
    })

    return {
        byStatus,
        completedTotal: byStatus.completed,
        accepted30d: countFilter(app, 'conversations', 'acceptedAt != "" && acceptedAt >= {:c}', { c: cutoff30 }),
        completed30d: countFilter(app, 'conversations', 'completedAt != "" && completedAt >= {:c}', { c: cutoff30 }),
    }
}

/**
 * Distinct users (requester OR owner) who were party to >=1 / >=2 conversations that
 * reached 'accepted' or 'completed' in the last 30 days — covers the ">1 transaction
 * per month" activity definition; both thresholds are stored so the display cutoff is
 * a frontend choice, not a recomputation.
 */
function computeActiveUsers(app, cutoff7, cutoff30) {
    const recentLoans = app.findRecordsByFilter(
        'conversations',
        '(acceptedAt != "" && acceptedAt >= {:c}) || (completedAt != "" && completedAt >= {:c})',
        '',
        0,
        0,
        { c: cutoff30 }
    )

    const perUser = new Map()
    recentLoans.forEach((conv) => {
        ;[conv.get('requester'), conv.get('itemOwner')].forEach((userId) => {
            if (!userId) return
            perUser.set(userId, (perUser.get(userId) || 0) + 1)
        })
    })

    let loans30d2plus = 0
    perUser.forEach((count) => {
        if (count >= 2) loans30d2plus++
    })

    return {
        loans30d_1plus: perUser.size,
        loans30d_2plus: loans30d2plus,
        login7d: countFilter(app, 'users', 'deleted != true && lastLoginAt != "" && lastLoginAt >= {:c}', {
            c: cutoff7,
        }),
        login30d: countFilter(app, 'users', 'deleted != true && lastLoginAt != "" && lastLoginAt >= {:c}', {
            c: cutoff30,
        }),
    }
}

/**
 * Owner reply detection for `stalePending`: a conversation counts as stale only if the
 * item owner has never sent a message in it (a reply that owner then ignored again
 * isn't "no reply" — it's a separate engagement problem this metric doesn't cover).
 */
function ownerHasReplied(app, conversationId, ownerId) {
    try {
        app.findFirstRecordByFilter('messages', 'conversation = {:c} && from = {:o}', {
            c: conversationId,
            o: ownerId,
        })
        return true
    } catch (err) {
        return false
    }
}

/**
 * Acceptance rate among requests CREATED in the window (not accepted in the window):
 * of those, the share the owner has said yes to (accepted, or any status reachable
 * only after an acceptance) vs explicitly rejected. Conversations still pending, or
 * aborted before a decision, are excluded from both sides — they were never decided.
 */
function computeFunnel(app, cutoff7, cutoff30) {
    const requests30d = countFilter(app, 'conversations', 'created >= {:c}', { c: cutoff30 })
    const acceptedLike = countFilter(
        app,
        'conversations',
        'created >= {:c} && (lendingStatus = "accepted" || lendingStatus = "active" || lendingStatus = "return_requested" || lendingStatus = "completed")',
        { c: cutoff30 }
    )
    const rejected = countFilter(app, 'conversations', 'created >= {:c} && lendingStatus = "rejected"', {
        c: cutoff30,
    })
    const decided = acceptedLike + rejected
    const acceptanceRate30d = decided > 0 ? acceptedLike / decided : null

    const stalePendingCandidates = app.findRecordsByFilter(
        'conversations',
        'lendingStatus = "pending" && created < {:c}',
        '',
        0,
        0,
        { c: cutoff7 }
    )
    const stalePending = stalePendingCandidates.filter(
        (conv) => !ownerHasReplied(app, conv.id, conv.get('itemOwner'))
    ).length

    return { requests30d, acceptanceRate30d, stalePending }
}

function computeMessages(app, cutoff30) {
    return {
        total: countFilter(app, 'messages', ''),
        last30d: countFilter(app, 'messages', 'created >= {:c}', { c: cutoff30 }),
    }
}

function computeImpact(app) {
    const counterfactual = {}
    COUNTERFACTUAL_ANSWERS.forEach((answer) => {
        counterfactual[answer] = countFilter(
            app,
            'conversations',
            'lendingStatus = "completed" && counterfactual = {:a}',
            { a: answer }
        )
    })
    return { counterfactual }
}

function computeIntegrations(app) {
    const institutions = app.findRecordsByFilter(
        'users',
        'deleted != true && isInstitution = true && leihbackendUrl != ""',
        '',
        0,
        0,
        {}
    )

    const lastSyncByInstitution = institutions.map((inst) => {
        const items = app.findRecordsByFilter('items', 'owner = {:id}', '-updated', 1, 0, { id: inst.id })
        return {
            userId: inst.id,
            username: inst.get('username'),
            itemCount: countFilter(app, 'items', 'owner = {:id}', { id: inst.id }),
            newestUpdated: items.length > 0 ? items[0].get('updated') : null,
        }
    })

    return { lastSyncByInstitution }
}

const OUTBOUND_TOP_N = 20

/**
 * outbound_clicks has no `owner` column of its own — only an optional `item` relation
 * (a click with no item, e.g. a stripped/unknown destination, can't be attributed and
 * is excluded from this breakdown, though it still counts in `total`/`last30d`). The
 * owner is resolved one hop through the clicked item.
 */
function computeOutboundClicks(app, cutoff30) {
    const recentClicks = app.findRecordsByFilter('outbound_clicks', 'created >= {:c}', '', 0, 0, { c: cutoff30 })

    const itemIds = Array.from(new Set(recentClicks.map((c) => c.get('item')).filter((id) => !!id)))
    const itemOwners = {}
    if (itemIds.length > 0) {
        app.findRecordsByIds('items', itemIds)
            .filter((r) => !!r)
            .forEach((item) => {
                itemOwners[item.id] = item.get('owner')
            })
    }

    const counts = new Map()
    recentClicks.forEach((click) => {
        const itemId = click.get('item')
        const ownerId = itemId ? itemOwners[itemId] : null
        if (!ownerId) return
        counts.set(ownerId, (counts.get(ownerId) || 0) + 1)
    })
    const names = usernameMap(app, Array.from(counts.keys()))
    const byItemOwner30d = Array.from(counts.entries())
        .map(([userId, count]) => ({ userId, username: names[userId] || '', count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, OUTBOUND_TOP_N)

    return {
        total: countFilter(app, 'outbound_clicks', ''),
        last30d: recentClicks.length,
        byItemOwner30d,
    }
}

function computeCommunity(app) {
    return {
        groups: {
            total: countFilter(app, 'groups', ''),
            public: countFilter(app, 'groups', 'isPublic = true'),
            memberships: countFilter(app, 'group_members', ''),
        },
        trusts: {
            edges: countFilter(app, 'trusts', ''),
        },
        invites: {
            usersInvited: countFilter(app, 'users', 'deleted != true && invitedBy != ""'),
        },
        push: {
            subscriptions: countFilter(app, 'push_subscriptions', ''),
            usersSubscribed: new Set(
                app
                    .findRecordsByFilter('push_subscriptions', '', '', 0, 0, {})
                    .map((s) => s.get('user'))
                    .filter((id) => !!id)
            ).size,
        },
    }
}

/** Computes the full metrics catalog for "today". Read-only — never mutates data. */
function computeDailyMetrics(app) {
    const cutoff7 = daysAgoIso(7)
    const cutoff30 = daysAgoIso(30)

    return {
        users: computeUsers(app),
        items: computeItems(app),
        loans: computeLoans(app, cutoff30),
        activeUsers: computeActiveUsers(app, cutoff7, cutoff30),
        funnel: computeFunnel(app, cutoff7, cutoff30),
        messages: computeMessages(app, cutoff30),
        impact: computeImpact(app),
        integrations: computeIntegrations(app),
        outboundClicks: computeOutboundClicks(app, cutoff30),
        community: computeCommunity(app),
    }
}

/** Upsert today's `metrics_daily` row keyed on `date` ("YYYY-MM-DD") — safe to re-run. */
function upsertMetricsDaily(app, dateStr, metrics) {
    let record
    try {
        record = app.findFirstRecordByFilter('metrics_daily', 'date = {:d}', { d: dateStr })
    } catch (err) {
        record = new Record(app.findCollectionByNameOrId('metrics_daily'))
        record.set('date', dateStr)
    }
    record.set('metrics', metrics)
    app.save(record)
    return record
}

/** "YYYY-MM-DD HH:mm:ss.sssZ" (the shared UTC format) → "YYYY-MM-DD". */
function todayDateStr() {
    return now().slice(0, 10)
}

/** Job entry point: compute + upsert. Returns the metric group names written (counts only, never values). */
function runDailyMetricsSnapshot(app) {
    const metrics = computeDailyMetrics(app)
    upsertMetricsDaily(app, todayDateStr(), metrics)
    return { groups: Object.keys(metrics) }
}

module.exports = {
    computeDailyMetrics,
    upsertMetricsDaily,
    runDailyMetricsSnapshot,
}
