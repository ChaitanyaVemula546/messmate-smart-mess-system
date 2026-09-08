# Verification report

Verified in the local Linux build environment on **8 September 2026 (UTC)**, using Node.js 24.19.0 and pnpm 11.19.0. This report distinguishes executed software checks from configuration/examples that need target equipment.

## Executed checks

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Passed; all nine workspace projects resolved from the committed lockfile |
| `pnpm run setup` | Passed; fresh configuration generated matching private credentials, and existing configuration was preserved |
| `pnpm typecheck` | Passed for all packages, web, API, mobile, tests and TS scripts |
| Web route-type generation | `next typegen` passed; now included in web typecheck for a clean checkout |
| `pnpm lint` | Passed with zero warnings for apps, packages, tests and scripts |
| `pnpm test` | **32 passed, 0 failed, 0 skipped**, across three test files |
| Database migrations | All three migrations applied on PGlite; repeat execution passed |
| Fresh development seed | Passed: 36 fictional students and 35 distinct historical attendance dates |
| First-admin bootstrap | Passed against an isolated database; repeating it correctly refused an existing admin |
| API build | Passed with esbuild; compiled `apps/api/dist/server.js` started successfully |
| Production web build | Passed with Next.js 16.3.4/Turbopack; static and dynamic routes generated |
| Mobile TypeScript | Passed |
| Expo public configuration | Parsed successfully |
| Expo Android export | Passed: 2,523 modules, approximately 3.9 MB Hermes bundle |
| Connected compiled-server smoke | Passed: 17 HTML routes, 12 API read routes, five CSV exports, cookie/native login, 401/403 authorization and shared student identity |
| Source/Git secret scan | Passed for known credential patterns, private filenames and generated local credential values |

The connected smoke check is reproducible with `pnpm smoke:stack` after setup, migration, seed and build. It temporarily runs the built API and website together, then stops them. Use `pnpm smoke` if both are already running on the standard ports. These checks use HTTP clients; they do not execute browser JavaScript or inspect layout.

The compiled API smoke used development PGlite, while the website used its production build. Production PostgreSQL/TLS operation remains a deployment verification task. No production deployment or public preview URL was created.

## What the automated suite verifies

24 API/database tests cover public database health, authentication, safe cookies, native sessions, origin/header attacks, roles and ownership; mobile writes reflected in web reads; preference upsert/cutoffs; valid, invalid, unmapped, duplicate, off-window and disabled fingerprint scenarios; eight concurrent scans producing exactly one arrival; duplicate fingerprint assignment; waste capacity/identity/JSON errors, disabled/unknown credentials, rotation, measurement retries/conflicts, repeated/lower snapshots, tare and out-of-window attribution; measured dashboard totals; assumptions/preparation/report persistence; student deactivation and session revocation; historical CSV imports/errors/duplicates/null times; manual attendance/audit; demo prediction generation/evaluation; logout and expiry.

Seven domain tests cover Kolkata date boundaries, inclusive/exclusive windows, overlapping settings, missing-data/assumption semantics, CSV formula safety and bcrypt's input-length boundary. One dependency regression test executes malformed ICNS/HEIF/JXL inputs under a timeout, verifies the patched parser rejects them without hanging, and verifies ordinary PNG dimension reading still works.

## Dependency review

Available fixes were applied: Drizzle ORM 0.45.2, PostCSS 8.5.28, qs 6.16.0 and UUID 11.1.1. The final production-dependency audit reports **two high findings, zero moderate and zero critical**. Both are version-based reports for the mobile build's transitive `image-size` package:

- GHSA-w3rx-r6r6-pgpr: ICNS parser loop.
- GHSA-5p2g-fcmc-qvqq: JXL/HEIF parser loops.

The registry exposed image-size 2.0.2 as latest and did not contain the advisory's stated 2.0.3 fixed release. `patches/image-size@1.2.1.patch`, enforced by pnpm's patchedDependencies/lockfile, replaces the affected format handlers with bounded header checks and immediate rejection. That disables ICNS, container JXL and HEIF-family assets (including AVIF) in this parser. Use PNG/JPEG assets in the mobile build. The regression test passed. The API has no image-upload endpoint. The audit still flags the package version and is **not reported as clean**. Revisit the patch when an upstream compatible fix is published and rerun the build/tests; do not remove it without replacement.

The package review and code scan are not a penetration test or an independent production security certification.

## Performance evidence

On the seeded local PGlite demonstration, eight sequential authenticated 36-day dashboard requests through the built Next.js proxy averaged **34 ms**, with a maximum of **43 ms**. The dataset contains 36 students and 35 seeded historical dates. This is a warm local smoke measurement, not a throughput/load test. See PERFORMANCE.md for bounded queries, indexes and scaling limits.

## Remaining manual verification

| Area | Status / required verification |
|---|---|
| Browser/UI | The available browser could not open this environment's local preview (ERR_BLOCKED_BY_CLIENT). Inspect landing/login/admin/student screens, forms, table scrolling, charts, mobile viewport and console in a local browser. |
| Native app | No Android emulator/SDK or connected phone was available. Verify SecureStore, splash, login/restore/expiry/logout, touch navigation, foreground/pull refresh and the API address on a real device. |
| APK / iOS | No APK/IPA was built. Expo export is JavaScript/assets only. Local native builds need Android SDK/JDK or macOS/Xcode and signing configuration. |
| ESP32 fingerprint | **SOFTWARE VERIFIED; REQUIRES PHYSICAL HARDWARE VERIFICATION.** Compile with Arduino libraries, confirm power/UART/enrollment/TLS, then test actual scans and duplicate behavior. |
| Waste scale | **SOFTWARE VERIFIED; REQUIRES PHYSICAL HARDWARE VERIFICATION.** Confirm bridge wiring, calibration, stability, capacity, persistent offset/tare, retained retry event, power loss and HTTPS. |
| Firmware compilation | Arduino CLI/toolchain was unavailable; sketches were inspected but not compiled or flashed. |
| PostgreSQL/operations | SQL migrations were executed in embedded PostgreSQL/PGlite. External PostgreSQL, connection TLS, backups/restore and peak load still need target verification. |
| Deployment examples | Docker, Nginx and systemd configurations were not executed here. GitHub CI was not run remotely. No hosting/billing was enabled. |
| ML | Current provider is an explicit demo historical baseline. No trained model, calibrated confidence or validated cooking recommendation exists. |

## Manual browser acceptance flow

1. Follow README setup and open the landing page, then sign in as the generated demo administrator.
2. Check dashboard charts; search/page students; create and deactivate a test account; verify validation/dialogs and duplicate fingerprint errors.
3. Create a test device, retain its token privately, rotate/disable it, and confirm only the current enabled credential works.
4. Review meal windows/cutoffs, attendance, preparation/waste, reports/CSV, audit entries and demo forecasts.
5. Sign in separately as a student; change tomorrow's meal intention in web and confirm it in the mobile app after refresh, then reverse the direction.
6. Verify logout, expired/disabled access, narrow-screen navigation, keyboard focus, empty/error/loading states and browser console. Test target hardware separately using its guides.
