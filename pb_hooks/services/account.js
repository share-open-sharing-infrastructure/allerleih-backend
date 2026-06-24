/// <reference path="../../pb_data/types.d.ts" />

/**
 * Account service — GDPR self-service account deletion (Art. 17) and data export
 * (Art. 15/20).
 *
 * Deletion is "anonymize-in-place": personal-only data is hard-deleted, shared and
 * audit data (conversations, messages, completed loans, term acceptances) is retained
 * but the user's identity is scrubbed so the counterparty keeps a coherent history and
 * the lending paper trail stays intact. The original email + username are copied into
 * the restricted `deleted_accounts` collection first (dispute resolution), then the
 * live `users` row is anonymized and flagged `deleted`.
 */

const { now } = require(`${__hooks}/utils/common.js`)

// Lending states in which a loan is still in flight — deleting an account while one
// of these is open would strand the counterparty, so deletion is refused.
const BLOCKING_LOAN_FILTER =
    '(requester = {:u} || itemOwner = {:u}) && ' +
    '(lendingStatus = "accepted" || lendingStatus = "active" || lendingStatus = "return_requested")'

/**
 * Returns the conversations that currently block deletion (open loans involving the
 * user as requester or owner). Empty array => deletion may proceed.
 */
function findBlockingLoans(app, userId) {
    return app
        .findRecordsByFilter('conversations', BLOCKING_LOAN_FILTER, '-updated', 0, 0, { u: userId })
        .filter((r) => !!r)
}

/** Delete every record in `collection` matching `filter`. */
function deleteByFilter(app, collection, filter, params) {
    const records = app.findRecordsByFilter(collection, filter, '', 0, 0, params).filter((r) => !!r)
    records.forEach((r) => app.delete(r))
    return records.length
}

/**
 * Anonymize a user account in place and hard-delete its personal-only data.
 * Must be called inside a transaction (see deleteAccount in account.pb.js).
 */
function anonymizeAccount(app, userRecord) {
    const userId = userRecord.id

    // 1. Snapshot the identity into the restricted audit store BEFORE scrubbing.
    const auditCollection = app.findCollectionByNameOrId('deleted_accounts')
    const audit = new Record(auditCollection)
    audit.set('user', userId)
    audit.set('email', userRecord.email())
    audit.set('username', userRecord.get('username'))
    audit.set('deletedAt', now())
    app.save(audit)

    // 2. Hard-delete personal-only data (no retention need).
    deleteByFilter(app, 'user_contacts', 'user = {:u}', { u: userId })
    deleteByFilter(app, 'user_geolocations', 'user = {:u}', { u: userId })
    deleteByFilter(app, 'push_subscriptions', 'user = {:u}', { u: userId })
    // The user's own notification inbox.
    deleteByFilter(app, 'notifications', 'recipient = {:u}', { u: userId })

    // Items: delete those nobody ever requested. An item that is still referenced by a
    // conversation cannot be deleted (conversations.requestedItem is a required relation)
    // and must be kept so the counterparty's loan history stays coherent — mark it
    // unavailable instead. Such items are hidden from search/catalogue because the item
    // views exclude rows whose owner is deleted.
    app.findRecordsByFilter('items', 'owner = {:u}', '', 0, 0, { u: userId })
        .filter((r) => !!r)
        .forEach((item) => {
            const referenced = app
                .findRecordsByFilter('conversations', 'requestedItem = {:i}', '', 1, 0, { i: item.id })
                .filter((r) => !!r)
            if (referenced.length === 0) {
                app.delete(item)
            } else {
                item.set('status', 'unavailable')
                app.save(item)
            }
        })

    // 3. Nullify the sender link on notifications this user triggered for OTHERS
    //    (those belong to the recipient and are retained, just de-identified).
    app.findRecordsByFilter('notifications', 'sender = {:u}', '', 0, 0, { u: userId })
        .filter((r) => !!r)
        .forEach((n) => {
            n.set('sender', '')
            app.save(n)
        })

    // 4. Remove the user from every OTHER user's trusts[] (the row survives, so
    //    PocketBase does not auto-clean these references).
    app.findRecordsByFilter('users', 'trusts.id ?= {:u}', '', 0, 0, { u: userId })
        .filter((r) => !!r)
        .forEach((u) => {
            const next = (u.get('trusts') || []).filter((id) => id !== userId)
            u.set('trusts', next)
            app.save(u)
        })

    // 5. Nullify invitedBy on accounts this user invited (avoid "eingeladen von …").
    app.findRecordsByFilter('users', 'invitedBy = {:u}', '', 0, 0, { u: userId })
        .filter((r) => !!r)
        .forEach((u) => {
            u.set('invitedBy', '')
            app.save(u)
        })

    // 6. Anonymize the live user row. username/email get unique, pattern-valid
    //    placeholders (the UI masks them to "Gelöschtes Konto"); the real values now
    //    live only in deleted_accounts. The freed email can be reused for signup.
    userRecord.set('username', 'deleted-' + userId)
    userRecord.set('email', 'deleted-' + userId + '@deleted.invalid')
    userRecord.set('emailVisibility', false)
    userRecord.set('verified', false)
    userRecord.set('bio', '')
    userRecord.set('city', '')
    userRecord.set('trusts', [])
    userRecord.set('invitedBy', '')
    userRecord.set('inviteCode', '')
    userRecord.set('profileImage', '') // clears the uploaded file
    userRecord.set('hasOnboarded', false)
    userRecord.set('deleted', true)
    userRecord.set('deletedAt', now())
    userRecord.setRandomPassword() // invalidate the old credentials

    app.save(userRecord)
}

