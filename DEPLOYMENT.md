# Deploy MessMate

## Current status — 10 September 2026

**LIVE ON VERCEL.** Open [MessMate](https://messmate-smart-mess-system.vercel.app). Its same-origin API is [https://messmate-smart-mess-system.vercel.app/api](https://messmate-smart-mess-system.vercel.app/api), and the public health endpoint returns HTTP 200 with the cloud database connected. The public `pnpm deploy:check` and all 17 controlled live workflow checks passed, including student meal choices, mobile bearer sessions, fingerprint attendance and waste readings. Temporary test records were removed after verification. The first administrator has been created; read the login email and password locally in the ignored root file `.production-credentials.json`. Never upload or share that file.

Deployment `dpl_kP1a3XXPB3XhWBcymozRZTnwxrZJ` completed on the verified Vercel Hobby plan, using a Neon pooled PostgreSQL connection over verified TLS. All three existing migrations were applied to the empty cloud database; no fictional demo data was seeded. No paid service or billing was enabled.

**GitHub automatic deployment is pending account access.** Local Git history was restored from `source-history.bundle`, newer UI/Anime.js changes were preserved, and `origin` points to the [supplied repository](https://github.com/ChaitanyaVemula546/messmate-smart-mess-system). GitHub still returns repository-not-found to the connected account, local Git has no credentials, and Vercel's GitHub login connection is missing. No source push or Git-triggered deployment has occurred. Direct CLI deployment works independently of GitHub.

## 1. Architecture

The actual source is Next.js 16 + React 19, an Express 4 API, pnpm 11.19.0, Drizzle, and **PostgreSQL**. Local development uses PGlite. Authentication uses opaque, database-backed sessions and HMAC-hashed device tokens. It does not use MySQL or JWT; switching to those would require rewriting the existing application.

```text
Browser / Expo / ESP32
          | HTTPS
          v
One Vercel Next.js project (apps/web)
  pages + assets + /api/*
          |
Existing Express app, through pages/api/[[...path]].ts
          | verified TLS + small reused pg pool
          v
Neon pooled PostgreSQL (Singapore / ap-southeast-1)
```

Express still handles every authentication, student, admin, analytics, attendance, and hardware route. The adapter does not start a listener. Initialization and connections are reused within each function instance. Sessions and rate limits are stored in PostgreSQL, so they survive cold starts and work across instances. Device status updates use Vercel's request lifecycle support. SQL schema and all three migrations remain unchanged.

No custom `vercel.json` is necessary: Next.js detects the server API route. Production has no localhost API rewrite. Local `pnpm dev` retains the separate Express listener and development proxy.

## 2. Free services

Use a Vercel Hobby project and a Neon Free PostgreSQL database for this student project. Vercel Hobby is limited to personal, non-commercial use; consult its [Hobby terms and limits](https://vercel.com/docs/plans/hobby) if using this for a paid hostel operation. Neon currently offers a $0 plan without a credit card, with finite storage/compute quotas; select **Free**, not a trial or usage-based plan. Check the current [Neon pricing page](https://neon.com/pricing). Free databases can sleep, so the first request may take longer.

Do not enable a paid plan, enter billing details, or buy a domain to complete this deployment. The provided `vercel.app` domain supports HTTPS.

## 3. Cloud database and administrator

The current database is connected and initialized. The first admin's login is stored only in `.production-credentials.json` at the repository root; this file is ignored by Git and direct Vercel uploads. Sign in at [the production login page](https://messmate-smart-mess-system.vercel.app/login). The following steps document setup for a new environment; do not create another database or rerun bootstrap for the existing deployment.

1. Sign in to Neon and create one Free project, or use your existing free PostgreSQL database. Pick a region close to the Vercel function region. A pooled hostname is recommended for `DATABASE_URL`.
2. Copy the provider's PostgreSQL connection string privately. Keep TLS enabled. This application enforces certificate verification in production and rejects insecure TLS options, PGlite, and local/private hosts.
3. In the repository root, create the ignored file `.env.production.local` using a local editor. Put your private `DATABASE_URL` there and `NODE_ENV=production`. Do not replace your working development `.env`.
4. From the repository root, apply the existing migrations:

```powershell
node --env-file=.env.production.local --import tsx packages/database/src/migrate.ts
```

Migrations are explicit, transactional and tracked in `schema_migrations`. They are not run during deployment builds or API requests. Never use the development seed on production.

5. Add `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and a private `BOOTSTRAP_ADMIN_PASSWORD` to the same ignored file. The password must be at least 12 characters and at most 72 UTF-8 bytes. Create the first admin:

```powershell
node --env-file=.env.production.local --import tsx scripts/admin-bootstrap.ts
```

6. Remove the bootstrap variables from the file after success. The script refuses to create another administrator when one already exists. Use the admin dashboard to add mess administrators and students.

Create a separate random `AUTH_SECRET` of at least 32 characters using your password manager or Node's crypto generator, and save it only in private configuration. Do not rotate this value casually: changing it invalidates existing session and device token hashes, requiring sign-ins and device credential re-provisioning.

An empty cloud database will initially have no local demo students or history. Local `.data` is preserved and is never uploaded. If you need existing real records transferred, take a verified backup and perform a deliberate data migration before switching users; do not seed over real data or delete the local database. The existing schema/migrations are PostgreSQL-specific and cannot run on MySQL.

## 4. Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Vercel server; migration/maintenance tools | Cloud PostgreSQL pooled URL; secret |
| `AUTH_SECRET` | Vercel server | Private random HMAC secret, 32+ characters |
| `APP_URL` | Vercel server | `https://messmate-smart-mess-system.vercel.app`; no trailing slash |
| `NEXT_PUBLIC_API_BASE_URL` | Web build, optional | Leave unset or use `/api` |
| `DB_POOL_MAX` | Server, optional | Pool size; defaults to 3 on Vercel, allowed 1–20 |
| `ENABLE_EXPERIMENTAL_COREPACK` | Vercel build | Set to `1` to honor the pinned pnpm version |
| `EXPO_PUBLIC_API_BASE_URL` | Expo build only | `https://messmate-smart-mess-system.vercel.app/api` |
| `NODE_ENV` | CLI production file only | `production`; Vercel/Next set it automatically |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_PASSWORD` | One-time local bootstrap only | First real admin; remove after use |
| `API_INTERNAL_URL`, `API_PORT`, `API_HOST` | Development/standalone API only | Local listener/proxy; unnecessary on Vercel |
| `DEMO_PASSWORD` | Local seed only | Never configure on Vercel |
| `SMOKE_WEB_ORIGIN` | Public verification command only | Exact public website origin |

Production already has `DATABASE_URL` and `AUTH_SECRET` as sensitive Vercel variables, plus `APP_URL`. `ENABLE_EXPERIMENTAL_COREPACK=1` is configured for production and preview builds. Preview database/auth runtime variables have not been provisioned.

Do not add `JWT_SECRET`, a second API URL, or `DEVICE_API_SECRET`. Devices already have individual tokens. No server secret belongs in a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` variable. `.env*`, demo and production credentials, local databases, firmware `config.h`, private keys and `.vercel` are ignored. `.vercelignore` also excludes them from direct CLI uploads.

## 5. Private GitHub repository

The supplied repository is [ChaitanyaVemula546/messmate-smart-mess-system](https://github.com/ChaitanyaVemula546/messmate-smart-mess-system), and the local `origin` is already set to its HTTPS Git URL. Its contents and privacy setting cannot yet be verified because the connected GitHub account returns repository-not-found. Keep the repository private.

To finish access and automatic deployment:

1. In GitHub, open **Settings → Applications → Installed GitHub Apps**, configure the ChatGPT/Codex app, and grant access to `messmate-smart-mess-system`. If that app is not installed, connect GitHub through Codex and select this repository.
2. In Vercel, connect the GitHub account when prompted. In the existing MessMate project, open **Settings → Git**, select this repository, and use `main` as the production branch. Authorize the Vercel GitHub app for this repository if requested.
3. Sign in to GitHub for local Git, inspect the remote history, and reconcile any existing commits before pushing. Do not create another repository, replace `origin`, or force-push.

After access works and remote history has been checked, review and upload the source from this folder:

```powershell
git remote -v
pnpm secrets:check
git status --short
git add .
git diff --cached --name-only
git commit -m "Prepare existing MessMate for Vercel deployment"
git push -u origin main
```

Review staged file names to ensure only source/configuration/docs are included. Never upload `.env.production.local`, `.production-credentials.json`, `.env`, or `.demo-credentials.json`.

## 6. Import into Vercel

The `messmate-smart-mess-system` project already exists in the `vvemula34-8720` Hobby scope and is linked to this folder. It was deployed directly with Vercel CLI 59.14.0; its production build completed in approximately 52 seconds. Reuse this project when connecting GitHub. The existing settings are:

| Setting | Value |
| --- | --- |
| Root directory | `apps/web` |
| Framework preset | Next.js |
| Include source files outside root directory | Enabled (required for `apps/api` and `packages/*`) |
| Node.js | 24.x |
| Function region | `sin1` (Singapore), near Neon `ap-southeast-1` |
| Function compute | Fluid Compute, basic configuration on Hobby |
| Install command | Default pnpm detection, with `ENABLE_EXPERIMENTAL_COREPACK=1` |
| Build command | Default `pnpm run build` in `apps/web` (`next build`) |
| Output directory | Next.js default; do not set `out` or `dist` |
| Intended production branch | `main`; Git integration pending |

The entire workspace and lockfile must be available to the build. [Vercel's Corepack support](https://vercel.com/docs/package-managers) honors the root `packageManager` field. If package detection fails, use `corepack pnpm install --frozen-lockfile` as the install command with Corepack enabled. Do not install only production dependencies before building.

`DATABASE_URL`, `AUTH_SECRET`, and `APP_URL` are already configured for **Production**. If the canonical domain changes, update `APP_URL` to its exact origin and redeploy before using login. The current public domain serves the login page and `/api/health` without a Vercel account; database connectivity and admin login have been verified. Keep preview deployment protection enabled. A phone on cellular data is still a useful independent network check.

Preview deployments should use a separate database and secret. Set their `APP_URL` to the specific preview origin being tested; do not wildcard CORS or point previews at production data. Prefer production for the first controlled end-to-end setup if no isolated preview database exists.

For direct redeployment from this already-linked repository root, run `pnpm dlx vercel@59.14.0 --prod` after the local checks pass. GitHub access is not required for this command. If working from a new checkout, sign in with `pnpm dlx vercel@59.14.0 login` and explicitly link the existing project with `pnpm dlx vercel@59.14.0 link` first. Never put a token in a shell command or source file.

## 7. URLs and ESP32 firmware

Production website: [https://messmate-smart-mess-system.vercel.app](https://messmate-smart-mess-system.vercel.app).

Production API: [https://messmate-smart-mess-system.vercel.app/api](https://messmate-smart-mess-system.vercel.app/api). Health check: [ `/api/health`](https://messmate-smart-mess-system.vercel.app/api/health).

Set `API_ORIGIN` in each private firmware `config.h` to `https://messmate-smart-mess-system.vercel.app`, with no `/api` suffix and no trailing slash. Existing sketches append the complete endpoint path. Configure the real root CA in `ROOT_CA`; retain `setCACert()` and time synchronization. Do not call `setInsecure()`.

| Device | Old local URL | New production URL | Method |
| --- | --- | --- | --- |
| ESP32 + R307 | `http://localhost:4000/api/iot/attendance` | `https://messmate-smart-mess-system.vercel.app/api/iot/attendance` | POST |
| ESP32 + HX711 | `http://localhost:4000/api/iot/waste` | `https://messmate-smart-mess-system.vercel.app/api/iot/waste` | POST |

Both require `Content-Type: application/json` and `Authorization: Bearer <YOUR_PER_DEVICE_TOKEN>`. Provision an enabled device of the correct type from Admin → Devices, copy its one-time token privately to that device, and keep tokens out of Git. Authentication is mandatory even though the HTTPS endpoint is publicly reachable.

Fingerprint request (unchanged):

```json
{ "fingerprintId": 1 }
```

Waste request (unchanged):

```json
{ "deviceId": "WASTE_BIN_01", "weightKg": 1.25, "measurementId": "unique-retry-id", "tare": false }
```

`deviceId` and `weightKg` are required; `measurementId` and `tare` are supported existing fields. Retain a measurement ID when retrying the same reading. Tare only with an empty bin. The scanner ID must map to an active student and scans must fall inside a configured meal window. Unauthenticated requests return 401, disabled devices 403, validation errors 400, duplicates/conflicts 409, and rate limits 429 as applicable. See [API contracts](docs/API.md), [fingerprint guide](docs/ESP32_INTEGRATION.md), and [load-cell guide](docs/LOAD_CELL_INTEGRATION.md).

For the Expo app, set `EXPO_PUBLIC_API_BASE_URL=https://messmate-smart-mess-system.vercel.app/api` in `apps/mobile/.env` before exporting/installing a release. The mobile and both firmware configuration examples now contain the production hostname. The Expo Android JavaScript export passed with this actual API address. A release refuses a missing, insecure, or local-only API URL; the emulator fallback is development-only. A successful JavaScript export is not an APK or native-device connectivity test.

Cloud cold starts can exceed the sketches' current 8-second HTTP timeout. Keep the existing retry/idempotency behavior and measure real timings before adjusting firmware timeouts. Physical sensor calibration, certificate trust and network reliability require your devices.

## 8. Verify, redeploy, inspect logs and roll back

Local checks from the root:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm secrets:check
```

When your development servers are running, `pnpm smoke` exercises 17 HTML routes, authenticated APIs, CSV exports and web/mobile identity. For the compiled single-process Next.js server, `pnpm smoke:stack` reads `.env.production.local` and requires an isolated **cloud PostgreSQL test database**, its runtime variables, and private `SMOKE_ADMIN_EMAIL`, `SMOKE_STUDENT_EMAIL`, `SMOKE_PASSWORD` test-account values. It starts the built server on local port 3100, checks the same API through the adapter, and stops its own server. It never seeds a database. Override `SMOKE_PORT` if needed. Neither local command proves public HTTPS access.

After publishing:

```powershell
$env:SMOKE_WEB_ORIGIN = 'https://messmate-smart-mess-system.vercel.app'
pnpm deploy:check
```

This command checks HTTPS pages, route refreshes, database health, protected APIs, hardware authentication and exact-origin CORS without changing records. The separate live verification completed 17 steps with zero failures or skips, covering admin/student login, secure cookies, meal-choice persistence, shared mobile/web identity, CSV exports, device provisioning, attendance and waste writes, retry handling and logout. Its generated fixtures and sessions were removed successfully. A production browser check also passed admin login, dashboard charts, a 390-pixel mobile viewport without overflow, and logout without page errors. The inspected 20-minute production log window contained no error-level entries. Repeat appropriate controlled workflow checks after future behavior changes; physical hardware testing is still required.

Once Git integration is configured, a push to `main` creates a production deployment automatically; other branches create previews. `.github/workflows/ci.yml` already verifies source changes. GitHub checks and Vercel builds run independently unless deployment checks are configured in Vercel. Avoid pushing failing changes to `main`.

In Vercel → Project → Deployments, select a deployment for **Build Logs**. Use the project's **Logs** view for function errors. Events include `api_initialization_failed`, `database_pool_error`, and `request_failed`; these deliberately omit secrets and SQL parameters. CLI alternatives: `pnpm dlx vercel@59.14.0 inspect <deployment-url>` and `pnpm dlx vercel@59.14.0 logs <deployment-url>`.

For a failed release, select the previous healthy production deployment and use Vercel's rollback action (or `pnpm dlx vercel@59.14.0 rollback`). Rollback does not undo database changes; keep backups and review future migrations for backward compatibility. Run the public check again after rollback.

Maintenance can be run manually using `node --env-file=.env.production.local --import tsx scripts/maintenance.ts` to remove expired sessions/rate-limit rows according to the existing script. Avoid scheduling constant health polling against a free database, which prevents it from sleeping.

## 9. Troubleshooting

| Symptom | Action |
| --- | --- |
| Lockfile/pnpm version error | Enable Corepack; keep pnpm 11.19.0 and the committed lockfile |
| Cannot find workspace package | Root must be `apps/web` with outside-root source enabled; upload the whole repository |
| `/api/*` gives 404 | Deploy Next.js with the included Pages API route; do not use static export |
| API returns 503 | Check the three runtime variables, public PostgreSQL hostname, TLS and cloud quotas; then inspect function logs |
| Health works but tables are missing | Run migrations against the same cloud database used by Vercel |
| Login gives CSRF_REJECTED | Open the exact `APP_URL` origin; remove trailing slash; redeploy after changes |
| Login works locally but not online | Check Secure cookies over HTTPS, same-origin `/api`, admin bootstrap and the production secret |
| Login rate-limited | Wait for the window to expire; do not disable limits; Vercel client IP handling is platform-scoped |
| All routes show Vercel login | Production deployment protection is blocking public visitors/device requests; account owner must configure public access |
| ESP32 gives 401/403 | Check enabled device type and individual token; never use a student/admin session as a device credential |
| ESP32 TLS failure | Verify CA certificate, synchronized clock, DNS and current hostname |
| Local PGlite locked/in use | Use one API process per data directory; do not open the same local data with migration/seed tools while the API runs |
| Missing data after deploy | Cloud database starts empty; local `.data` is not an automatic cloud backup/import |

## 10. Verification limits

The production build, automated software checks, local browser flows and public deployment checks are recorded in [deployment verification](docs/DEPLOYMENT_VERIFICATION.md). The public HTTPS site, serverless API, verified cloud database connection, secure sessions, controlled student/device writes and responsive admin browser flow passed. Mobile bearer API behavior and an Expo JavaScript export using the live API passed. GitHub push/automatic deployment, access from a separate physical network, native Expo installation and physical ESP32 operation remain unverified.

The workspace audit retains two version-based high alerts for Expo's `image-size` 1.2.1; the supplied patch disables the affected ICNS/JXL/HEIF parsers and the regression test passes. These are mobile build dependencies, not the Next.js API. The CSV parser was updated to the upstream patched release for [GHSA-8cw4-87c7-c6xx](https://github.com/advisories/GHSA-8cw4-87c7-c6xx). Do not suppress audit output or remove the existing patch.
