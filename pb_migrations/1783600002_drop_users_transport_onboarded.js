/// <reference path="../pb_data/types.d.ts" />

// Issue #426 step 3 of 3: drop `preferredTransportMode` + `hasOnboarded` from users.
// Must run LAST — after the copy (1783600001). The frontend reads/writes these via
// `user_preferences` from this point on. down() re-adds them with the exact baseline
// field config (from 1781551136_collections_snapshot.js); 1783600001.down then
// repopulates them from the prefs rows.
migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('hbacudkt08pfcy3')
        const tm = c.fields.getByName('preferredTransportMode')
        if (tm) c.fields.removeById(tm.id)
        const ob = c.fields.getByName('hasOnboarded')
        if (ob) c.fields.removeById(ob.id)
        app.save(c)
    },
    (app) => {
        const c = app.findCollectionByNameOrId('hbacudkt08pfcy3')
        c.fields.add(new Field({
            "hidden": false,
            "id": "select1776134756",
            "maxSelect": 1,
            "name": "preferredTransportMode",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "select",
            "values": [
                "car",
                "bicycle",
                "foot"
            ]
        }))
        c.fields.add(new Field({
            "hidden": false,
            "id": "bool2155960915",
            "name": "hasOnboarded",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "bool"
        }))
        app.save(c)
    }
)
