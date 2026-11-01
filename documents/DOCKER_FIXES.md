# Docker & Environment Fixes

**Date:** November 1, 2026
**Branch:** `main`
**Scope:** Docker build failures (`bun install --frozen-lockfile`), the `migrate` service, the web image's `npm ci`, and the `database "mainaksen" does not exist` login error

## Overview

Four independent problems were stacked on top of each other on `docker compose up --build`:
two dormant build failures that only surfaced once the first one (the frozen lockfile
mismatch) was fixed, plus a silent misconfiguration that made every login attempt fail
with `database "mainaksen" does not exist`.

## Problems & Fixes

### 1. `bun install --frozen-lockfile` — "lockfile had changes, but lockfile is frozen"

**Symptom:** `docker compose up --build` failed on the `migrate`/`api` base stage:

```
error: lockfile had changes, but lockfile is frozen
note: try re-running without --frozen-lockfile and commit the updated lockfile
```

**Root cause:** `bun.lock` tracks **all 6 workspaces** (`apps/api`, `apps/mobile`,
`apps/web`, `packages/ai`, `packages/database`, `packages/shared`), but
`docker/Dockerfile.api` only copied 4 of their `package.json` files. When bun resolves
the `apps/*` / `packages/*` globs from the root `package.json`, the missing
`apps/web` and `apps/mobile` manifests make the lockfile look stale → frozen install
refuses. Not a package-version drift problem: reproducing the exact COPY list in a
scratch container reproduced the error with the local bun `1.3.14` as well as the
image's `1.2.23`; adding the two manifests made it pass.

**Fixes:**
- `docker/Dockerfile.api`: copy **every** workspace `package.json` (added `apps/mobile`, `apps/web`).
- `docker/Dockerfile.web`: same gap existed for npm — added `apps/mobile/package.json`.
- Image pinned `oven/bun:1.2` → `oven/bun:1.3.14[-alpine]` to match
  `"packageManager": "bun@1.3.14"` in the root `package.json`, so the bun that
  *generates* the lockfile is never older than the one *verifying* it.

### 2. Latent: `bun build` defaulted to the browser target

