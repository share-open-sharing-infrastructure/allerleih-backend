---
paths:
  - "Dockerfile"
  - ".dockerignore"
  - ".github/workflows/docker-publish.yaml"
---

# Official Docker image (#55)

- **PocketBase resolves `pb_data`/`pb_hooks`/`pb_migrations`/`pb_public` relative to
  `os.Args[0]`, not cwd** (`pocketbase.go` → `inspectRuntime()`) — so the image's `CMD` passes all
  four directory flags explicitly, and there is deliberately no `/usr/local/bin/pocketbase`
  symlink (that would silently relocate them under `/usr/local/bin/`).
- **`--automigrate=0`**: the default `true` binds `OnCollectionRequest` hooks that try to write a
  new migration file into the root-owned `/app/pb_migrations` on every admin-UI schema edit.
  **This does not disable applying pending migrations on `serve`** — that still happens on every
  start regardless of this flag; it only stops new migration files from being generated outside a
  reviewed PR.
- **`--hooksWatch=0`**: the default `true` starts an fsnotify watcher on `pb_hooks/` that restarts
  the app on change. Nothing under `pb_hooks/` changes at runtime in the image.
- **Cron always ticks in UTC** (`tools/cron/cron.go` hardcodes `time.UTC`; `SetTimezone` is never
  called upstream) — `TZ` only affects log timestamp readability, never job schedules.
- **Alpine needs `ca-certificates` + `tzdata` added explicitly** — the binary is statically
  linked, but outbound TLS (ORS, SMTP, the integration feeds) fails without a trust store.
- **Named volume vs. bind mount ownership**: a named volume (`-v pb_data:/app/pb_data`) inherits
  ownership from the image directory at container-create time, so the Dockerfile `mkdir`+`chown`s
  `/app/pb_data` to `pocketbase` (uid/gid **1001**, fixed) *before* `USER` drops root. A bind mount
  does **not** inherit this — the host directory must be `chown 1001:1001` manually, or the
  process fails to open the database. uid/gid 1001 is documented in README.md as part of the
  image's public interface.
- **"No curl/unzip" is precise, not absolute**: Alpine's busybox provides `wget`/`unzip` as
  *applets* (the `HEALTHCHECK` uses `wget`), so `command -v unzip` always "succeeds" regardless of
  whether the package is installed. The runtime stage never runs `apk add curl unzip` — that only
  happens in the discarded `fetch` stage — so no `curl` binary and no installed `unzip` *package*
  reach the final image. The PR's smoke test asserts exactly that: `apk info -e curl unzip` must
  print nothing (its exit code alone isn't a reliable signal here, so the test checks output).
- **Version bump checklist** (more than the Dockerfile): `ARG PB_VERSION` + both `PB_SHA256_*`
  args in the `Dockerfile`, sourced from the release's own `checksums.txt` (GitHub release assets
  are mutable per tag, so the version number alone doesn't pin the bytes); the two "Known-good"/
  tag-divergence mentions of the version in `README.md`; and `share-mvp/.github/workflows/e2e.yaml`,
  which pins the same PocketBase version + checksum cross-repo for e2e — check it's still
  compatible (bumping it is a separate share-mvp PR).
- `serve` only prints migration progress to stdout in `--dev` mode (which prints SQL too and is
  never passed here) — don't rely on `docker logs | grep migrat`; verify via a real endpoint
  instead (e.g. `items_public` answering 200).
