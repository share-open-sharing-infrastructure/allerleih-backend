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
wget https://github.com/pocketbase/pocketbase/releases/download/v0.39.3/pocketbase_0.39.3_darwin_arm64.zip
unzip pocketbase_0.39.3_darwin_arm64.zip
chmod +x pocketbase

# Or Linux (amd64)
wget https://github.com/pocketbase/pocketbase/releases/download/v0.39.3/pocketbase_0.39.3_linux_amd64.zip
unzip pocketbase_0.39.3_linux_amd64.zip
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

> **Note:** Remember to restore the production URLs when done:
> ```env
> PB_URL="https://pocketbase.menkent.uber.space/"
> PUBLIC_PB_URL="https://pocketbase.menkent.uber.space/"
> ```

## Project Structure

```
.
├── Containerfile              # Container build for deployment
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

## Hooks Architecture

Hook files (`*.pb.js`) are auto-loaded by PocketBase. They follow this pattern:

| Layer | Directory | Purpose |
|-------|-----------|---------|
| Registration | `pb_hooks/*.pb.js` | Hook/route/cron registration (thin controllers) |
| Services | `pb_hooks/services/` | Business logic (validation, side effects) |
| Routes | `pb_hooks/routes/` | Custom API endpoint handlers |
| Jobs | `pb_hooks/jobs/` | Scheduled task implementations |
| Utils | `pb_hooks/utils/` | Shared helpers (DB transactions, formatting) |
| Views | `pb_hooks/views/` | HTML templates for emails |

### Hook Types Available

```javascript
// Record lifecycle hooks
onRecordCreateExecute((e) => { ... }, 'collection_name')
onRecordUpdateExecute((e) => { ... }, 'collection_name')
onRecordDeleteExecute((e) => { ... }, 'collection_name')

// After-success hooks (for side effects like notifications)
onRecordAfterCreateSuccess((e) => { ... }, 'collection_name')
onRecordAfterUpdateSuccess((e) => { ... }, 'collection_name')

// Request validation hooks
onRecordCreateRequest((e) => { ... }, 'collection_name')
onRecordUpdateRequest((e) => { ... }, 'collection_name')

// Custom API routes
routerAdd('GET', '/api/custom-endpoint', (e) => { ... })

// Cron jobs
cronAdd('job_name', '0 3 * * *', () => { ... })
```

### Module System

Uses CommonJS with PocketBase's `${__hooks}` path variable:

```javascript
const { LOG_LEVEL } = require(`${__hooks}/constants.js`)
const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
const { createNotification } = require(`${__hooks}/services/notification.js`)
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LOG_LEVEL` | `4` | Console log verbosity (1=DEBUG, 4=ERROR) |
| `DRY_MODE` | `false` | Disable side effects (emails, push) |
| `VAPID_PUBLIC_KEY` | `''` | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | `''` | Web Push VAPID private key |
| `VAPID_SUBJECT` | `mailto:allerleih@posteo.de` | VAPID subject |

## Deployment (Container)

```bash
podman build -t allerleih-backend .
podman run -d -p 8090:8090 -v pb_data:/pb/pb_data allerleih-backend
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
- **Reference**: [leihbackend_AL](../leihbackend_AL) — Similar PocketBase backend for leih.lokal
