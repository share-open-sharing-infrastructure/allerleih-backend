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

In the `share` repo, update `.env` to point at the local backend:

```env
PB_URL="http://127.0.0.1:8090/"
PUBLIC_PB_URL="http://127.0.0.1:8090/"
```

Then start the frontend:

```bash
cd ../share
npm run dev
```

The frontend will now use your local PocketBase instance. Register a new user through the UI or create test data via the admin dashboard.

## Project Structure

```
.
├── package.json               # Prettier config only
├── pb_hooks/                  # Server-side JavaScript hooks
│   ├── main.pb.js             # Bootstrap + log interception
│   ├── notification.pb.js     # Notification hooks (scaffolding)
│   ├── constants.js           # Environment variables & config
│   ├── services/              # Business logic layer
│   │   └── notification.js    # Notification creation service
│   ├── routes/                # Custom API route handlers
│   ├── jobs/                  # Cron/scheduled tasks
│   ├── utils/                 # Shared utilities
│   │   ├── common.js          # Date formatting, helpers
│   │   └── db.js              # wrapTransactional helper
│   └── views/                 # HTML templates (emails, pages)
│       ├── layout.html        # Base HTML email layout
│       └── mail/              # Email templates
└── pb_migrations/             # Schema migrations
    ├── 0000000001_remove_default_users.js   # Removes default users collection
    └── 1781551136_collections_snapshot.js   # Full schema snapshot (19 collections)
```

## Syncing Migrations from Production

When schema changes are made via the PocketBase admin dashboard on the live server, re-export the collections snapshot:

```bash
# On the production server (in the directory containing pb_data/)
./pocketbase migrate collections
```

This generates a new `*_collections_snapshot.js` in `pb_migrations/`. Copy it to this repo and remove the old snapshot:

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

Current coverage — the **groups feature** (37 tests):
- `tests/groups.test.mjs` — trustees-item visibility for owner/member/non-member,
  the search view include/exclude + that it doesn't leak the `groups` column,
  group-deletion fall-back to private, owner-only invite/member management.
- `tests/visibility.test.mjs` — the independent visibility model: trust + group
  as separate audiences, group-only items excluding trustees, public items,
  multi-group sharing, items_public masking of group-only items, and
  group-deletion making a group-only item PRIVATE (never public).
- `tests/invites.test.mjs` — invite-link semantics: maxUses cap, idempotent join,
  owner self-join, expiry, unknown token, revoked invite.
- `tests/members.test.mjs` — inviting people in: owner adds a member directly
  (member gains access), non-owners can't add members, owner removes a member
  (loses access), a member can leave but can't remove others, and member-list
  visibility (owner sees all, a member sees only their own row).
- `tests/edge.test.mjs` — public preview vs. auth-required join, maxUses=0 =
  unlimited, and the unique-membership constraint (no duplicate adds).
- `tests/cascade.test.mjs` — cascadeDelete lifecycle: owner-account deletion
  removes the group + members + invites, member-account deletion removes only
  their membership, group deletion removes its invites, multi-group items aren't
  wrongly flipped, and all group-only items in a deleted group flip to private.
- `tests/conversations.test.mjs` — a conversation participant keeps item access
  after leaving the group (so the chat keeps working) without the item leaking
  back into search/profile; createRule allows members and blocks non-members.

> Requires the `pocketbase` binary in the repo root (the same one used for `serve`).
> Tests run serially (`--test-concurrency=1`) since they share the test port.

## Related

- **Frontend**: [share](../share) — SvelteKit frontend
