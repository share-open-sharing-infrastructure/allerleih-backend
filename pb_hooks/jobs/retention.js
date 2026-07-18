/// <reference path="../../pb_data/types.d.ts" />

/**
 * GDPR data-retention jobs (issue #461). Each purge function takes an explicit
 * `cutoffIso` (records strictly older than it are removed) and returns counts only —
 * no personal data is returned or logged. Cutoffs come from retention.pb.js (derived
 * from the configured windows); the tests pass an explicit cutoff to exercise the
 * delete path deterministically.
 *
 * Timestamps stored by PocketBase and produced by utils/common.js share the exact
 * "YYYY-MM-DD HH:mm:ss.sssZ" UTC format, so filter comparisons (`< {:c}`) are plain
 * lexicographic string comparisons.
 *
 * Matches are processed with keyset pagination (`id > lastId`) rather than loaded all
 * at once, so a large backlog never blows up memory. Keyset (not offset) is used
 * because rows are deleted/skipped as we go: advancing by id is stable under both.
 */

const { findBlockingLoans, anonymizeAccount } = require(`${__hooks}/services/account.js`)
const { sendNotificationEmail } = require(`${__hooks}/services/mail.js`)
const { now, daysAgoIso, monthsAfterIso } = require(`${__hooks}/utils/common.js`)
const {
    DRY_MODE,
    ADMIN_NOTIFY_EMAIL,
    RETENTION_SKIP_NOTICE_COOLDOWN_DAYS,
    RETENTION_INACTIVE_MONTHS,
    RETENTION_PAGE_SIZE,
} = require(`${__hooks}/constants.js`)

const INACTIVE_MONTHS =
    isNaN(RETENTION_INACTIVE_MONTHS) || RETENTION_INACTIVE_MONTHS < 1 ? 6 : RETENTION_INACTIVE_MONTHS

const SKIP_NOTICE_COOLDOWN_DAYS =
    isNaN(RETENTION_SKIP_NOTICE_COOLDOWN_DAYS) || RETENTION_SKIP_NOTICE_COOLDOWN_DAYS < 0
        ? 7
        : RETENTION_SKIP_NOTICE_COOLDOWN_DAYS

const PAGE_SIZE = isNaN(RETENTION_PAGE_SIZE) || RETENTION_PAGE_SIZE < 1 ? 200 : RETENTION_PAGE_SIZE

/**
 * Invoke `handler(record)` for every record matching `filter`, a page at a time, using
 * keyset pagination on `id`. `handler` may delete/mutate the record; the cursor only
 * advances (id strictly increases), so a row the handler skips or fails on is passed
 * over for this run rather than re-fetched forever.
 */
function forEachMatching(app, collection, filter, params, handler) {
    let lastId = ''
    for (;;) {
        const pagedFilter = lastId ? `(${filter}) && id > {:__lastId}` : filter
        const pagedParams = lastId ? Object.assign({}, params, { __lastId: lastId }) : params
        const batch = app.findRecordsByFilter(collection, pagedFilter, 'id', PAGE_SIZE, 0, pagedParams).filter((r) => !!r)
        if (batch.length === 0) break
        batch.forEach((rec) => {
            lastId = rec.id
            handler(rec)
        })
        if (batch.length < PAGE_SIZE) break
    }
}

/** Fetch every record matching `filter` (limit 0 = all) and hard-delete it. Returns the count. */
function deleteAllMatching(app, collection, filter, params) {
    const records = app.findRecordsByFilter(collection, filter, '', 0, 0, params).filter((r) => !!r)
    records.forEach((r) => app.delete(r))
    return records.length
}

/**
 * Job 1 — anonymize accounts with no login since `cutoffIso`. Accounts with an open
 * loan are skipped (deleting them would strand the counterparty); the user and a
 * platform admin are notified by email (#461 edge case). Accounts that never stamped
 * a login fall back to their `created` date. Reuses the self-service deletion path
 * (`anonymizeAccount`), so an inactive account is erased exactly like a self-deleted one.
 */
