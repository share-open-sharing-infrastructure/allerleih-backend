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

Views are SQL. Build the SELECT as a joined array of lines (matches existing style) and set
`viewQuery`. **Masking views must return NULL for sensitive fields of restricted items** — see
`1781900049_items_public_mask_grouped.js` for the canonical pattern, and `CLAUDE.md` →
"Access control & the public views" for what must stay masked.

```javascript
const SELECT = [
  'SELECT',
  '  items.id,',
  "  (CASE WHEN items.trusteesOnly THEN NULL ELSE items.name END) AS name,",
  '  items.status, items.categories, items.updated',
  'FROM items',
].join('\n')

migrate((app) => {
  const c = app.findCollectionByNameOrId('pbc_VIEW_ID')
  c.viewQuery = SELECT
  return app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId('pbc_VIEW_ID')
  c.viewQuery = '/* previous SELECT here */'
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
- [ ] Coordinated with the frontend — run the **`schema-change`** skill in `~/allerleih` to keep `src/lib/types/models.ts`, `docs/data-model.md`, and the public-view leak check in lockstep
