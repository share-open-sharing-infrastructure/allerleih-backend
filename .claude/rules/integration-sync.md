---
paths:
  - "pb_hooks/integration_sync.pb.js"
  - "pb_hooks/integration_import.pb.js"
  - "pb_hooks/integrations/*.js"
---

# Integrations (`integration_sync.pb.js` + `integration_import.pb.js` + `integrations/`)

As of #487 the **entire** integration pipeline runs in this repo — there is no frontend sync
layer and no `SYNC_SECRET` any more. Three entry points, all sharing `integrations/`:

- **`integration_sync` cron** (`SYNC_CRON`) — full catalogue pull via `integrations/sync.js`
  `runSync()`: create + update + archive.
- **`integration_refresh` cron** (`REFRESH_CRON`) — per-item refresh via
  `integrations/refresh.js` `runRefresh()`: update + archive, never create.
- **`POST /api/import/{preview,apply,refresh}`** (`integration_import.pb.js` +
  `integrations/import.js`) — the CSV-import write path the frontend targets.

Both crons need **only a valid cron expression** (no `FRONTEND_URL`, no secret). A syntactically
invalid expression logs an error and leaves that job unscheduled without affecting its sibling.
`DRY_MODE` logs and skips all upstream fetches + writes. Superusers can inspect and fire the jobs
in the admin UI (Settings → Crons) or via `GET /api/crons` / `POST /api/crons/{id}` — the tests
use the latter. Each run logs one counts-only summary line per institution
(`[cron:refresh] <inst>: fetched=… …`), never item content or PII.

## Discovery

Institutions come from the **`sync_config`** collection (`db.js findSyncConfigs`), superuser-only,
one row per (institution, integration). `enabled = false` skips the institution. `findSyncConfigs`
sorts by id and warns when a discovery read hits its page cap instead of silently dropping rows.
The authoritative `integration` field decides winbiap vs. leihbackend — no URL sniffing, so
WINBIAP can never be swept into the full pull.

## Safety rails

- **One lock for every `items` writer.** `integrations/lock.js` (`acquireRunLock` /
  `releaseRunLock`, `$app.store().getOrSet`) is taken by both crons *and* by
  `/api/import/{apply,refresh}` — otherwise a cron could compute its diff mid-apply and then
  archive the new items. The import endpoints answer **409** when another run holds it;
  `preview` stays lock-free because it writes nothing.
- **Claim scoping.** Both the pull and the refresh narrow stored items with `claimsItem` before
  diffing, so an institution's items from *another* source (a CSV-imported WebOPAC record, a
  second `sync_config` row) are never mistaken for "vanished from the feed" and archived.
- **Refresh circuit breaker.** `REFRESH_ABORT_RATE = 0.5`, measured against the items a run
  actually *claimed*. Tripping it aborts the institution with zero writes, so a source outage
  can't mass-archive the catalogue.
- **Sync archive guard.** `archiveGuardError` drops **only** the archive phase (creates/updates
  still apply) — deliberately distinct from the refresh's full abort. `fetchAllItems` throws on a
  non-2xx / cap-exceeded / `totalPages`-overflow response, so a truncated feed writes nothing.
- **Import.** `apply` writes only `owner = e.auth.id` (a payload `owner` is ignored), dedups
  keep-last by `externalId`, and caps a request at 5 000 rows. It carries **no** archive guard —
  a CSV upload is a deliberate full replacement.

> **Redirect residual (SSRF).** Fetches use `$http.send`, which auto-follows redirects and exposes
> no policy hook (spike #487 §4.4). The literal-URL guard in `integrations/urlGuard.js` can't catch
> a public base URL that 302-redirects onto an internal host — the frontend's `redirect: 'manual'`
> semantics is not reproducible in Goja. Base URLs are admin-onboarded (bounded risk); documented
> in the ops runbook.