function purgeInactiveAccounts(app, cutoffIso) {
    let anonymized = 0
    let skipped = 0
    let failed = 0

    // Fault isolation: a single record that throws (e.g. anonymizeAccount re-saving a
    // related user whose legacy data now fails validation) must not abort the whole
    // nightly run and permanently starve every later candidate. Log the id + error,
    // count it, and continue.
    forEachMatching(
        app,
        'users',
        'deleted != true && ((lastLoginAt != "" && lastLoginAt < {:c}) || (lastLoginAt = "" && created < {:c}))',
        { c: cutoffIso },
        (user) => {
            try {
                const blocking = findBlockingLoans(app, user.id)
                if (blocking.length > 0) {
                    maybeNotifyInactiveSkipped(app, user, blocking.length)
                    skipped++
                    return
                }
                app.runInTransaction((txApp) => {
                    anonymizeAccount(txApp, txApp.findRecordById('users', user.id))
                })
                anonymized++
            } catch (err) {
                failed++
                app.logger().error('[retention] inactive account failed', 'userId', user.id, 'error', String(err))
            }
        }
    )

    return { anonymized, skipped, failed }
}

/**
 * Send the skip notice at most once per cooldown window: the job runs nightly and
 * re-selects the same open-loan account every time, so without this the user + admin
 * would be emailed every night until the loan closes. `retentionNotifiedAt` records
 * the last notice; it is stamped even under DRY_MODE so the gate is testable. Never
 * throws — a mail/stamp failure is logged but must not flip the skip into a "failed".
 */
function maybeNotifyInactiveSkipped(app, userRecord, loanCount) {
    const lastNotified = userRecord.getString('retentionNotifiedAt')
    if (lastNotified && lastNotified >= daysAgoIso(SKIP_NOTICE_COOLDOWN_DAYS)) return

    notifyInactiveSkipped(app, userRecord, loanCount)
    try {
        userRecord.set('retentionNotifiedAt', now())
        app.save(userRecord)
    } catch (err) {
        app.logger().error('[retention] skip-notice stamp failed', 'userId', userRecord.id, 'error', String(err))
    }
}

/** Email the user and (if configured) a platform admin that an inactive account was kept due to an open loan. */
function notifyInactiveSkipped(app, userRecord, loanCount) {
    if (DRY_MODE) return

    try {
        const body = $template
            .loadFiles(`${__hooks}/views/mail/retention_skipped_user.html`)
            .render({ USERNAME: userRecord.get('username') })
        sendNotificationEmail(app, {
            to: userRecord.email(),
            subject: 'Dein AllerLeih-Konto: Löschung wegen offener Ausleihe verschoben',
            body,
        })
    } catch (err) {
        app.logger().error('[retention] inactive user skip-mail failed', 'error', String(err))
    }

    if (!ADMIN_NOTIFY_EMAIL) {
        app.logger().warn('[retention] ADMIN_NOTIFY_EMAIL not set — admin skip-notice not sent')
        return
    }
    try {
        const adminBody = $template
            .loadFiles(`${__hooks}/views/mail/retention_skipped_admin.html`)
            .render({ USERNAME: userRecord.get('username'), USER_ID: userRecord.id, LOAN_COUNT: loanCount })
        sendNotificationEmail(app, {
            to: ADMIN_NOTIFY_EMAIL,
            subject: 'AllerLeih: inaktives Konto wegen offener Ausleihe übersprungen',
            body: adminBody,
        })
    } catch (err) {
        app.logger().error('[retention] admin skip-mail failed', 'error', String(err))
    }
}

/**
 * Job 5 — advance warning ahead of Job 1: email every account whose effective last
 * activity (`lastLoginAt`, falling back to `created`) predates `warnCutoffIso` that it
 * will be deleted on <last activity + RETENTION_INACTIVE_MONTHS months>, and that
 * logging in prevents it. The cutoff is the deletion cutoff shifted forward by
 * RETENTION_INACTIVE_WARN_DAYS (resolved in retention.pb.js).
 *
 * Sent at most once per inactivity cycle: `deletionWarnedAt` is stamped after a
 * successful send, and a stamp older than the effective last activity belongs to a
 * previous cycle — so a login (which re-stamps `lastLoginAt`) re-arms the warning
 * with no auth-hook involvement. A send failure leaves the stamp unset, so the
 * nightly run retries until the mail goes out. Open-loan accounts are warned too
 * (the loan may close before the deadline; if not, Job 1 sends the skip notice).
 * Runs independently of Job 1 — it never delays a deletion.
 */
