/// <reference path="../../pb_data/types.d.ts" />

// Group invite helpers. Kept in a required module because PocketBase runs each
// routerAdd handler in its own isolated JS context — top-level functions in the
// hook file aren't visible inside the handler, so shared logic must be required
// in from a module instead.

function nowIso() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000Z'
}

// Resolve a token to its invite record. Returns { invite, reason } where reason
// is null when usable, or 'not_found' | 'expired' | 'used_up'.
function resolveInvite(token) {
    let invite
    try {
        invite = $app.findFirstRecordByFilter('group_invites', 'token = {:t}', { t: token })
    } catch (_) {
        return { invite: null, reason: 'not_found' }
    }

    const expiresAt = invite.getString('expiresAt')
    // Same ISO-like format on both sides -> lexicographic compare is valid.
    if (expiresAt && expiresAt < nowIso()) {
        return { invite, reason: 'expired' }
    }

    const maxUses = Number(invite.get('maxUses')) || 0
    const uses = Number(invite.get('uses')) || 0
    if (maxUses > 0 && uses >= maxUses) {
        return { invite, reason: 'used_up' }
    }

    return { invite, reason: null }
}

module.exports = { resolveInvite }
