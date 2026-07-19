/// <reference path="../pb_data/types.d.ts" />

/**
 * Notification integrity guard.
 *
 * A notification is a cross-user record: it is delivered to `recipient`, who is
 * usually NOT the creator. The collection createRule can only check that the
 * caller is one of sender/recipient/relatedId, which is not enough on its own —
 * so this hook is the authoritative server-side check for every API-created
 * notification. It enforces:
 *
 *   1. the caller is the `sender` (you can only create notifications AS yourself), and
 *   2. the (sender, recipient) pair reflects a real event for the declared `type`:
 *        - conversation types: `relatedId` is a conversation and BOTH sender and
 *          recipient are its participants (requester / itemOwner)
 *        - trust types: a `trusts` edge (truster = sender, trustee = recipient)
 *          exists — this is exactly what both the trust-added flow and the
 *          invite-accepted registration flow create before notifying
 *
 * The frontend creates notifications with the acting user's token right after the
 * triggering action, so every legitimate create satisfies these checks. Server-side
 * creates via `$app.save()` do not go through the request pipeline and are not
 * affected. Keep the type lists in sync with the frontend NotificationType union
 * (allerleih/src/lib/types/models.ts) and the trigger sites wired by
 * add-notification-type.
 */
onRecordCreateRequest((e) => {
    // NOTE: hook handlers run in an isolated context — module-level consts are NOT
    // visible in here, so the type lists must live inside the handler.
    const CONVERSATION_TYPES = [
        'new_message',
        'new_request',
        'request_accepted',
        'request_rejected',
        'handover_confirmed',
        'return_requested',
        'return_confirmed',
    ]
    const TRUST_TYPES = ['trust_added', 'invite_accepted']

    // Superusers and programmatic ($app.save) creates are trusted and skip the
    // guard. An unauthenticated caller must never reach the notifications
    // collection (the createRule also requires auth) — reject defensively so the
    // guard can never be bypassed by the no-auth path.
    if (e.auth && e.auth.isSuperuser()) {
        e.next()
        return
    }
    if (!e.auth) {
        throw new BadRequestError('authentication required')
    }

    const n = e.record
    const sender = n.get('sender')
    const recipient = n.get('recipient')
    const type = n.get('type')
    const relatedId = n.get('relatedId')

    if (sender !== e.auth.id) {
        throw new BadRequestError('notification sender must be the authenticated user')
    }
    if (!recipient || recipient === sender) {
        throw new BadRequestError('notification recipient is invalid')
    }

    if (CONVERSATION_TYPES.indexOf(type) !== -1) {
        let conv
        try {
            conv = $app.findRecordById('conversations', relatedId)
        } catch (_) {
            throw new BadRequestError('notification does not reference a valid conversation')
        }
        const participants = [conv.get('requester'), conv.get('itemOwner')]
        if (participants.indexOf(sender) === -1 || participants.indexOf(recipient) === -1) {
            throw new BadRequestError('notification parties are not participants of the conversation')
        }
    } else if (TRUST_TYPES.indexOf(type) !== -1) {
        try {
            $app.findFirstRecordByFilter('trusts', 'truster = {:s} && trustee = {:r}', {
                s: sender,
                r: recipient,
            })
        } catch (_) {
            throw new BadRequestError('notification requires an existing trust relationship')
        }
    } else {
        // Not part of any legitimate client-side notification flow.
        throw new BadRequestError('unknown notification type')
    }

    e.next()
}, 'notifications')
