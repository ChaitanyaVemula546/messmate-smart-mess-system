# MessMate manual food-waste workflow

This update changes the active dashboard, export, and prediction baseline to **staff-recorded** waste. It does **not** change the already-working ESP32/R307 attendance firmware or API.

## Steps to run locally (from the recovered repository)

1. Back up any local data and working files. Keep your current working fingerprint device untouched.
2. Apply the supplied changed-source files to a separate working branch, e.g. `feature/manual-waste-no-loadcells`.
3. Run `corepack pnpm install --frozen-lockfile` with Node 22+ (or use your already working pnpm installation).
4. Copy `.env.example` to `.env`, configure private credentials locally, and **never commit `.env`**.
5. For an **isolated local or staging database**, run `corepack pnpm db:migrate`. Migration `0005_manual_waste.sql` creates manual records and correction history. Do not run this against production without an authorized backup and deployment plan.
6. Run `corepack pnpm typecheck`, `corepack pnpm test`, and `corepack pnpm build`. Resolve any errors before deploying.
7. Start development with `corepack pnpm dev`. Sign in as a MESS_ADMIN/ADMIN and open `/admin/waste`.

## How to use

- Choose **Record food waste** after a finished meal, enter unserved and plate waste separately, choose WEIGHED or ESTIMATED, and save.
- WEIGHED means staff used an ordinary scale independently of ESP32; ESTIMATED means no direct scale measurement.
- Enter zero only when zero waste was actually observed, not when no measurement exists.
- Each meal/date accepts one current record. To correct it, click **Edit**. Every correction is stored in `manual_waste_revisions` and the admin audit log.
- The waste dashboard lists entries, separates measured versus estimated kg, and exports CSV.
- The Reports and Overview screens now use manual observations. Old sensor measurements are archived separately and never silently converted into manual entries.

## Data/API

All endpoints below are guarded by the *existing* admin authentication, role checks, and CSRF middleware.

- `POST /api/admin/waste/manual`: `{date:'YYYY-MM-DD',meal:'LUNCH',unservedKg:4.2,plateKg:2.3,measurementMethod:'WEIGHED',remarks:''}`.
- `GET /api/admin/waste/manual?from=YYYY-MM-DD&to=YYYY-MM-DD&meal=LUNCH&page=1`: paginated records and weighed/estimated totals.
- `GET /api/admin/waste/manual/:id`: one record plus up to 100 changes.
- `PATCH /api/admin/waste/manual/:id`: correction of unservedKg, plateKg, measurementMethod, or remarks.
- `GET /api/admin/export/waste`: CSV of manual waste entries.

Amounts are kilograms with up to three decimal places, 0–5000 inclusive. Total is calculated server-side. Missing observations are **not** zero.

## Predictions

The future meal-intention count is used whenever it exists; otherwise historical observed attendance provides a transparent fallback when at least three previous dates exist.

The waste baseline is the mean of at least three previous **WEIGHED** manual waste records for the same meal, from the preceding 90 days. `ESTIMATED` observations and old IoT diagnostics are excluded. If there is insufficient history, future waste prediction is `null`, not a fabricated result. Food preparation kg requires a configured portion size.

This update implements a historical **baseline, not a validated Random Forest/XGBoost production model**. Any advanced ML training remains separate and must be evaluated chronologically on genuinely measured records.

## Safety and limitations

- Existing `firmware/messmate_fingerprint` files and `/api/iot/attendance`, `/api/iot/fingerprints` contracts are not modified.
- Legacy `/api/iot/waste` routes and `waste_measurements` remain for backward compatibility/history, but no active admin page or forecasting workflow depends on them.
- No production migration, build, hardware verification, or deployment was performed in the code-preparation environment. Follow the commands above and verify on a local/staging database.
- Never expose scanner tokens, database URLs, or admin secrets.
