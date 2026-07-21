---
paths:
  - "pb_hooks/integration_sync.pb.js"
  - "pb_hooks/jobs/integrationSync.js"
  - "pb_hooks/integrations/*.js"
---

# Cron jobs (`integration_sync.pb.js` + `jobs/integrationSync.js` + `integrations/`)

Two jobs, registered from `constants.js`. **As of #487 Phase 1 they behave differently:**

- **`integration_sync`** (full catalogue pull) — unchanged: when `SYNC_CRON` is set *and*
  `FRONTEND_URL` + `SYNC_SECRET` are present, POSTs the frontend's bearer-protected `/api/sync`
  on schedule (`jobs/integrationSync.js`). `DRY_MODE` skips the outbound call.
- **`integration_refresh`** (per-item refresh) — now runs **locally in the backend** via
  ``require(`${__hooks}/integrations/refresh.js`).runRefresh()``: native `$app`, a per-institution
  `runInTransaction` (all-or-nothing), and a concurrency-safe `$app.store()` overlap lock
  (`integrationRunLock` in `integrations/lock.js`, shared with the future backend sync port — both
  write `items`). It needs **only a valid `REFRESH_CRON`** (no `FRONTEND_URL`/`SYNC_SECRET`).
  `DRY_MODE` logs and skips all upstream fetches + writes. Discovery is the interim
  `findSyncInstitutions` (`isInstitution = true && leihbackendUrl != ""`); WINBIAP vs. leihbackend
  is detected from the base URL (`/webopac`).

Fail-soft is per job: a syntactically invalid cron expression (or, for sync only, a missing
`FRONTEND_URL`/`SYNC_SECRET`) logs an error and leaves that job unscheduled without affecting the
sibling. Superusers can inspect and manually fire both in the admin UI (Settings → Crons) or via
`GET /api/crons` / `POST /api/crons/{id}` — the tests use the latter
(`tests/integration-refresh.test.mjs`, `tests/cron-sync*.test.mjs`). Refresh logs one counts-only
summary line per institution (`[cron:refresh] <inst>: fetched=… …`), never item content or PII.
Operational details live in the frontend repo: `docs/operations/integration-sync.md`.

## Refresh safety rails

- **Claim scoping.** `claimsItem` excludes WINBIAP-shaped items, so leihbackend's refresh never
  claims a same-owner item that isn't in its `item_public` feed (CSV-imported WebOPAC records
  would otherwise 404 and get archived).
- **Circuit breaker.** `REFRESH_ABORT_RATE = 0.5`, measured against the items a run actually
  **claimed** (not everything stored for that owner) — transient errors and gone counts together.
  Tripping it aborts the institution with zero writes, so a source outage can't mass-archive the
  catalogue.

> **⚠️ Temporary double truth (until #487 Phase 3).** The diff/write logic exists **twice**: the
> Goja port in `pb_hooks/integrations/` (`diff.js`, `db.js`) **and** its TS twin in the frontend
> (`src/lib/server/integrations/`), which still runs for the CSV import. `SYNCED_FIELDS`
> (`integrations/types.js` ↔ `core/types.ts`) and `DESCRIPTION_PREFIX` (`integrations/diff.js` ↔
> `$lib/server/itemArchive.ts`) **MUST stay byte-identical** across both repos — a drift in the
> prefix re-archives all existing stock (the "already archived" skip matches on it). Phase 3
> removes the frontend copy and this note.

> **Redirect residual (SSRF).** The refresh uses `$http.send`, which auto-follows redirects and
> exposes no policy hook (spike #487 §4.4). The literal-URL guard in `integrations/urlGuard.js`
> can't catch a public base URL that 302-redirects onto an internal host — the frontend's
> `redirect: 'manual'` semantics is not reproducible in Goja. Base URLs are admin-onboarded
> (bounded risk); documented in the ops runbook.
