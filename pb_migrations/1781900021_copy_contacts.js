/// <reference path="../pb_data/types.d.ts" />

// Copy telegram/signal handles + their visibility flags from users into the
// owner-only user_contacts collection. Idempotent: skips users already migrated
// and users with no handles.
migrate(
    (app) => {
        const col = app.findCollectionByNameOrId('user_contacts')
        const users = app.findAllRecords('users')
        for (const u of users) {
            const tg = u.get('telegramUsername')
            const sig = u.get('signalLink')
            if (!tg && !sig) continue
            try {
                app.findFirstRecordByFilter('user_contacts', 'user = {:u}', { u: u.id })
                continue // already migrated
            } catch (_) {
                // not present yet — create it
            }
            const rec = new Record(col)
            rec.set('user', u.id)
            rec.set('telegramUsername', tg || '')
            rec.set('signalLink', sig || '')
            rec.set('telegramVisibleToTrustedOnly', !!u.get('telegramVisibleToTrustedOnly'))
            rec.set('signalVisibleToTrustedOnly', !!u.get('signalVisibleToTrustedOnly'))
            app.save(rec)
        }
    },
    (app) => {
        // down: no-op (data copy is not reversed)
    }
)
