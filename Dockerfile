# syntax=docker/dockerfile:1

# AllerLeih backend — official multi-stage image for GHCR (#55).
#
# PocketBase itself is a single statically-linked Go binary ("Zero-Go"); everything this repo
# adds on top is `pb_hooks/` JS run *inside* PocketBase's embedded Goja interpreter — there is no
# Node.js runtime in this image, and none is needed to execute the hooks. `pb_data/` (SQLite +
# uploads) is the only mutable state; everything else copied in is read-only application code.
# See README.md → "Run with Docker (self-hosting)" for the runtime-var reference, first-superuser
# and backup recipes, and `.claude/rules/docker.md` for the facts behind the choices below.

# Global ARGs, declared before the first FROM so both stages can reference them in their FROM
# line without redeclaration. Checksums are read straight off the release's own `checksums.txt`
# (release assets are mutable per tag, so the version number alone does not pin the bytes) — see
# .claude/rules/docker.md for the full version-bump checklist; this file is only one part of it.
ARG ALPINE_VERSION=3.22
ARG PB_VERSION=0.39.11
ARG PB_SHA256_AMD64=08b9fcda0d5fd42cb315dc15a36dfa121c993855bd635f01d347c31b4328ec34
ARG PB_SHA256_ARM64=8c785618840df7ebba795fdf4eba33a5fed64ac5307ad8023b955b4ebb82048b

# --- Fetch stage -----------------------------------------------------------
# --platform=$BUILDPLATFORM: this stage only downloads+unzips a prebuilt binary, so it always
# runs natively on the build host (fast, no emulation) even when cross-building for arm64 —
# $TARGETARCH below picks the *downloaded* asset's architecture, independent of the host.
FROM --platform=$BUILDPLATFORM alpine:${ALPINE_VERSION} AS fetch
ARG PB_VERSION
ARG PB_SHA256_AMD64
ARG PB_SHA256_ARM64
ARG TARGETARCH

# ALPINE_VERSION already pins the distro release these packages come from; pinning curl/unzip's
# own patch versions on top would just mean a broken build every time Alpine ships a security
# update to either, for no reproducibility gain (they're build-time-only tooling, not shipped in
# the final image).
# hadolint ignore=DL3018
RUN apk add --no-cache curl unzip

WORKDIR /tmp/pb

# Deliberately does NOT run the extracted binary (e.g. `./pocketbase --version`) to "smoke test"
# it here: on a cross build this stage runs on $BUILDPLATFORM while the binary is $TARGETARCH, so
# executing an arm64 binary on an amd64 builder would fail the build even though the binary itself
# is fine. The sha256 check below is the verification instead.
# `pipefail` is a busybox-ash extension, not POSIX — hadolint's shellcheck pass assumes plain
# POSIX sh without a SHELL directive (which we don't want stage-wide just for this). It only
# guards `echo … | sha256sum -c -`, and that pipe's failure mode is already covered without it:
# sha256sum is the *last* command in the pipe, so a checksum mismatch's non-zero exit already
# trips the preceding `set -e` on its own.
# hadolint ignore=DL4006,SC3040
RUN set -eux; \
    case "$TARGETARCH" in \
        amd64) asset="pocketbase_${PB_VERSION}_linux_amd64.zip"; sha256="$PB_SHA256_AMD64" ;; \
        arm64) asset="pocketbase_${PB_VERSION}_linux_arm64.zip"; sha256="$PB_SHA256_ARM64" ;; \
        *) echo "unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o pocketbase.zip \
        "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${asset}"; \
    echo "${sha256}  pocketbase.zip" | sha256sum -c -; \
    unzip -o pocketbase.zip pocketbase; \
    chmod 0755 pocketbase

# --- Runtime stage ----------------------------------------------------------
FROM alpine:${ALPINE_VERSION} AS runtime
ARG PB_VERSION

# org.opencontainers.image.source is what makes GHCR link this package back to the repo (needed
# for "Inherit access from repository" + correct package visibility). image.version is left unset
# on purpose — metadata-action sets it from the git tag/sha and a LABEL here would be overwritten
# anyway, so setting it would just be misleading dead code.
LABEL org.opencontainers.image.source="https://github.com/share-open-sharing-infrastructure/allerleih-backend"
LABEL org.opencontainers.image.description="AllerLeih — PocketBase backend for the item-sharing platform"
LABEL org.opencontainers.image.licenses="AGPL-3.0-only"
LABEL org.allerleih.pocketbase.version="${PB_VERSION}"