/**
 * Assemble a machine-readable export of everything the platform stores about the
 * user (GDPR Art. 15 access + Art. 20 portability). Item/profile images are referenced
 * by file name (the caller can resolve URLs) rather than embedded.
 */
function buildExport(app, userRecord) {
    const userId = userRecord.id
    const plain = (records) => records.filter((r) => !!r).map((r) => structuredRecord(r))

    const items = plain(app.findRecordsByFilter('items', 'owner = {:u}', '-created', 0, 0, { u: userId }))
    const conversations = plain(
        app.findRecordsByFilter(
            'conversations',
            'requester = {:u} || itemOwner = {:u}',
            '-created',
            0,
            0,
            { u: userId }
        )
    )
    const messages = plain(
        app.findRecordsByFilter('messages', 'from = {:u} || to = {:u}', 'created', 0, 0, { u: userId })
    )
    const notifications = plain(
        app.findRecordsByFilter('notifications', 'recipient = {:u}', '-created', 0, 0, { u: userId })
    )
    const termAcceptances = plain(
        app.findRecordsByFilter('term_acceptances', 'user = {:u}', '-created', 0, 0, { u: userId })
    )
    const pushSubscriptions = plain(
        app.findRecordsByFilter('push_subscriptions', 'user = {:u}', '', 0, 0, { u: userId })
    )

    let contact = null
    try {
        contact = structuredRecord(app.findFirstRecordByFilter('user_contacts', 'user = {:u}', { u: userId }))
    } catch (_) {}
    let geolocation = null
    try {
        geolocation = structuredRecord(
            app.findFirstRecordByFilter('user_geolocations', 'user = {:u}', { u: userId })
        )
    } catch (_) {}

    // Trust graph: whom the user trusts, and who trusts the user.
    const trusts = userRecord.get('trusts') || []
    const trustedBy = app
        .findRecordsByFilter('users', 'trusts.id ?= {:u}', '', 0, 0, { u: userId })
        .filter((r) => !!r)
        .map((r) => r.id)

    return {
        exportedAt: now(),
        profile: {
            id: userId,
            username: userRecord.get('username'),
            email: userRecord.email(),
            city: userRecord.get('city'),
            bio: userRecord.get('bio'),
            isInstitution: userRecord.getBool('isInstitution'),
            verified: userRecord.getBool('verified'),
            inviteCode: userRecord.get('inviteCode'),
            invitedBy: userRecord.get('invitedBy'),
            profileImage: userRecord.get('profileImage'),
            preferredTransportMode: userRecord.get('preferredTransportMode'),
            created: userRecord.get('created'),
        },
        contact,
        geolocation,
        items,
        conversations,
        messages,
        notifications,
        termAcceptances,
        pushSubscriptions,
        trust: { trusts, trustedBy },
    }
}

/**
 * Convert a PocketBase Record into a plain JS object for export. Uses the record's
 * public (non-hidden) export so internal columns (passwords, tokens) are excluded.
 */
function structuredRecord(record) {
    return JSON.parse(JSON.stringify(record.publicExport()))
}

module.exports = {
    findBlockingLoans,
    anonymizeAccount,
    buildExport,
}
