---
paths:
  - "pb_migrations/**"
---

# Migration conventions

Filename: `<timestamp>_<snake_case_description>.js`. The timestamp prefix only controls **apply
order** — it must be greater than every existing migration so new migrations run last. Each
migration is `migrate(up, down)`. Prefer the `/new-migration` skill to scaffold one; it picks the
right template and wires up the matching `down()`.

```javascript
migrate((app) => {          // UP — apply
  const collection = new Collection({
    name: 'groups',
    id: 'pbc_groups00001',  // stable explicit IDs; relations reference these
    type: 'base',
    listRule:   '@request.auth.id = owner',
    viewRule:   '@request.auth.id = owner',
    createRule: '@request.auth.id = owner',
    updateRule: '@request.auth.id = owner',
    deleteRule: '@request.auth.id = owner',
    fields: [
      { name: 'name',  type: 'text', required: true },
      { name: 'owner', type: 'relation', collectionId: 'hbacudkt08pfcy3', cascadeDelete: true },
      { name: 'created', type: 'autodate', onCreate: true },
    ],
    indexes: ['CREATE UNIQUE INDEX `idx_x` ON `groups` (`name`, `owner`)'],
  })
  return app.save(collection)
}, (app) => {               // DOWN — revert (mirror the up exactly)
  return app.delete(app.findCollectionByNameOrId('pbc_groups00001'))
})
```

- **Never edit a migration that has already applied/shipped** — write a new migration instead.
  Only edit the most recent, unshipped migration in your own branch.
- **Add a field to an existing collection** by fetching it, `collection.fields.add(new Field({...}))`,
  and `app.save(collection)`. Always provide a matching `down`.
- **`users` collection id is `hbacudkt08pfcy3`** — relations to users reference this id.
- **Ordering dependencies are real**: a collection must be created before another collection or an
  access rule references it (e.g. `group_members` before any rule that traverses it). Keep
  dependent migrations in the correct timestamp order.
- **`*_public` views are migrations too**: set `collection.viewQuery = '<SELECT ...>'` and
  `app.save(collection)`. See `CLAUDE.md` → "Access control & the public views" for what must
  stay masked.

## Item categories

The `items` collection's `categories` select values are **fixed and shared across all
instances** (share-mvp issue #472) and must equal `ITEM_CATEGORIES` in share-mvp
`src/lib/categories.ts`. The backend's canonical copy lives in `tests/categories.test.mjs`
(`CANONICAL_CATEGORIES`), which asserts the live schema — base collection and the
`items_public` / `items_searchable` view field metadata — against it, so drift fails the test
suite. To change the list: write a migration updating the `items` select `values` (never edit
the historical snapshot/view migrations; the views re-derive their metadata from the base
column and need no migration), update `CANONICAL_CATEGORIES`, and follow the full cross-repo
checklist in share-mvp `docs/data-model.md` → "Item categories".