# ca-certificates: the binary is statically linked (no dynamic musl dependency), but Alpine ships
# no trust store by default — every outbound TLS handshake (ORS /api/travel-times, SMTP, the
# leihbackend/WINBIAP integration feeds) would fail with "x509: certificate signed by unknown
# authority" without it.
# tzdata: affects only *log* timestamp readability (time.Local) — PocketBase's cron ticker is
# hardcoded to UTC upstream (tools/cron/cron.go) and never calls SetTimezone, so retention/
# metrics/digest crons run on the same UTC schedule with or without this package; see
# README.md → "Run with Docker (self-hosting)".
# Same reasoning as the fetch stage's apk add: ALPINE_VERSION already pins the distro release, and
# these are trust-store/timezone data, not code — always take the latest patch within that pinned
# Alpine release rather than freeze a cert bundle in place.
# hadolint ignore=DL3018
RUN apk add --no-cache ca-certificates tzdata

# Dedicated non-root user. uid/gid 1001 is part of this image's public interface, documented in
# README.md, because it matters for self-hosters: a named volume inherits ownership from the
# image directory it's first attached to (see the pb_data step below), but a bind-mounted host
# directory does not — the host path must be chowned to 1001:1001 explicitly.
RUN addgroup -S -g 1001 pocketbase \
    && adduser -S -u 1001 -G pocketbase -h /app -s /sbin/nologin pocketbase

WORKDIR /app

COPY --from=fetch /tmp/pb/pocketbase /app/pocketbase

# pb_hooks/, pb_migrations/ and pb_public/ stay root-owned on purpose (see USER below) — the
# running process can read but never modify its own code, schema or assets.
COPY pb_hooks/ /app/pb_hooks/
COPY pb_migrations/ /app/pb_migrations/
COPY pb_public/ /app/pb_public/

# pb_public/AllerLeih.png is not just a static asset: pb_hooks/views/layout.html renders
# {{.ASSET_URL}}/AllerLeih.png into the header of every outgoing mail, so pb_public/ must ship.

# A named volume (`docker run -v pb_data:/app/pb_data`) inherits ownership from whatever already
# exists at that path in the image at container-create time — so pb_data must exist and be
# pocketbase-owned *before* USER drops root, or the non-root process cannot write into a fresh
# volume. This does not help a bind mount, which never inherits image-directory ownership; see the
# README's "Non-root process, bind mounts" note.
RUN mkdir -p /app/pb_data && chown pocketbase:pocketbase /app/pb_data

# Named user rather than a bare numeric id here for readability/debuggability in `docker inspect`/
# `docker exec … ps` output; the numeric uid:gid it resolves to (1001:1001, fixed by the addgroup/
# adduser call above) is documented in README.md and verifiable with `docker exec … id`.
# hadolint ignore=DL3066
USER pocketbase

VOLUME /app/pb_data
EXPOSE 8090

# Exec form (no shell fork per check). wget is a busybox applet bundled with Alpine, not an
# installed package — see the "no curl/unzip" note in .claude/rules/docker.md for the precise
# claim this image can back up. start-period covers the first-boot migration run (currently ~44
# files) on slow storage so it doesn't get counted as an unhealthy failure.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["wget", "-q", "--spider", "http://127.0.0.1:8090/api/health"]

# No tini/PID-1 init here: PocketBase handles SIGINT/SIGTERM itself (OnTerminate + watcher
# cleanup), so there is nothing an init process would still need to do.
#
# ENTRYPOINT/CMD are deliberately split rather than one fixed ENTRYPOINT array: this is what lets
# `docker exec <container> /app/pocketbase superuser upsert …` and the lock-free
# `docker run --rm -v pb_data:/app/pb_data <image> superuser upsert …` both work without an
# `--entrypoint` override, since CMD alone is replaced by extra `docker run` arguments while
# ENTRYPOINT stays fixed. Default (no extra args) behavior is unchanged from a single-array form.
#
# All four directory flags are explicit because PocketBase resolves relative paths against
# os.Args[0]'s directory, not the process cwd — also why there is no /usr/local/bin/pocketbase
# symlink here. See .claude/rules/docker.md for the full reasoning.
#
# --hooksWatch=0: skips the fsnotify watcher PocketBase starts by default on pb_hooks/ (restarts
# the app on change) — nothing under pb_hooks/ changes at runtime in this image. See
# .claude/rules/docker.md.
#
# --automigrate=0: stops an admin-UI schema edit from trying to write a new migration file into
# this image's root-owned /app/pb_migrations. It does NOT stop pending migrations in
# pb_migrations/ from applying on `serve` — that still happens on every start regardless. See
# .claude/rules/docker.md.
ENTRYPOINT ["/app/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/app/pb_data", "--hooksDir=/app/pb_hooks", "--migrationsDir=/app/pb_migrations", "--publicDir=/app/pb_public", "--hooksWatch=0", "--automigrate=0"]
