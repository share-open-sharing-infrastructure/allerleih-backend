---
name: new-migration
description: Scaffold a new PocketBase migration file in pb_migrations/ with the correct unix-timestamp prefix and a migrate(up, down) skeleton. Use when adding a collection, adding/changing a field, changing an access rule, or updating a *_public view. Picks the right template (create-collection / add-field / update-view) and wires up the matching down() revert.
---

# Scaffold a new PocketBase migration

PocketBase applies every file in `pb_migrations/` **in filename order** on `./pocketbase serve`,
tracking applied ones in `pb_data/pb_migrations.json`. A new migration must therefore (a) sort
*after* all existing ones and (b) ship a working `down()` so it can be reverted.

## Step 1 — generate the timestamp prefix

Filenames are `<unix-seconds>_<snake_case_description>.js`. Use the current epoch:

```bash
date +%s
```

Confirm it is greater than the latest existing migration (it will be, unless the clock is wrong):

```bash
ls pb_migrations/ | sed -E 's/_.*//' | sort -n | tail -1
```

If you are scaffolding **several migrations in one batch**, increment the timestamp by 1 per file
so their order is deterministic and matches their dependency order (e.g. create `groups` before a
rule that references `group_members`).

## Step 2 — name it

`<ts>_<verb>_<subject>.js`, snake_case, matching the existing style:
`1781900040_created_groups.js`, `1781900044_items_groups_field_and_rule.js`,
`1781900049_items_public_mask_grouped.js`.

## Step 3 — pick the template

### A. Create a collection

```javascript
migrate((app) => {
  const collection = new Collection({
    name: 'COLLECTION_NAME',
    id: 'pbc_STABLE_ID',          // stable explicit id; other migrations/relations reference it
    type: 'base',                 // or 'view' (then set viewQuery instead of fields)
    listRule:   '@request.auth.id = owner',
    viewRule:   '@request.auth.id = owner',
    createRule: '@request.auth.id = owner',
    updateRule: '@request.auth.id = owner',
    deleteRule: '@request.auth.id = owner',
    fields: [
      { name: 'name',  type: 'text', required: true },
      { name: 'owner', type: 'relation', collectionId: 'hbacudkt08pfcy3', cascadeDelete: true }, // users
      { name: 'created', type: 'autodate', onCreate: true },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
    indexes: [
      // 'CREATE UNIQUE INDEX `idx_NAME` ON `COLLECTION_NAME` (`colA`, `colB`)',
    ],
  })
  return app.save(collection)
}, (app) => {
  return app.delete(app.findCollectionByNameOrId('pbc_STABLE_ID'))
})
```

### B. Add / change a field on an existing collection

```javascript
migrate((app) => {
  const c = app.findCollectionByNameOrId('pbc_TARGET')
  c.fields.add(new Field({
    id: 'FIELD_STABLE_ID',
    name: 'isPublic',
    type: 'bool',        // text | bool | number | date | select | relation | json | file | autodate
    required: false,
  }))
  return app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId('pbc_TARGET')
  c.fields.removeById('FIELD_STABLE_ID')   // or restore the previous definition
  return app.save(c)
})
```

### C. Change an access rule

Keep the *old* rule string in the `down()` so the revert restores it exactly.

```javascript
const NEW_RULE = '@request.auth.id != "" && (trusteesOnly = false || @request.auth.id = owner)'
const OLD_RULE = '@request.auth.id != "" && trusteesOnly = false'

migrate((app) => {
  const c = app.findCollectionByNameOrId('pbc_TARGET')
  c.listRule = NEW_RULE
  c.viewRule = NEW_RULE
  return app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId('pbc_TARGET')
  c.listRule = OLD_RULE
  c.viewRule = OLD_RULE
  return app.save(c)
})
```

### D. Update a `*_public` masking view

Views are SQL. **Prefer a targeted append/replace on the existing `viewQuery` over assigning a
whole new SELECT**, guarded by an `includes()` check so re-running is a no-op:

```javascript
migrate((app) => {
  const c = app.findCollectionByNameOrId('pbc_VIEW_ID')
  if (!c.viewQuery.includes('items.created')) {
    c.viewQuery = c.viewQuery.replace('items.updated,', 'items.updated, items.created,')
    app.save(c)   // re-syncs the view's fields from the new SELECT
  }
}, (app) => {
  const c = app.findCollectionByNameOrId('pbc_VIEW_ID')
  c.viewQuery = c.viewQuery.replace('items.updated, items.created,', 'items.updated,')
  app.save(c)
})
```

> **Wholesale `c.viewQuery = SELECT` silently drops whatever else is on the view.** This is not
> hypothetical — it caused **#624**: `1781900042` appended
> `WHERE COALESCE(users.deleted, 0) = 0` to `items_public` + `items_searchable` so a deleted
> account's retained items stay out of discovery, and four migrations then reassigned
> `viewQuery` without carrying it over — `1781900045` for `items_searchable`, then `1781900049`,
> `1782750000` and `1783800001` for `items_public` — putting anonymized users' items back in the
> guest catalogue and in search. If you *must* replace the whole query (a
> restructured SELECT), re-append every standing clause in the same migration and check the
> live query first: `app.findCollectionByNameOrId('items_public').viewQuery`.

**Masking views must return NULL for sensitive fields of restricted items** — see
`1781900049_items_public_mask_grouped.js` for the canonical masking pattern, and `CLAUDE.md` →
"Access control & the public views" for what must stay masked and which clauses are standing
invariants.

```javascript
// Wholesale replacement — only when a targeted replace() won't do. Keep the previous SELECT
// verbatim for down(), and carry over the standing WHERE clause (see the warning above).
const MASK = "(items.trusteesOnly OR (items.groups != '' AND items.groups != '[]'))"
const SELECT = [
  'SELECT',
  '  items.id,',
  `  (CASE WHEN ${MASK} THEN NULL ELSE items.name END) AS name,`,
  '  items.status, items.categories, items.updated',
  'FROM items',
  'LEFT JOIN users on items.owner = users.id',
  'WHERE COALESCE(users.deleted, 0) = 0',
].join('\n')

migrate((app) => {
  const c = app.findCollectionByNameOrId('pbc_VIEW_ID')
  c.viewQuery = SELECT
  return app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId('pbc_VIEW_ID')
  c.viewQuery = '/* previous SELECT here, verbatim */'
  return app.save(c)
})
```

## Step 4 — verify it applies

Migrations run on serve, but the fastest check is the test suite (fresh DB, all migrations + hooks):

```bash
npm test
```

Or apply against the live DB by starting the server:

```bash
./pocketbase serve --http=0.0.0.0:8090
```

## Checklist before finishing

- [ ] Timestamp prefix is greater than every existing migration
- [ ] `down()` exactly reverts `up()` (delete what you created, restore the old rule/field)
- [ ] Relations reference the right `collectionId` (`users` = `hbacudkt08pfcy3`)
- [ ] `cascadeDelete` set deliberately — remember DB-level cascades do **not** fire hooks
- [ ] If item/user visibility changed, the matching `items_public` / `users_public` / `items_searchable` view was updated too
- [ ] If you touched a view's `viewQuery`, the standing clauses survived — above all
      `WHERE COALESCE(users.deleted, 0) = 0` on both item views (#624). Prefer append/replace;
      `npm test` catches a dropped clause via `tests/deleted-owner-items.test.mjs`
- [ ] Coordinated with the frontend — run the **`schema-change`** skill in `~/allerleih` to keep `src/lib/types/models.ts`, `docs/data-model.md`, and the public-view leak check in lockstep
