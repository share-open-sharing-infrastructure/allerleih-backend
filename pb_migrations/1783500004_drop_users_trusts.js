/// <reference path="../pb_data/types.d.ts" />

// Drop the now-unused users.trusts[] multi-relation. Must run LAST: after the data
// copy (1783500002) and after every rule that traversed it was repointed at the
// `trusts` join (1783500003). down re-adds the field (mirroring the baseline
// snapshot config) and repopulates it from the join rows, so a single
// `migrate down 1` fully restores the old shape.
migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('hbacudkt08pfcy3')
        const f = c.fields.getByName('trusts')
        if (f) c.fields.removeById(f.id)
        app.save(c)
    },
    (app) => {
        const c = app.findCollectionByNameOrId('hbacudkt08pfcy3')
        c.fields.add(new Field({
            "cascadeDelete": false,
            "collectionId": "hbacudkt08pfcy3",
            "hidden": false,
            "id": "ng0aklsf",
            "maxSelect": 2147483647,
            "minSelect": 0,
            "name": "trusts",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "relation"
        }))
        app.save(c)

        // Rebuild the arrays from the join rows (which still exist at this point).
        const users = app.findAllRecords('users')
        for (const u of users) {
            const rows = app
                .findRecordsByFilter('trusts', 'truster = {:u}', '', 0, 0, { u: u.id })
                .filter((r) => !!r)
            if (rows.length === 0) continue
            u.set('trusts', rows.map((r) => r.get('trustee')))
            app.save(u)
        }
    }
)
