/// <reference path="../pb_data/types.d.ts" />

// Drop the contact fields from users — they now live in the owner-only
// user_contacts collection and are served via the /api/contact hook.
migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('users')
        for (const name of [
            'telegramUsername',
            'signalLink',
            'telegramVisibleToTrustedOnly',
            'signalVisibleToTrustedOnly',
        ]) {
            const f = c.fields.getByName(name)
            if (f) c.fields.removeById(f.id)
        }
        app.save(c)
    },
    (app) => {
        const c = app.findCollectionByNameOrId('users')
        c.fields.add(new Field({ type: 'text', name: 'telegramUsername' }))
        c.fields.add(new Field({ type: 'text', name: 'signalLink' }))
        c.fields.add(new Field({ type: 'bool', name: 'telegramVisibleToTrustedOnly' }))
        c.fields.add(new Field({ type: 'bool', name: 'signalVisibleToTrustedOnly' }))
        app.save(c)
    }
)
