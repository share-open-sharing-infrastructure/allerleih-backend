# allerleih-backend

PocketBase backend for [AllerLeih](https://allerleih.org) — the sharing/lending platform.

The companion SvelteKit frontend lives in a separate repo,
[share-mvp](https://github.com/share-open-sharing-infrastructure/share-mvp), and talks to
this backend over the PocketBase REST/realtime API. They are independent git repos: a change
spanning both needs a commit/PR in each.

## Architecture

This project uses PocketBase's **"Zero-Go, JavaScript Hooks"** approach:

- No custom Go code and **no build step** — PocketBase is a single downloaded binary
- Business logic lives in `pb_hooks/` (auto-loaded JS files)
- Schema is version-controlled in `pb_migrations/` (auto-applied on start)
- `pb_data/` is the live SQLite DB + uploads (gitignored; delete it to reset to a clean
  migrated state)

---

## Getting started

### Prerequisites

| What              | Version / note                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PocketBase**    | The official binary, downloaded in step 2 — **not** committed to the repo. Known-good: **v0.39.4**.                                                                                           |
| **Node.js**       | **25.2.1** — only needed to run the integration test suite (`npm test`); the server itself doesn't use Node. Match the version the frontend repo's CI pins.                                   |
| **A POSIX shell** | The test harness spawns `./pocketbase` and the frontend's `scripts/dev-stack.sh` is bash. On **Windows, use WSL** — with a native `pocketbase.exe` the test harness will not find the binary. |
| **git**           | Any recent version.                                                                                                                                                                           |

There is nothing to `npm install` for the server — `package.json` only carries the test script
and the Prettier config.

### 1. Clone

Clone this repo next to the frontend, so the frontend's `scripts/dev-stack.sh` finds it at its
default `../allerleih-backend`:

```bash
git clone https://github.com/share-open-sharing-infrastructure/allerleih-backend.git
git clone https://github.com/share-open-sharing-infrastructure/share-mvp.git
```

### 2. Download the PocketBase binary

Fetch the latest release into the repo root (the binary is gitignored):

```bash
VERSION=$(curl -s https://api.github.com/repos/pocketbase/pocketbase/releases/latest \
  | grep -o '"tag_name": *"v[^"]*"' | sed 's/.*"v\(.*\)"/\1/')

# Pick the archive for your platform:
#   pocketbase_${VERSION}_darwin_arm64.zip   macOS (Apple Silicon)
#   pocketbase_${VERSION}_darwin_amd64.zip   macOS (Intel)
#   pocketbase_${VERSION}_linux_amd64.zip    Linux / WSL
curl -fsSL -o pocketbase.zip \
  "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_linux_amd64.zip"
unzip -o pocketbase.zip pocketbase
chmod +x pocketbase
./pocketbase --version
```

All releases: <https://github.com/pocketbase/pocketbase/releases>. Keep the file named
`pocketbase` (no extension) — `tests/harness.mjs` and the frontend's `dev-stack.sh` both invoke
it by that name.

### 3. Start it

```bash
./pocketbase serve --http=127.0.0.1:8090
```

On first start PocketBase will:

1. Create `pb_data/` (SQLite database + file uploads)
2. Apply every migration in `pb_migrations/`, in filename order
3. Load every hook in `pb_hooks/`
4. Serve the API on <http://127.0.0.1:8090> and the admin UI on <http://127.0.0.1:8090/_/>

Migrations re-apply (only the pending ones) on **every** `serve`, so pulling `main` and
restarting is all it takes to pick up a schema change.

### 4. Create a superuser

```bash
./pocketbase superuser upsert you@example.com yourpassword
```

Or create one through the admin UI at <http://127.0.0.1:8090/_/> on first run. You'll need
these credentials for the frontend's seed runner and its e2e tests.

### 5. Connect the frontend

In the `share-mvp` checkout, point `.env` at your local backend — **the trailing slash
matters**, image URLs are built as `${PUBLIC_PB_URL}api/files/…`:

```env
PUBLIC_PB_URL="http://127.0.0.1:8090/"
```

Then start it:

```bash
cd ../share-mvp
npm ci
npm run dev
```

Register a user through the UI, or create test data via the admin dashboard or the frontend's
seed runner (`npm run seed -- <scenario>`).

> **Faster path:** the frontend's `scripts/dev-stack.sh --seed e2e` starts _this_ backend (on
> port 8091, against this repo's `pb_data/`), upserts a superuser, seeds deterministic data,
> and launches the dev server — all in one command. It needs the `pocketbase` binary from
> step 2 to be present here.

### 6. Local configuration (optional)

The hooks read all configuration from **environment variables** (see the table below) and every
one of them has a safe default or degrades gracefully — a bare `./pocketbase serve` is a
perfectly good dev setup. Without them, push notifications, travel times and outbound email
simply don't work locally.

**PocketBase does not auto-load a `.env` file.** The variables must already be in the
environment of the `pocketbase serve` process:

```bash
set -a; source local.env; set +a   # local.env is gitignored
./pocketbase serve --http=127.0.0.1:8090
```

Useful values while developing:

```env
DRY_MODE=true     # suppress outbound email / push side effects
LOG_LEVEL=1       # 1=DEBUG … 4=ERROR
```

Real credentials for the external services (OpenRouteService, SMTP, VAPID) are not in the repo
— request them from kontakt@allerleih.org if you need to exercise those features against real
providers.

---

## Everyday commands

```bash
./pocketbase serve --http=127.0.0.1:8090          # start (applies migrations, loads hooks)
./pocketbase superuser upsert <email> <password>  # create/update an admin
./pocketbase migrate down 1                       # revert the most recent migration
./pocketbase migrate collections                  # export the live schema as a snapshot migration
npm test                                          # integration test suite (see Testing)
npx prettier --write pb_hooks tests               # format (config lives in package.json)
```

---

## Testing

Integration tests live in `tests/` and run against a **real, throwaway PocketBase instance** —
so they exercise the actual migrations, collection rules and JS hooks end-to-end (none of which
can be unit-tested in isolation). No dependencies: they use Node's built-in test runner
(`node:test`) and `fetch`.

```bash
npm test                                    # the whole suite
node --test tests/groups.test.mjs           # a single file
```

How it works (`tests/harness.mjs`):

- wipes `pb_test_data/` and starts a fresh instance on port **8091** (your dev instance on 8090
  is untouched), which auto-applies `pb_migrations/` and loads `pb_hooks/`;
- creates a superuser, seeds verified test users, and exposes small `api()` / `makeUser()` /
  `adminAuth()` helpers;
- tears the instance down and removes `pb_test_data/` afterwards.

Requirements and gotchas:

- The `pocketbase` binary must be in the repo root (the same one used for `serve`), named
  exactly `pocketbase` — the harness spawns `./pocketbase`.
- Tests run serially (`--test-concurrency=1`) since each one owns the server and the test port.
- Port **8091** must be free. The frontend's `dev-stack.sh` also defaults to 8091, so stop it
  before running the suite (or give it another `PB_PORT`).

The ~29 suites cover groups and invites, the trust/group visibility model and public-view
masking, cascade-delete behaviour, account deletion + GDPR retention jobs, legal consent,
lending flows, notifications and mail templates, the integration sync/refresh crons, and the
canonical item-category list. `tests/categories.test.mjs` in particular asserts the live schema
against `CANONICAL_CATEGORIES`, so category drift between the two repos fails the suite.

Conventions for adding tests are in `.claude/skills/write-tests`.

---

## Contributing

### Workflow

1. **Pick or open an issue.** Issues for the platform are tracked in the
   [GitHub Project](https://github.com/orgs/share-open-sharing-infrastructure/projects/2).
2. **Branch off `main`** using `feat/…`, `fix/…`, `chore/…`, `docs/…`, or `<issue-number>-<slug>`.
   Never push to `main`.
3. **Make the change**, following the conventions in [CLAUDE.md](CLAUDE.md) — especially the two
   that bite newcomers: hook handlers run in **isolated contexts** (`require()` shared code
   _inside_ the handler, not at the top level), and every query filter uses **placeholders**
   (`'token = {:t}', { t: token }`), never string interpolation. Area-specific rules live in
   `.claude/rules/`.
4. **Run the tests** — this is the actual quality gate:

    ```bash
    npm test
    ```

5. **Open a PR against `main`**, describing what changed, why, and what you verified.

### What CI does — and doesn't

`.github/workflows/ci.yml` is a **deploy** workflow: on push to `main` it downloads the latest
PocketBase release, rsyncs `pb_hooks/`, `pb_migrations/` and `pb_public/` to the Uberspace host,
rewrites the supervisord service (env vars come from GitHub secrets/variables), restarts
PocketBase and health-checks it.

**There is no PR-triggered test workflow in this repo** — nothing runs `npm test` for you. Run
it locally before opening a PR, and if the change touches `pb_migrations/`, confirm it applies
cleanly against a fresh `pb_data/` and that `down()` reverts it.

Note that merging to `main` deploys to production, and that migrations apply automatically on
the next start.

### Never commit

`.env` / `local.env`, `pb_data/`, `pb_test_data/`, or the `pocketbase` binary — all gitignored,
all easy to add back by accident with `git add -A -f`.

---

## Environment variables

The hooks read configuration from environment variables, centralised in
[`pb_hooks/constants.js`](pb_hooks/constants.js). Set them in the environment of the
`pocketbase serve` process — e.g. `ORS_API_KEY=... ./pocketbase serve` locally, or via the
service/deployment config in production. The full reference table is in
[`.claude/rules/config.md`](.claude/rules/config.md); the ones you're most likely to touch:

| Variable                                 | Required                  | Default                      | Purpose                                                                                                                                                                          |
| ---------------------------------------- | ------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ORS_API_KEY`                            | **yes, for travel times** | —                            | OpenRouteService key used by the `/api/travel-times` hook. **Without it travel times silently stop working** (ORS rejects every request); the hook logs an error on each attempt. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | for Web Push              | —                            | VAPID keypair for push notifications.                                                                                                                                            |
| `VAPID_SUBJECT`                          | no                        | `mailto:allerleih@posteo.de` | VAPID subject (mailto: or https: URI).                                                                                                                                           |
| `LOG_LEVEL`                              | no                        | `4`                          | Log verbosity: 1=DEBUG, 2=INFO, 3=WARN, 4=ERROR.                                                                                                                                 |
| `DRY_MODE`                               | no                        | `false`                      | When `true`, suppresses side effects such as outbound email (and skips the integration cron fetches/writes).                                                                      |
| `MAIL_THROTTLE_MINUTES`                  | no                        | `15`                         | Max one notification email per recipient within this window.                                                                                                                     |
| `FRONTEND_URL`                           | for auth mails            | `''`                         | SvelteKit frontend origin (no trailing slash) — the host injected into the `users` auth-mail links. **#487: no longer used by the integrations** (they run locally).              |
| `SYNC_CRON`                              | no                        | `''` (off)                   | Cron expression for the full catalogue pull — runs locally in the backend (`integrations/sync.js`); no HTTP, only a valid expression.                                             |
| `REFRESH_CRON`                           | no                        | `''` (off)                   | Cron expression for the per-item refresh — runs locally (`integrations/refresh.js`); no HTTP, only a valid expression.                                                            |
| `INTEGRATION_ALLOW_INSECURE_URL`         | no                        | `false`                      | Allow `http://` + private/loopback source base URLs (bypasses the SSRF guard). **Local dev / tests only — never in production.**                                                  |
| `RETENTION_*`                            | no                        | see `constants.js`           | GDPR retention windows for the nightly purge jobs; `0` disables a job. See [`.claude/rules/retention.md`](.claude/rules/retention.md).                                            |

> **Note:** travel-time computation moved from the frontend into this backend hook, so
> `ORS_API_KEY` must be present **here** (the frontend still needs its own `ORS_API_KEY` for
> address autocomplete via `/api/geocode`).

---

> **Integration sync (#487):** the `SYNC_CRON` + `REFRESH_CRON` cron jobs run entirely in the
> backend (native `$app`, per-institution transaction, `sync_config` discovery); the CSV-import
> write path is `POST /api/import/*` (user-session, owner-scoped). None of this needs
> `SYNC_SECRET`/`SYNC_TIMEOUT_SECONDS` (both removed in Phase 3). `FRONTEND_URL` stays, but only for
> the #447 auth-mail links + `APP_URL` fallback. The full env table lives in
> [`pb_hooks/constants.js`](pb_hooks/constants.js). This repo has no `.env.example`; set variables
> in the `pocketbase serve` process environment.

## Mail & SMTP configuration

PocketBase normally stores SMTP settings per-instance in the admin UI and, without a working
SMTP server, falls back to local **sendmail**. On servers behind restricted relays that fallback
only delivers to verified addresses (the symptom in #8). To make delivery reliable and
reproducible, `pb_hooks/mail_config.pb.js` applies the SMTP settings from the environment on
bootstrap.

### Configuring SMTP via env vars

| Variable           | Required         | Default          | Purpose                                                                                                         |
| ------------------ | ---------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `SMTP_HOST`        | to enable SMTP   | —                | SMTP server hostname. **Set = configure SMTP from env; unset = leave existing settings untouched** (see below). |
| `SMTP_PORT`        | no               | `587`            | SMTP port (parsed as an integer).                                                                               |
| `SMTP_USERNAME`    | with `SMTP_HOST` | —                | SMTP auth username — usually the **full email address** (see troubleshooting).                                  |
| `SMTP_PASSWORD`    | with `SMTP_HOST` | —                | SMTP auth password. Never commit or log this.                                                                   |
| `SMTP_TLS`         | no               | `false`          | `true` = implicit TLS (typically port **465**); `false` = STARTTLS (typically port **587**).                    |
| `SMTP_AUTH_METHOD` | no               | `PLAIN`          | SMTP authentication method — PocketBase accepts only `PLAIN` (default) or `LOGIN`.                              |
| `SMTP_LOCAL_NAME`  | no               | —                | HELO/EHLO local name; leave empty unless the relay requires a specific one.                                     |
| `SENDER_ADDRESS`   | no               | (admin-UI value) | Optional override of the `From` address; only applied when set.                                                 |
| `SENDER_NAME`      | no               | (admin-UI value) | Optional override of the sender display name; only applied when set.                                            |
| `APP_URL`          | no               | (admin-UI value) | Optional override of the app URL used to build verification/reset/email-change links; only applied when set. **#607: this is also the backend origin (`utils/urls.js` → `assetBase()`) — the frontend origin for user-facing links is `FRONTEND_URL` / `siteBase()`.** |
| `UNSUBSCRIBE_SECRET` | no             | (derived)        | #607: HMAC secret for the one-click digest-unsubscribe tokens. Empty derives a fallback from the `users` auth-token secret; set an explicit value in production (`openssl rand -hex 32`) so rotating that secret doesn't invalidate already-sent unsubscribe links. |
| `DIGEST_SENDER_ADDRESS` / `DIGEST_SENDER_NAME` | no | — | #607: optional own sender identity for the weekly digest. Empty = same sender as transactional mail. **Do not set before SPF/DKIM/DMARC are configured for that address** — see "Zustellbarkeit (#607)" below. |
| `DIGEST_PACING_MS` / `DIGEST_BATCH_SIZE` / `DIGEST_BATCH_PAUSE_MS` | no | `200` / `50` / `5000` | #607: anti-burst pacing for the weekly digest send loop; `0` disables the corresponding pause. |

The TLS rule mirrors the usual convention: **`SMTP_TLS=true` for implicit TLS on 465**,
**`SMTP_TLS=false` for STARTTLS on 587**. Set `SMTP_PORT` to match.

### Enabling, updating and removing

The hook only ever **adds or updates** SMTP from the environment — it never disables or clears
anything:

- **`SMTP_HOST` set** → SMTP is enabled and configured from the env values on bootstrap
  (idempotent: it only writes when a value actually changed).
- **`SMTP_HOST` unset** → no-op. Whatever is already configured — e.g. via the PocketBase admin
  UI — is left completely untouched.

This makes deploys safe: rolling this out to an instance that configures SMTP in the admin UI
will **not** disturb its mail setup. To **remove** an env-configured server, unset the vars and
(if you want mail off) disable/clear SMTP in the admin UI — unsetting the env alone does not
erase what was last written to `pb_data`.

> **All SMTP changes apply at startup only.** The hook runs on bootstrap, so after adding,
> changing or removing any `SMTP_*` / `SENDER_*` / `APP_URL` variable you must **restart the
> `pocketbase serve` process** for it to take effect.

Keep the credentials in a gitignored file and source it, so the password stays out of your shell
history:

```bash
set -a; source mail.env; set +a   # mail.env is gitignored
./pocketbase serve --http=0.0.0.0:8090
```

…or pass them inline (this leaves `SMTP_PASSWORD` in your shell history / process list):

```bash
SMTP_HOST=smtp.example.org SMTP_PORT=587 SMTP_USERNAME=allerleih@example.org \
SMTP_PASSWORD=… SMTP_TLS=false SENDER_ADDRESS=allerleih@example.org \
APP_URL=http://127.0.0.1:8090 ./pocketbase serve --http=0.0.0.0:8090
```

In production set these via the service/deployment config (systemd `EnvironmentFile=` /
`Environment=`, or your container's env), not on the command line.

### Zustellbarkeit (#607)

On top of basic SMTP delivery, `pb_hooks/services/mail.js` builds every notification email with a
few spam-filter-friendly properties baked in:

- a `text/plain` alternative (multipart/alternative) generated from the HTML content via
  `pb_hooks/utils/htmlToText.js`, so the mail is never HTML-only;
- `Auto-Submitted: auto-generated` + `X-Auto-Response-Suppress` on every send;
- `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) on the
  weekly digest only — see `pb_hooks/unsubscribe.pb.js` / `services/unsubscribe.js` for the
  stateless HMAC-token one-click flow. Transactional mail (new-message, retention notices)
  deliberately carries **no** unsubscribe header — see `.claude/rules/retention.md`;
  `Precedence: bulk` is likewise digest-only;
  the digest also paces its sends (`DIGEST_PACING_MS` / `DIGEST_BATCH_SIZE` /
  `DIGEST_BATCH_PAUSE_MS`) as a courtesy to the receiving mail server;
- correct absolute links: `utils/urls.js` exposes `assetBase()` (this backend's own origin —
  `pb_public` assets, `/api/files/…`, the unsubscribe endpoint) and `siteBase()` (the SvelteKit
  frontend origin, `FRONTEND_URL`) as two separate bases, so a link never ends up pointing at the
  wrong host (the `APP_URL`/`{APP_URL}` value is the **backend** origin, per the #447 decision —
  see the `APP_URL` row above). Item thumbnails in the digest are served from
  `{assetBase}/api/files/items_searchable/{itemId}/{filename}?thumb=0x300` — **not**
  `items_public`, whose `image` column is a masking expression PocketBase types as `json` and
  therefore never serves a file (404, #622).

None of this replaces actual DNS-level deliverability work (SPF/DKIM/DMARC, PTR/rDNS, mail-tester
verification) — that live-diagnosis checklist, plus the env-var reference and rollout notes for
`DIGEST_SENDER_ADDRESS`, lives in the frontend repo's
[`docs/operations/mail-deliverability.md`](https://github.com/share-open-sharing-infrastructure/share-mvp/blob/main/docs/operations/mail-deliverability.md)
runbook (this repo has no `docs/` folder of its own).

### Who receives notification emails

For the new-message notification (`pb_hooks/notification.pb.js`), an email is sent unless:

- the recipient has opted out (`user_preferences.emailNotifications`; default is opted-in when no
  preferences record exists), or
- the recipient is currently throttled: at most one notification email per recipient per
  `MAIL_THROTTLE_MINUTES` window (default `15`).

The weekly digest (`pb_hooks/jobs/digest.js`) additionally respects its own
`user_preferences.digestEmails` opt-out (default opted-in when no row exists) — set independently
of `emailNotifications` via the digest's one-click unsubscribe link, so unsubscribing from the
digest never silences transactional mail. A recipient is skipped if **either** field is `false`.

In-app and push notifications are independent of these email rules.

### Troubleshooting

- **Check the startup log first.** On boot the hook logs a `[mail]` line stating what it did:
  `[mail] SMTP configured from environment` (with host/port/tls/sender) confirms your env vars
  were applied; `[mail] SMTP already matches environment — no change` means it was already set;
  `[mail] SMTP_HOST not set — leaving existing mail settings untouched` means no env SMTP was
  provided (any admin-UI config is kept); a `[mail] FAILED …` error means the settings were
  rejected and mail is **not** configured.
- **Mails only reach verified/some addresses, or not at all.** That is the classic
  sendmail-fallback symptom on restricted relays. Configure a real SMTP server via the env vars
  above so PocketBase sends through it instead of local sendmail.
- **`535 5.7.8 auth invalid` (or similar auth rejection).** Most relays expect the **full email
  address** as the login. Set `SMTP_USERNAME` to the complete address, matching the sender (e.g.
  `allerleih@example.org`), not just the local part.
- **Verification / password-reset / email-change links point at the wrong host.** Those links are
  built from `FRONTEND_URL` (with `APP_URL` as the documented fallback). Set `FRONTEND_URL` to
  the frontend that actually serves the auth confirmation routes, otherwise the links in
  delivered mails will be wrong.

---

## Project structure

```
.
├── package.json               # test script + Prettier config only — nothing to install
├── pb_hooks/                  # server-side JavaScript hooks, one file per domain area
│   ├── main.pb.js             # bootstrap + log interception
│   ├── constants.js           # ALL env vars & config in one place
│   ├── *.pb.js                # route handlers / record hooks: account, group, trust, invite,
│   │                          #   contact, travel, legal, lending, notification, retention,
│   │                          #   metrics, digest, mail_config, auth_mail_templates, …
│   ├── services/              # business logic (account.js, group.js, legal.js, mail.js,
│   │                          #   notification.js)
│   ├── integrations/          # partner-catalogue refresh port (leihbackend, WINBIAP)
│   ├── jobs/                  # cron job bodies (retention.js, integrationSync.js)
│   ├── utils/                 # shared helpers (common.js, email.js, db.js)
│   ├── routes/                # placeholder — routes are registered in the *.pb.js files
│   └── views/                 # HTML email templates (layout.html + mail/)
├── pb_migrations/             # schema migrations, applied in filename order on every serve
├── pb_public/                 # static assets served by PocketBase
├── tests/                     # *.test.mjs integration tests + harness.mjs
├── pb_data/                   # live DB + uploads (gitignored, created on first serve)
└── .claude/rules/             # area-specific conventions (migrations, endpoints, retention, …)
```

---

## Writing migrations

Migrations live in `pb_migrations/` and are **applied in filename order on `pocketbase serve`**.
Each file exports an up and a down function:

```js
/// <reference path="../pb_data/types.d.ts" />
migrate(
    (app) => {
        /* up:   apply the change   */
    },
    (app) => {
        /* down: revert the change  */
    },
)
```

Conventions:

- **Filename:** `<unix-seconds>_<snake_case_description>.js`. The numeric prefix must be
  **greater than every existing migration** so it runs last — use the current Unix timestamp
  (`date +%s`).
- **Always provide the down function** so the migration is reversible.
- **Make it idempotent** where practical (guard with an `if` so re-running is a no-op), and keep
  up/down exact inverses.

The full conventions — collection creation, stable IDs, the `users` collection id, ordering
dependencies, and the fixed item-category list — are in
[`.claude/rules/migrations.md`](.claude/rules/migrations.md); the `/new-migration` skill
scaffolds one.

### Editing a view (e.g. adding a sortable column)

A SQL view (`items_public`, `items_searchable`) returns **only the columns in its `viewQuery`
SELECT**. To expose a new column, change the `viewQuery` and **re-save** the collection —
PocketBase re-derives the view's field list from the new SELECT automatically (no manual field
definitions needed). Prefer a **string-append/replace** over rewriting the whole query, so the
migration survives other branches' changes to the same view (e.g. an appended `WHERE`):

```js
migrate(
    (app) => {
        const v = app.findCollectionByNameOrId('items_searchable')
        if (!v.viewQuery.includes('items.created')) {
            v.viewQuery = v.viewQuery.replace(
                'items.updated,',
                'items.updated, items.created,',
            )
            app.save(v) // re-syncs the view's fields, adding `created`
        }
    },
    (app) => {
        const v = app.findCollectionByNameOrId('items_searchable')
        v.viewQuery = v.viewQuery.replace(
            'items.updated, items.created,',
            'items.updated,',
        )
        app.save(v)
    },
)
```

A view's access rules reference field _names_, so adding a column leaves existing rules valid.
After a view change, update the column table in the frontend's `docs/data-model.md` so the docs
and the `ItemPublic` TS type stay honest.

### Apply & verify locally

```bash
./pocketbase serve          # applies pending migrations on start
# verify a view column / sort works:
curl 'http://127.0.0.1:8090/api/collections/items_searchable/records?sort=-created&perPage=3'
```

To reverse the most recent migration(s) during development: `./pocketbase migrate down 1`.

## Syncing migrations from production

When schema changes are made via the PocketBase admin dashboard on the live server, re-export
the collections snapshot:

```bash
# On the production server (in the directory containing pb_data/)
./pocketbase migrate collections
```

This generates a new `*_collections_snapshot.js` in `pb_migrations/`. Copy it into this repo's
`pb_migrations/`, delete the previous `*_collections_snapshot.js` (keep only the newest one),
and commit the change.

---

## Related

- **Frontend:** [share-mvp](https://github.com/share-open-sharing-infrastructure/share-mvp) —
  the SvelteKit app, its documentation (`docs/`), and the local stack bootstrapper
  (`scripts/dev-stack.sh`)
- **Operations runbook for the sync/refresh endpoints:** `share-mvp/docs/operations/integration-sync.md`
- **Data model & collection reference:** `share-mvp/docs/data-model.md`
- **Issues:** [GitHub Project](https://github.com/orgs/share-open-sharing-infrastructure/projects/2)
