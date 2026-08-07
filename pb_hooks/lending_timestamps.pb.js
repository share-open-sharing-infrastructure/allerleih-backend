/// <reference path="../pb_data/types.d.ts" />

// Business-metrics project: `acceptedAt` / `completedAt` on `conversations` are
// SERVER-OWNED on every path — stamped the first time lendingStatus transitions into
// 'accepted' / 'completed', and any client-supplied value is discarded. The
// conversations updateRule only restricts the two *LastSeenAt fields (see
// 1782500002_conversations_restrict_lastseen_fields.js); it does not enumerate the full
// field surface, so without this a request could forge either timestamp.
//
// Two lifecycle hooks are needed because neither event alone covers both write paths:
//   - onRecordUpdate  fires on EVERY save path (frontend lending actions, admin UI,
//     direct API PATCHes, other hooks' elevated $app.save()) — no update can skip it.
//   - onRecordCreate  onRecordUpdate does NOT fire on create, so a conversation POSTed
//     straight to the API with a forged acceptedAt/completedAt would keep it verbatim.
//
// Idempotent: once stamped, a value is never overwritten. Aborting an accepted request
// and later re-accepting it keeps the FIRST acceptedAt — "when did it first reach this
// state", not "most recently".

onRecordUpdate((e) => {
    const { now } = require(`${__hooks}/utils/common.js`)
    const orig = e.record.original()

    const origAcceptedAt = orig.getString('acceptedAt')
    const origCompletedAt = orig.getString('completedAt')
    e.record.set('acceptedAt', origAcceptedAt)
    e.record.set('completedAt', origCompletedAt)

    const prevStatus = orig.getString('lendingStatus')
    const nextStatus = e.record.getString('lendingStatus')

    if (nextStatus === 'accepted' && prevStatus !== 'accepted' && !origAcceptedAt) {
        e.record.set('acceptedAt', now())
    }
    if (nextStatus === 'completed' && prevStatus !== 'completed' && !origCompletedAt) {
        e.record.set('completedAt', now())
    }

    e.next()
}, 'conversations')

// Create path: there is no persisted "original" to fall back to, so both timestamps are
// derived purely from the created status, never from the client payload. A conversation
// is normally created 'pending' (both frontend create sites do), so in practice this
// stamps nothing — it exists so a direct POST cannot forge either field.
onRecordCreate((e) => {
    const { now } = require(`${__hooks}/utils/common.js`)
    // "accepted-like" = accepted onward; 'completed' implies it went through acceptance
    // too. Defined inside the handler: top-level bindings aren't in scope here (each
    // hook runs in its own isolated JSVM context — see CLAUDE.md).
    const acceptedLike = ['accepted', 'active', 'return_requested', 'completed']
    const status = e.record.getString('lendingStatus')
    e.record.set('acceptedAt', acceptedLike.indexOf(status) !== -1 ? now() : '')
    e.record.set('completedAt', status === 'completed' ? now() : '')
    e.next()
}, 'conversations')

// A non-superuser (i.e. the app) may only ever CREATE a conversation in 'pending': the
// frontend never creates any other status, and the lending state machine assumes a
// request starts pending. Forcing it here stops a direct API POST from seeding a
// conversation straight into accepted/completed — which would otherwise inflate the
// metrics counts (including the now-public /misc/stats + landing-page numbers) and skip
// the accept flow's item reservation. Superuser / $app creates (seed scenarios, admin
// tooling) keep full control, mirroring the superuser-skip in notification_guard.pb.js.
onRecordCreateRequest((e) => {
    if (e.auth && e.auth.isSuperuser()) {
        e.next()
        return
    }
    const status = e.record.getString('lendingStatus')
    if (status && status !== 'pending') {
        e.record.set('lendingStatus', 'pending')
    }
    e.next()
}, 'conversations')
