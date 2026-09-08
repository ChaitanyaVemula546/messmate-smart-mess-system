# MessMate

Smart Attendance. Smarter Cooking. Less Waste.

A locally runnable smart hostel mess platform: **Next.js web + Expo student app + one Node.js API + PostgreSQL-compatible database**. All code is in this repository. No website builder, paid authentication service, AI API or paid hosting subscription is needed to develop or demonstrate it.

## Start on your computer

Install Node.js 22 or 24 and pnpm 11.19.0. From this directory:

```bash
pnpm install --frozen-lockfile
pnpm setup
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000. The API runs on http://localhost:4000/api. Start commands can be run on Windows PowerShell as separate lines. Do not run database commands concurrently with an API process that owns the same PGlite directory: stop the API first.

`pnpm setup` generates a private `.env` and `.demo-credentials.json`. Open the latter **locally** to read development login details. Never upload either file. Seed accounts use fictional `@messmate.local` email addresses. Seeding is explicit, refuses a nonempty user table, and is disabled in production. It creates 36 students and 35 completed days of sample history. Sample devices are disabled, and no cost/environment factors are invented. The sample data is for demonstration only.

## What is included

- Landing page; shared login and role-aware admin/student portals.
- Student intentions for today/tomorrow, cutoff enforcement, attendance/meal history and profile.
- Student account creation/edit/deactivation; fingerprint mapping and history.
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
  web/             Next.js application and same-origin API proxy
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

Clients never connect directly to the database. Web uses an HttpOnly cookie through its `/api` proxy. Mobile uses an opaque bearer session stored in Expo SecureStore. Device credentials are independent of user sessions and stored as hashes on the server. See [architecture](docs/ARCHITECTURE.md) and [security](docs/SECURITY.md).

## Database

Local default: PGlite, an embedded PostgreSQL engine, stored in `.data/messmate`. Its SQL and Drizzle schema remain PostgreSQL-compatible. This is a **single-process development option**. Production must use PostgreSQL; the API refuses PGlite under `NODE_ENV=production`.

To use local PostgreSQL instead, set `DATABASE_URL` to your own connection string in `.env`, then run the same migrations and optional seed command. An optional Docker Compose database definition is included. It requires Docker, which was not available in the build environment. See [database setup](docs/DATABASE.md).

## Mobile app

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

## First real deployment

Apply migrations to an empty PostgreSQL database, create a private administrator using the bootstrap script described in [deployment](docs/DEPLOYMENT.md), and configure HTTPS/API addresses. Do not seed fictional data in production. Provision and test physical devices separately. No paid services or billing have been enabled.

## Source control

Local Git is initialized with checkpoints. The project is not connected to a remote repository. Follow [GitHub upload instructions](docs/DEPLOYMENT.md#manual-private-github-upload); use a private repository named `messmate-smart-mess-system`. Credentials and development database files are excluded from the export.

## Honest limits

- A baseline provider is implemented; a trained ML model and calibration are future work.
- Native Android/iOS installation and physical ESP32/R307/HX711 operation require your equipment/toolchain.
- The included firmware examples require calibration, endpoint and root-certificate configuration.
- One campus is supported per deployment. Multi-campus tenancy, password reset emails, push notifications and offline event reconciliation are not implemented.
- Historical ABSENT imports validate the record but do not erase existing attendance. Unknown original check-in times are stored as null.
- Production hosting, real PostgreSQL network configuration and physical-device network conditions must be verified in the target environment.
