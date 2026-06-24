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

## Related

- **Frontend**: [share](../share) — SvelteKit frontend