**Symptom** (unreachable until #1 passed, also reproduced locally):

```
error: Browser build cannot import Bun builtin: "bun". When bundling for Bun, set target to 'bun'
```

**Root cause:** Bun 1.3 changed `bun build`'s default target from `bun` to `browser`,
so `bun build src/index.ts --outdir dist` refused the `bun` builtin (Bun.serve).

**Fix:** `apps/api/package.json` build script is now explicit:
`bun build src/index.ts --outdir dist --target bun`.

### 3. Latent: `migrate` service had no source tree

**Symptom:** `can't cd to packages/database: No such file or directory`.

**Root cause:** The compose `migrate` service runs `cd packages/database && bun run migrate`,
but the final stage of `Dockerfile.api` (production) only contains `apps/api/dist` and
`node_modules`.

**Fix:** Added a `FROM base AS migrate` stage (keeps the full workspace + `drizzle-kit`)
to `docker/Dockerfile.api`, and `build.target: migrate` on the `migrate` service in
`docker/docker-compose.yml`. The `api` service keeps using the final production stage.
Verified: migrations apply on boot and `psql \dt` shows all 10 tables.

### 4. Runtime: `database "mainaksen" does not exist` on login

**Root cause chain:**
- `postgres(process.env.DATABASE_URL!)` silently falls back to postgres.js defaults
  when the env var is missing: host `localhost`, user/database = your OS username → `mainaksen`.
- The API process had no `DATABASE_URL`: bun auto-loads `.env` only from the process
  cwd, and turbo does not propagate the root `.env` down into workspace tasks, so the
  `bun run --watch src/index.ts` process (cwd `apps/api`) ran with the env unset.
- Homebrew's native `postgresql@18` service owns `127.0.0.1:5432`, so the fallback
  connection landed on that server, which has no database named after the OS user →
  `database "mainaksen" does not exist`.

**Fixes:**
- `apps/api/package.json`: `bun run --env-file=../../.env --watch src/index.ts` —
  deterministic env loading regardless of how the task is launched.
- `apps/api/src/db/index.ts`: throw a clear `DATABASE_URL is not set` error instead of
  silently falling back to the OS user.

### 5. Support fixes

| Problem | Fix |
| --- | --- |
| Web build's `npm ci` failed: `package-lock.json` was 5 months stale (missing `query-string`, `@biomejs/biome@1.9.4`, …) | Regenerated with `npm install --package-lock-only` |
| ~620MB build context (Dockerfile patterns like `.next` only matched the context root, so `apps/web/.next` alone shipped 561MB) | `.dockerignore` rewritten with `**/`-prefixed patterns (`**/node_modules`, `**/.next`, `**/.expo`, `**/dist`, …) |
| Port clashes that would break `docker compose up` after the build fix: Homebrew `postgresql@18` owns `5432`, other projects' Redis owns `6379` | Compose now maps host **5433→5432** and **6380→6379** (container-internal URLs unchanged); `.env` and `docker/README.md` updated |

## What changed

| File | Change |
| --- | --- |
| `docker/Dockerfile.api` | Add `apps/mobile`/`apps/web` COPYs, bun `1.3.14` images, new `migrate` stage |
| `docker/Dockerfile.web` | Add `apps/mobile` COPY |
| `docker/docker-compose.yml` | `build.target: migrate`; host ports **5433** / **6380** |
| `docker/README.md` | Document the shifted host ports |
| `apps/api/package.json` | `--env-file=../../.env` in dev; `--target bun` in build |
| `apps/api/src/db/index.ts` | Fail loud when `DATABASE_URL` is unset |
| `package-lock.json` | Regenerated against current manifests |
| `.dockerignore` | Recursive exclusion patterns |

Note: `.env` is gitignored, so the `localhost:5433`/`localhost:6380` URL changes live
locally only — keep them in sync if you set up a new machine.

## Verification

- `docker compose build` → `docker-migrate`, `docker-api`, `docker-web` all build clean
- `docker compose up migrate` → `migrations applied successfully!`, 10 tables present
- `bun --env-file=../../.env -e` from `apps/api` resolves the correct `DATABASE_URL`
- Local `bun run --cwd apps/api build` succeeds (`--target bun`)

## Ops notes

- Host ports moved: psql / host tools now use `localhost:5433` (postgres) and
  `localhost:6380` (redis). Inside containers nothing changes (`postgres:5432`, `redis:6379`).
- `docker compose up -d` needs ports 3000/3001 free — stop the native dev processes first,
  or keep running the native stack (it now points at the dockerized db on 5433).
- After restarting `bun run dev`, the API picks up the explicit env file; login works
  against the dockerized postgres.
- Leftover orphans from the old compose file can be removed with
  `docker compose up -d --remove-orphans` (old `docker-minio-1` / `docker-meilisearch-1`).

## Follow-up: the first full `docker compose up --build` (same day)

All images built clean, migrations applied — then three more issues surfaced while
actually booting the stack. Logged here because each masks the next.

### F1. Native dev stack owns 3000/3001 → `Bind for 0.0.0.0:3001 failed: port is already allocated`

`turbo dev` (native web + api) still running while compose tried to bind the same
ports. Fix: stop the native web/api dev processes (`turbo`, `bun run --watch`,
`next dev`) before `docker compose up` — Expo/mobile is unaffected. (The bind error
also flapped: the crash-report-looping native api held 3001 intermittently.)

### F2. Pin `build.target` per service — compose silently builds the LAST stage

After adding the `migrate` stage to `Dockerfile.api`, the compose `api` service had no
`target`, so it built the *last* stage (`FROM base`), which inherits the stock
`CMD ["bun"]` from the oven image → the api container printed bun's help and exited 0
→ restart loop → every api "state" flip re-latched host ports inside
`com.docker.backend` (Docker Desktop), causing phantom
`port is already allocated` for 3000/3001 even with zero host listeners
(invisible to `docker ps`, `lsof`, `netstat`).

Fixes/actions:
- `docker/docker-compose.yml`: explicit `build.target: production` for `api`
  (`migrate` already pinned to its stage; web's final stage is production).
- To clear the phantom state: `docker compose down` → check
  `lsof -nP -iTCP:3000 -sTCP:LISTEN`; if `com.docker.backend` still holds it,
  `killall com.docker.backend` (supervisor respawns fresh), else quit/reopen
  Docker Desktop. Data is safe (named volumes).

### F3. Runtime: `Failed to load native binding` (`@node-rs/bcrypt`) — two stacked causes

Container booted with the right CMD but crashed exit 1 on `@node-rs/bcrypt`:

1. **bun's Alpine/musl runtime doesn't export napi_* symbols** — the musl `.node`
   binding fails dlopen with `napi_is_typedarray: symbol not found` (confirmed via
   `ldd`). Fix: run **both stages on Debian/glibc** (`oven/bun:1.3.14`), the standard
   supported combo for prebuilt napi-rs binaries.
2. **bun's bundler breaks the napi loader**: inside `bun build --target bun` output,
   the loader's `require("@node-rs/bcrypt-linux-arm64-gnu")` is rewritten to
   `throw new Error("Cannot require module ./bcrypt.linux-arm64-gnu.node")` stubs, so
   the bundled copy can never succeed even when the runtime
   `require("@node-rs/bcrypt")` from node_modules works. Fix: don't bundle this one
   package — `bun build … --external @node-rs/bcrypt` (the production stage already
   `COPY`s `/app/node_modules`, so runtime resolution is intact).

Final result: `web` serves 200 on :3000, `api` stays up on :3001 and returns
`{"error":"Invalid email or password"}` (HTTP 401) for dummy logins — proving the full
containerized auth roundtrip (api → drizzle → postgres) works. Login with real
credentials now succeeds; the original `database "mainaksen" does not exist` cannot
happen again (env-file fix + loud guard).

