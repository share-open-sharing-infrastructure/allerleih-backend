/// <reference path="../pb_data/types.d.ts" />

// Privileged contact lookup: resolves a user's telegram/signal handles for the
// authenticated caller, honouring the per-handle "visible to trusted only"
// flags at the data layer. Returns a handle only if it's public (flag off),
// the caller is the owner, or the owner trusts the caller. `*Hidden` signals a
// handle that exists but is withheld (so the UI can show a "trust them" hint).
routerAdd(
    'GET',
    '/api/contact/{userId}',
    (e) => {
        const me = e.auth ? e.auth.id : ''
        const userId = e.request.pathValue('userId')
        const empty = { telegramUsername: null, telegramHidden: false, signalLink: null, signalHidden: false }

        let contact
        try {
            contact = $app.findFirstRecordByFilter('user_contacts', 'user = {:u}', { u: userId })
        } catch (_) {
            return e.json(200, empty)
        }

        let trusted = me === userId
        if (!trusted && me) {
            try {
                // The owner trusts the caller iff a trusts edge {truster: owner, trustee: me} exists.
                $app.findFirstRecordByFilter('trusts', 'truster = {:o} && trustee = {:m}', { o: userId, m: me })
                trusted = true
            } catch (_) {}
        }

        const tg = contact.get('telegramUsername') || ''
        const sig = contact.get('signalLink') || ''
        const tgFlag = !!contact.get('telegramVisibleToTrustedOnly')
        const sigFlag = !!contact.get('signalVisibleToTrustedOnly')

        return e.json(200, {
            telegramUsername: tg !== '' && (!tgFlag || trusted) ? tg : null,
            telegramHidden: tg !== '' && tgFlag && !trusted,
            signalLink: sig !== '' && (!sigFlag || trusted) ? sig : null,
            signalHidden: sig !== '' && sigFlag && !trusted,
        })
    },
    $apis.requireAuth()
)
