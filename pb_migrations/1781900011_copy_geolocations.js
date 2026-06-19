/// <reference path="../pb_data/types.d.ts" />

// Copy existing users.geolocation into the owner-only user_geolocations
// collection. Idempotent: skips users that already have an entry.
migrate(
    (app) => {
        const col = app.findCollectionByNameOrId('user_geolocations')
        const users = app.findAllRecords('users')
        for (const u of users) {
            let geo
            try {
                geo = JSON.parse(JSON.stringify(u.get('geolocation')))
            } catch (_) {
                geo = null
            }
            if (!geo || (geo.lon === 0 && geo.lat === 0)) continue
            try {
                app.findFirstRecordByFilter('user_geolocations', 'user = {:u}', { u: u.id })
                continue // already migrated
            } catch (_) {
                // not yet present — create it
            }
            const rec = new Record(col)
            rec.set('user', u.id)
            rec.set('geolocation', geo)
            app.save(rec)
        }
    },
    (app) => {
        // down: no-op (data copy is not reversed; the collection drop handles cleanup)
    }
)
