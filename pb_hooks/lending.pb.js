/// <reference path="../pb_data/types.d.ts" />

// Request-abort guard for conversations (#373). A conversation participant may
// *abort* a request that is still `pending` or `accepted`; `aborted` is a new
// terminal lendingStatus. This is the tamper-proof source of truth — the
// SvelteKit `abortRequest` action mirrors these checks for UX, but a direct API
// PATCH cannot bypass them.
//
// This hook only intercepts the abort transition. Every other conversations
// update (messages, read flags, lastSeenAt, and the owner/requester-driven
// forward transitions handled by the frontend lending actions) passes straight
// through via e.next().
//
// Rules enforced here:
//   - caller must be a participant (requester OR itemOwner). Role gating in the
//     UI (in `pending` only the requester sees the button) is a frontend concern;
//     the data layer allows either party to abort from either abortable state.
//   - previous status must be 'pending' or 'accepted' (forbidden from
//     active/return_requested/completed/rejected, and from 'aborted' itself).
//   - on `accepted -> aborted` the requested item — which acceptRequest set to
//     'unavailable' — is reset to 'available' so it can be requested again. This
//     runs in the hook's elevated context, so it works even when the aborting
//     party is the non-owner requester (who cannot update the owner's item via
//     the API). The item reset and the conversation save share ONE transaction
//     (e.app is re-pointed at the tx app so e.next() persists within it), so both
//     commit or roll back together.
//
// NOTE: hooks run in isolated contexts, but this handler needs no shared
// require()s.
onRecordUpdateRequest((e) => {
    const next = e.record.get('lendingStatus')
    const prev = e.record.original().get('lendingStatus')

    // Only intercept an actual TRANSITION into 'aborted'. Any other update passes
    // through untouched — including benign updates to an ALREADY-aborted
    // conversation (periodic lastSeenAt pings, readByRequester/readByOwner), whose
    // lendingStatus stays 'aborted' and must not be re-validated (that would throw
    // a persistent 400 on routine viewing of an aborted conversation).
    if (next !== 'aborted' || prev === 'aborted') {
        e.next()
        return
    }

    // Caller must be a participant of the conversation.
    const callerId = e.auth ? e.auth.id : ''
    const isParticipant =
        callerId !== '' &&
        (callerId === e.record.get('requester') || callerId === e.record.get('itemOwner'))
    if (!isParticipant) {
        throw new ForbiddenError('Nur Beteiligte können diese Anfrage abbrechen.')
    }

    // Abort is only legal from 'pending' or 'accepted'.
    if (prev !== 'pending' && prev !== 'accepted') {
        throw new BadRequestError('Diese Anfrage kann im aktuellen Status nicht abgebrochen werden.')
    }

    // SECURITY: derive the item to free from the PERSISTED record, never from the
    // incoming payload. `requestedItem` is client-writable in a PATCH (the
    // updateRule only pins the *LastSeenAt fields), so trusting e.record.get()
    // here would let a participant repoint the relation at an arbitrary victim
    // item and, via the elevated reset below (which bypasses the items owner-only
    // updateRule), flip that victim to 'available' — un-reserving someone else's
    // loan. Defense-in-depth: also reject the request outright if the payload
    // tried to change requestedItem during an abort.
    const origItemId = e.record.original().get('requestedItem')
    if (e.record.get('requestedItem') !== origItemId) {
        throw new BadRequestError('Der Gegenstand einer Anfrage kann beim Abbrechen nicht geändert werden.')
    }

    // pending -> aborted: nothing was reserved, just persist the status change.
    if (prev !== 'accepted') {
        e.next()
        return
    }

    // accepted -> aborted: free the persisted item (acceptRequest set it
    // 'unavailable'). Do the item reset and the conversation save atomically in
    // one transaction.
    e.app.runInTransaction((txApp) => {
        if (origItemId) {
            // Resolve the item first, tolerating ONLY a missing item (deleted): in
            // that case there is nothing to free, so skip the reset and let the
            // abort proceed rather than trapping the conversation in 'accepted'
            // forever. Any OTHER lookup error is re-thrown. Crucially the set/save
            // runs OUTSIDE this try, so a genuine save failure (validation /
            // transient DB error) propagates and rolls the whole transaction back —
            // the conversation must never commit as 'aborted' while the item stays
            // 'unavailable'.
            let item = null
            try {
                item = txApp.findRecordById('items', origItemId)
            } catch (err) {
                const msg = String(err)
                if (!msg.includes('no rows') && !msg.includes('not found')) throw err
                txApp.logger().warn('[lending-abort] requested item no longer exists; skipping status reset', 'item', origItemId, 'error', msg)
            }
            if (item) {
                item.set('status', 'available')
                txApp.save(item)
            }
        }
        // Re-point the request app at the transaction app so the main record
        // persistence performed by e.next() joins the same transaction.
        e.app = txApp
        e.next()
    })
}, 'conversations')
