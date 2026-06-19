/// <reference path="../pb_data/types.d.ts" />

// The contact visibility flags moved to user_contacts, so drop them from the
// public users_public view (must run before the columns are dropped from users).
migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('users_public')
        c.viewQuery =
            'SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.verified,\n  users.isInstitution,\n  users.profileImage,\n  users.created\nFROM users'
        app.save(c)
    },
    (app) => {
        const c = app.findCollectionByNameOrId('users_public')
        c.viewQuery =
            'SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.verified,\n  users.isInstitution,\n  users.profileImage,\n  users.telegramVisibleToTrustedOnly,\n  users.signalVisibleToTrustedOnly,\n  users.created\nFROM users'
        app.save(c)
    }
)