function warnInactiveAccounts(app, warnCutoffIso) {
    let warned = 0
    let failed = 0

    forEachMatching(
        app,
        'users',
        'deleted != true && ' +
            '((lastLoginAt != "" && lastLoginAt < {:c}) || (lastLoginAt = "" && created < {:c})) && ' +
            '(deletionWarnedAt = "" || ' +
            '(lastLoginAt != "" && deletionWarnedAt < lastLoginAt) || ' +
            '(lastLoginAt = "" && deletionWarnedAt < created))',
        { c: warnCutoffIso },
        (user) => {
            try {
                const lastActive = user.getString('lastLoginAt') || user.getString('created')
                const deletionDate = germanDate(monthsAfterIso(lastActive, INACTIVE_MONTHS))
                if (!DRY_MODE) {
                    const body = $template
                        .loadFiles(`${__hooks}/views/mail/retention_warning_user.html`)
                        .render({
                            USERNAME: user.get('username'),
                            DELETION_DATE: deletionDate,
                            MONTHS: INACTIVE_MONTHS,
                        })
                    sendNotificationEmail(app, {
                        to: user.email(),
                        subject: `Dein AllerLeih-Konto wird am ${deletionDate} gelöscht`,
                        body,
                    })
                }
                // Stamped after the send (and under DRY_MODE, so the once-per-cycle
                // gate stays testable) — a send failure above skips it and retries.
                user.set('deletionWarnedAt', now())
                app.save(user)
                warned++
            } catch (err) {
                failed++
                app.logger().error('[retention] inactivity warning failed', 'userId', user.id, 'error', String(err))
            }
        }
    )

    return { warned, failed }
}

/** "YYYY-MM-DD …" → "TT.MM.JJJJ" (the shared UTC timestamp format is positional). */
function germanDate(iso) {
    return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
}

/**
 * Job 2 — delete conversations whose last activity (`updated`) predates `cutoffIso`,
 * together with their messages and any notifications pointing at them. Per the product
 * decision this ignores `lendingStatus` (no open-loan guard). Each conversation is
 * removed atomically; one failure is isolated and does not abort the run.
 */
function purgeOldConversations(app, cutoffIso) {
    let deleted = 0
    let failed = 0

    forEachMatching(app, 'conversations', 'updated < {:c}', { c: cutoffIso }, (conv) => {
        try {
            app.runInTransaction((txApp) => {
                // Messages have no back-reference to the conversation; reach them through
                // the conversation's `messages` relation (ids may already be gone).
                ;(conv.get('messages') || []).forEach((messageId) => {
                    try {
                        txApp.delete(txApp.findRecordById('messages', messageId))
                    } catch (_) {
                        /* already deleted */
                    }
                })
                // Notifications that deep-link to this conversation would 404 once it is gone.
                deleteAllMatching(txApp, 'notifications', 'relatedId = {:id}', { id: conv.id })
                txApp.delete(txApp.findRecordById('conversations', conv.id))
            })
            deleted++
        } catch (err) {
            failed++
            app.logger().error('[retention] conversation purge failed', 'conversationId', conv.id, 'error', String(err))
        }
    })

    return { deleted, failed }
}

/** Delete records of `collection` older than `cutoffIso` in keyset-paginated batches. */
function purgeOlderThan(app, collection, cutoffIso) {
    let deleted = 0
    let failed = 0
    forEachMatching(app, collection, 'created < {:c}', { c: cutoffIso }, (rec) => {
        try {
            app.delete(rec)
            deleted++
        } catch (err) {
            failed++
            app.logger().error('[retention] delete failed', 'collection', collection, 'recordId', rec.id, 'error', String(err))
        }
    })
    return { deleted, failed }
}

/** Job 3 — delete in-app notifications older than `cutoffIso`. */
function purgeOldNotifications(app, cutoffIso) {
    return purgeOlderThan(app, 'notifications', cutoffIso)
}

/** Job 4 — delete feedback entries older than `cutoffIso`. */
function purgeOldFeedback(app, cutoffIso) {
    return purgeOlderThan(app, 'feedback', cutoffIso)
}

module.exports = {
    purgeInactiveAccounts,
    warnInactiveAccounts,
    purgeOldConversations,
    purgeOldNotifications,
    purgeOldFeedback,
}
