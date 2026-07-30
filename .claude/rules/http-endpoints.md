---
paths:
  - "pb_hooks/*.pb.js"
---

# Custom HTTP endpoints

These supplement the standard PocketBase collection API. Frontend `/api/*` routes are a *separate*
thing (SvelteKit) — these are PocketBase routes:

| Method | Path | File | Purpose |
|---|---|---|---|
| GET  | `/api/invite/{code}` | invite.pb.js | Resolve invite code → `{id, username}`; 404 if unknown (no enumeration) |
| GET  | `/api/group-invite/{token}` | group.pb.js | Public preview of a group invite (validity + group name) |
| POST | `/api/group-invite/{token}/join` | group.pb.js | Join via invite; auth required; idempotent; transactional `uses`/cap/expiry check |
| GET  | `/api/contact/{userId}` | contact.pb.js | Telegram/Signal handles, gated by the owner's per-channel visibility flags; auth required |
| POST | `/api/travel-times` | travel.pb.js | ORS travel-time matrix (user → owners), bucketed to minutes; auth required |
| POST | `/api/legal/accept` | legal.pb.js | Record the user's acceptance of the active legal docs (snapshot from `legal_documents`), refresh their version cache, clear any lock — transactional, superuser; auth required |
| POST | `/api/legal/decline` | legal.pb.js | Record rejection of the active legal docs and set `legalLocked` — transactional, superuser; auth required |
| POST | `/api/import/preview` | integration_import.pb.js | CSV-import dry run (#487 Phase 3): same diff as `apply`, zero writes. Auth + institution required; lock-free (writes nothing) |
| POST | `/api/import/apply` | integration_import.pb.js | CSV-import write path (#487 Phase 3). Writes only `owner = e.auth.id` (a payload `owner` is ignored); keep-last dedup by `externalId`; diff + `applyDiff` in one transaction; no archive guard (deliberate full upload). Caps a request at 5 000 rows; answers **409** when a cron holds the `integrations/lock.js` overlap lock |
| POST | `/api/import/refresh` | integration_import.pb.js | Refresh only the caller's own items (`findSyncConfigs` by `institutionId`). Reports `configured: false` when the institution has no `sync_config` row; **409** under the shared lock |
| POST | `/api/_test/run-retention/{job}` | retention.pb.js | Test-only: run a retention job with an explicit `cutoff`. Registered ONLY when `RETENTION_TEST_ROUTE=true`; superuser required. Not present in production |
