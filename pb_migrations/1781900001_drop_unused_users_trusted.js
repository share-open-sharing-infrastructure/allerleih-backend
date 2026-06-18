/// <reference path="../pb_data/types.d.ts" />
migrate(
    (app) => {
        app.delete(app.findCollectionByNameOrId('users_trusted'))
    },
    (app) => {
        // rollback: recreate the view as it was in the snapshot
        const collection = new Collection({
            type: 'view',
            name: 'users_trusted',
            listRule: '@request.auth.id != ""',
            viewRule: '@request.auth.id != ""',
            viewQuery:
                'SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.geolocation,\n  users.profileImage,\n  users.isInstitution,\n  users.trusts\nFROM users',
        })
        app.save(collection)
    }
)
