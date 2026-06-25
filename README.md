# allerleih-backend

PocketBase backend for [AllerLeih](https://allerleih.org) — the sharing/lending platform.

## Architecture

This project uses PocketBase's **"Zero-Go, JavaScript Hooks"** approach:
- No custom Go code required
- Downloads the official PocketBase binary
- Business logic lives in `pb_hooks/` (auto-loaded JS files)
- Schema is version-controlled in `pb_migrations/` (auto-applied on start)

## Quick Start

### 1. Download PocketBase

```bash
# macOS (Apple Silicon)
wget https://github.com/pocketbase/pocketbase/releases/download/v{VERSION}/pocketbase_{VERSION}_darwin_arm64.zip
unzip pocketbase_{VERSION}_darwin_arm64.zip
chmod +x pocketbase

# Or Linux (amd64)
wget https://github.com/pocketbase/pocketbase/releases/download/v{VERSION/pocketbase_{VERSION}_linux_amd64.zip
unzip pocketbase_{VERSION}_linux_amd64.zip
chmod +x pocketbase
```

### 2. Start PocketBase

```bash
./pocketbase serve
```

PocketBase will:
1. Create `pb_data/` (SQLite database + file uploads)
2. Apply all migrations from `pb_migrations/`
3. Load all hooks from `pb_hooks/`
4. Start the API on http://127.0.0.1:8090
5. Admin UI available at http://127.0.0.1:8090/_/

### 3. Create a superuser

```bash
./pocketbase superuser upsert YOUR_EMAIL YOUR_PASSWORD
```

Or visit the admin UI at `http://127.0.0.1:8090/_/` on first run.

### 4. Connect the SvelteKit frontend

In the frontend repo (`allerleih`), update `.env` to point at the local backend:

```env
PUBLIC_PB_URL="http://127.0.0.1:8090/"
```

Then start the frontend:

```bash
cd ../allerleih
npm run dev
```

The frontend will now use your local PocketBase instance. Register a new user through the UI or create test data via the admin dashboard.

## Environment variables

The hooks read configuration from environment variables (centralised in
[`pb_hooks/constants.js`](pb_hooks/constants.js)). Set them in the environment of
the `pocketbase serve` process — e.g. `ORS_API_KEY=... ./pocketbase serve` locally,
or via the service/deployment config in production.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ORS_API_KEY` | **yes, for travel times** | — | OpenRouteService key used by the `/api/travel-times` hook. **Without it travel times silently stop working** (ORS rejects every request); the hook logs an error on each attempt. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | for Web Push | — | VAPID keypair for push notifications. |
| `VAPID_SUBJECT` | no | `mailto:allerleih@posteo.de` | VAPID subject (mailto: or https: URI). |
| `LOG_LEVEL` | no | `4` | Log verbosity: 1=DEBUG, 2=INFO, 3=WARN, 4=ERROR. |
| `DRY_MODE` | no | `false` | When `true`, suppresses side effects such as outbound email. |
| `MAIL_THROTTLE_MINUTES` | no | `15` | Max one notification email per recipient within this window. |

> **Note:** travel-time computation moved from the frontend into this backend
> hook, so `ORS_API_KEY` must be present **here** (the frontend still needs its
> own `ORS_API_KEY` for address autocomplete via `/api/geocode`).

## Project Structure

```
.
├── package.json               # Prettier config only
├── pb_hooks/                  # Server-side JavaScript hooks
│   ├── main.pb.js             # Bootstrap + log interception
│   ├── *.pb.js                # Custom route handlers / record hooks, one per area
│   │                          #   (group.pb.js, invite.pb.js, contact.pb.js, travel.pb.js, notification.pb.js)
│   ├── constants.js           # Environment variables & config
│   ├── services/              # Business logic layer (group.js, mail.js, notification.js)
│   ├── routes/                # (placeholder.js — actual routes are registered in the *.pb.js files above)
│   ├── jobs/                  # (placeholder.js — no scheduled jobs yet)
│   ├── utils/                 # Shared utilities
│   │   ├── common.js          # Date formatting, helpers
│   │   └── db.js              # wrapTransactional helper
│   └── views/                 # HTML templates
│       ├── layout.html        # Base HTML email layout
│       └── mail/              # Email templates (e.g. new_message.html)
└── pb_migrations/             # Schema migrations (auto-applied on start)
    ├── 0000000001_remove_default_users.js   # Removes default users collection
    ├── 1781551136_collections_snapshot.js   # Baseline schema snapshot (19 collections in the file)
    └── …                                    # later migrations add user_geolocations, user_contacts,
                                             #   groups, group_members, group_invites, etc.
```

## Writing migrations

Migrations live in `pb_migrations/` and are **applied in filename order on `pocketbase serve`**.
Each file exports an up and a down function:

```js
/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => { /* up:   apply the change   */ },
  (app) => { /* down: revert the change  */ }
);
```

Conventions:

- **Filename:** `<unix-seconds>_<snake_case_description>.js`. The numeric prefix must be **greater
  than every existing migration** so it runs last — use the current Unix timestamp (`date +%s`).
- **Always provide the down function** so the migration is reversible.
- **Make it idempotent** where practical (guard with an `if` so re-running is a no-op), and keep
  up/down exact inverses.

### Editing a view (e.g. adding a sortable column)

A SQL view (`items_public`, `items_searchable`) returns **only the columns in its `viewQuery`
SELECT**. To expose a new column, change the `viewQuery` and **re-save** the collection —
PocketBase re-derives the view's field list from the new SELECT automatically (no manual field
definitions needed). Prefer a **string-append/replace** over rewriting the whole query, so the
migration survives other branches' changes to the same view (e.g. an appended `WHERE`):

```js
migrate(
  (app) => {
    const v = app.findCollectionByNameOrId('items_searchable');
    if (!v.viewQuery.includes('items.created')) {
      v.viewQuery = v.viewQuery.replace('items.updated,', 'items.updated, items.created,');
      app.save(v); // re-syncs the view's fields, adding `created`
    }
  },
  (app) => {
    const v = app.findCollectionByNameOrId('items_searchable');
    v.viewQuery = v.viewQuery.replace('items.updated, items.created,', 'items.updated,');
    app.save(v);
  }
);
```

A view's access rules reference field *names*, so adding a column leaves existing rules valid.
After a view change, update the column table in the frontend's `docs/data-model.md` so the docs
and the `ItemPublic` TS type stay honest.

### Apply & verify locally

```bash
./pocketbase serve          # applies pending migrations on start
# verify a view column / sort works:
curl 'http://127.0.0.1:8090/api/collections/items_searchable/records?sort=-created&perPage=3'
```

To reverse the most recent migration(s) during development: `./pocketbase migrate down 1`.

## Syncing Migrations from Production

When schema changes are made via the PocketBase admin dashboard on the live server, re-export the collections snapshot:

```bash
# On the production server (in the directory containing pb_data/)
./pocketbase migrate collections
```

This generates a new `*_collections_snapshot.js` in `pb_migrations/`. Copy it into
this repo's `pb_migrations/`, delete the previous `*_collections_snapshot.js` (keep
only the newest one), and commit the change.

## Testing

Integration tests live in `tests/` and run against a **real, throwaway PocketBase
instance** — so they exercise the actual migrations, collection rules and JS hooks
end-to-end (none of which can be unit-tested in isolation). No dependencies: they
use Node's built-in test runner (`node:test`) and `fetch`.

```bash
npm test
```

How it works (`tests/harness.mjs`):
- wipes `pb_test_data/` and starts a fresh instance on port **8091** (your dev
  instance on 8090 is untouched), which auto-applies `pb_migrations/` and loads
  `pb_hooks/`;
- creates a superuser, seeds verified test users, and exposes small `api()` /
  `makeUser()` helpers;
- tears the instance down and removes `pb_test_data/` afterwards.

Current coverage — the **groups feature** (45 tests). Round 2 added a
`group_members.role` (`admin`/`member`, with the owner stored as an `admin` member)
and public/self-join groups (`groups.isPublic`); the suites below cover both.
- `tests/groups.test.mjs` — trustees-item visibility for owner/member/non-member,
  the search view include/exclude + that it doesn't leak the `groups` column,
  group-deletion fall-back to private, owner-only invite/member management.
- `tests/visibility.test.mjs` — the independent visibility model: trust + group
  as separate audiences, group-only items excluding trustees, public items,
  multi-group sharing, items_public masking of group-only items, group-deletion
  making a group-only item PRIVATE (never public), and the owner (as an admin
  member) seeing an item a member shared with the owner's group.
- `tests/invites.test.mjs` — invite-link semantics: maxUses cap, idempotent join,
  owner self-join, expiry, unknown token, revoked invite.
- `tests/members.test.mjs` — inviting people in: owner adds a member directly
  (member gains access), non-owners can't add members, owner removes a member
  (loses access), a member can leave but can't remove others; every member sees
  the full roster, the owner is an `admin` member (added members are `member`s),
  and the owner cannot remove their own admin row.
- `tests/public-groups.test.mjs` — public/self-join groups: a non-member can read
  a public group (name + description) but not a private one; a user can self-join
  a public group and then see its items; self-join is rejected for private groups,
  cannot add someone other than yourself, and cannot grant yourself `role=admin`.
- `tests/edge.test.mjs` — public preview vs. auth-required join, maxUses=0 =
  unlimited, and the unique-membership constraint (no duplicate adds).
- `tests/cascade.test.mjs` — cascadeDelete lifecycle: owner-account deletion
  removes the group + members + invites, member-account deletion removes only
  their membership, group deletion removes its invites, multi-group items aren't
  wrongly flipped, all group-only items in a deleted group flip to private, and an
  invited member lands with `role=member`.
- `tests/conversations.test.mjs` — the conversation **requester** keeps item access
  after being removed from the group (so the chat keeps working) without the item
  leaking back into search/profile; createRule allows members and blocks non-members.

> Requires the `pocketbase` binary in the repo root (the same one used for `serve`).
> Tests run serially (`--test-concurrency=1`) since they share the test port.

## Related

- **Frontend**: [share](../share) — SvelteKit frontend
