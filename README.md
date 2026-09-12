# MessMate

Smart Attendance. Smarter Cooking. Less Waste.

A smart hostel mess platform: **Next.js web + Expo student app + one Express API + PostgreSQL-compatible database**. All code is in this repository. Next.js now includes the existing API for a single Vercel deployment; local development still supports the separate API server. See the [production deployment guide](DEPLOYMENT.md) for cloud database and hosting setup.

**Live:** [MessMate](https://messmate-smart-mess-system.vercel.app), with its API at [the same domain under `/api`](https://messmate-smart-mess-system.vercel.app/api). Public HTTPS checks and all 17 controlled live workflow checks passed on Vercel Hobby, including login, student meal choices and device API writes. Test records were cleaned up. Source is pushed to the private GitHub repository; Vercel automatic deployment awaits its GitHub connection. Direct CLI deployment works. See [deployment verification](docs/DEPLOYMENT_VERIFICATION.md) for the tested scope.

**Current fingerprint update:** the sensor inventory API and website are deployed. The 48-test suite, lint, TypeScript, Next.js build, firmware compile and 17 live fingerprint checks passed; the fourth cloud migration is applied. Fingerprint-only firmware uploaded and booted successfully on COM4 using DIO/40 MHz. The live backend contains all 12 reported sensor IDs, with the existing ID 1 student assignment retained. On 12 September, a real ID 1 scan was confirmed as fingerprint lunch attendance in production. Follow the [ESP32 + R307 setup guide](docs/FINGERPRINT_SETUP.md) for enrollment and assignment, and the [Android app guide](docs/ANDROID.md) for the student app and release build.

## Start on your computer

**Android:** [Download MessMate 1.0.0](https://messmate-smart-mess-system.vercel.app/downloads/messmate-1.0.0.apk)
(17.12 MiB, Android 7.0+). Students use their existing website email/password.
The app uses the same cloud API, shows the assigned fingerprint ID and displays
fingerprint attendance. See [release verification and rebuild instructions](docs/ANDROID.md).

Install Node.js 22 or 24 and pnpm 11.19.0. From this directory:

```bash
pnpm install --frozen-lockfile
pnpm run setup
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000. The API runs on http://localhost:4000/api. Start commands can be run on Windows PowerShell as separate lines. Do not run database commands concurrently with an API process that owns the same PGlite directory: stop the API first.

`pnpm run setup` generates a private `.env` and `.demo-credentials.json`. Open the latter **locally** to read development login details. Never upload either file. Seed accounts use fictional `@messmate.local` email addresses. Seeding is explicit, refuses a nonempty user table, and is disabled in production. It creates 36 students and 35 completed days of sample history. Sample devices are disabled, and no cost/environment factors are invented. The sample data is for demonstration only.

The full [completion report](docs/FINAL_REPORT.md) covers all 25 requested delivery items. Executed checks and remaining manual work are in [verification](docs/VERIFICATION.md).

## What is included

- Landing page; shared login and role-aware admin/student portals.
- Student intentions for today/tomorrow, cutoff enforcement, attendance/meal history and profile.
- Student account creation/edit/deactivation; fingerprint mapping and history. The new [R307 workflow](docs/FINGERPRINT_SETUP.md) adds reported sensor IDs and student assignments with automatic refresh.
- Device provisioning with one-time tokens, enable/disable and credential rotation.
- Fingerprint attendance with database-enforced duplicate protection, active meal detection and manual attendance with audit reasons.
- Waste ingestion with capacity checks, explicit tare and retry identifiers; cumulative measurements do not multiply total waste.
- Live operational dashboard, attendance/waste charts, baseline savings/environment estimates, preparation records and printable reports.
- CSV import/export, audit trail, meal windows, administrator creation and system settings.
- Explicitly labelled demo baseline forecasts and historical evaluation, with a replaceable prediction interface.
- Expo student login, splash/loading, dashboard, meal plans, attendance and meal history, profile, settings and logout.
- Simulated hardware integration tests, firmware examples, migration files and deployment configuration.

## Architecture and source layout

```text
apps/
  web/             Next.js, serverless API adapter and development API proxy
  mobile/          React Native / Expo student application
  api/             Express API, security and domain modules
packages/
  database/        Drizzle schema, SQL migrations, DB adapters, seed
  types/           Shared domain and response types
  validation/      Zod input schemas
  api-client/      Shared fetch client for web and mobile
  shared/          Kolkata clock, CSV safety, report calculations
firmware/          Two ESP32 sketches and private-config examples
docs/              API, architecture, database, hardware, deployment and verification
scripts/           Setup, production bundling, cleanup, secret checking and export
tests/             Domain and database/API integration tests
```

Clients never connect directly to the database. Web uses an HttpOnly cookie through same-origin `/api`. Mobile uses an opaque bearer session stored in Expo SecureStore. Device credentials are independent of user sessions and stored as hashes on the server. See [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), and the current [deployment guide](DEPLOYMENT.md).

## Database

Local default: PGlite, an embedded PostgreSQL engine, stored in `.data/messmate`. Its SQL and Drizzle schema remain PostgreSQL-compatible. This is a **single-process development option**. Production must use PostgreSQL; the API refuses PGlite under `NODE_ENV=production`.

To use local PostgreSQL instead, set `DATABASE_URL` to your own connection string in `.env`, then run the same migrations and optional seed command. An optional Docker Compose database definition is included. It requires Docker, which was not available in the build environment. See [database setup](docs/DATABASE.md).

## Mobile app

For the live deployment, copy `apps/mobile/.env.example` to `apps/mobile/.env` and keep `EXPO_PUBLIC_API_BASE_URL=https://messmate-smart-mess-system.vercel.app/api`. Create a real student through the production admin portal and use that account. The Android JavaScript export passed with this address; installing and checking it on a physical phone remains a separate step.

For local development:

1. Run the shared API. Connect your computer and phone to the same trusted network.
2. Copy `apps/mobile/.env.example` to `apps/mobile/.env` and set `EXPO_PUBLIC_API_BASE_URL` to your computer's LAN address followed by `:4000/api`. Android Emulator uses `http://10.0.2.2:4000/api`. A physical phone cannot use your computer's `localhost`.
3. Run `pnpm --filter @messmate/mobile dev` and open with a compatible Expo Go client or an Android development build.
4. Sign in with a seeded student account. Administrator accounts use the website.

The API needs to be reachable through your firewall. Use HTTPS for any real deployment. Expo public variables contain only the public API address, never credentials. See [mobile guide](docs/MOBILE.md), including local Android builds that require no cloud build subscription.

## Verification commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm mobile:export
pnpm secrets:check
```

`pnpm build` compiles the API and builds the web app. `pnpm mobile:export` creates an Android JavaScript/assets bundle; it does **not** create an APK. Actual run results and unverified physical/native checks are recorded in [verification report](docs/VERIFICATION.md). Production publishing is not a prerequisite for source completion.

## Production deployment

The production app is live with Neon PostgreSQL and the first administrator created. All four migrations are applied, including the new fingerprint inventory table, and the new fingerprint API/UI deployment passed its live checks. Open the ignored root file `.production-credentials.json` locally for the admin login; never upload it. No fictional data was seeded and no paid services or billing were enabled. Use the [deployment guide](DEPLOYMENT.md) for updates, variables, logs and rollback. See the [fingerprint guide](docs/FINGERPRINT_SETUP.md) for the already-provisioned scanner and pending physical checks.

## Source control

Local Git history has been restored from the supplied source-history.bundle while preserving newer UI changes. The verified deployment source has been pushed to `main` in the [private GitHub repository](https://github.com/ChaitanyaVemula546/messmate-smart-mess-system), and the remote commit was confirmed. Private environment files, credentials and local databases were excluded. Complete the [Vercel GitHub connection](DEPLOYMENT.md#5-private-github-repository) to enable automatic deployment from future pushes.

To recreate a source ZIP after changes, commit the source and run `pnpm export` (requires Git and Python 3).

With your local development servers running, `pnpm smoke` checks their connection and login flows. After a build, `pnpm smoke:stack` checks the single-process production server using an isolated cloud test database and test-account variables; see [the guide](DEPLOYMENT.md#8-verify-redeploy-inspect-logs-and-roll-back). `pnpm deploy:check` verifies the public HTTPS endpoint and has passed against the live deployment.

## Honest limits

- A baseline provider is implemented; a trained ML model and calibration are future work.
- Native Android/iOS installation and physical ESP32/R307/HX711 operation require your equipment/toolchain.
- The included firmware examples require calibration, endpoint and root-certificate configuration.
- One campus is supported per deployment. Multi-campus tenancy, password reset emails, push notifications and offline event reconciliation are not implemented.
- Historical ABSENT imports validate the record but do not erase existing attendance. Unknown original check-in times are stored as null.
- Public hosting and real PostgreSQL connectivity passed verification; GitHub automatic deployment, separate-network access and physical-device network conditions still need verification.
