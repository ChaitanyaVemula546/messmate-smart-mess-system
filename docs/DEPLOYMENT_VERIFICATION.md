# Deployment verification — updated 11 September 2026

## Status

**LIVE: public Vercel website and same-origin API connected to cloud PostgreSQL. Source is pushed to private GitHub; automatic Vercel deployment is pending its GitHub connection.**

Website: [https://messmate-smart-mess-system.vercel.app](https://messmate-smart-mess-system.vercel.app). API: [https://messmate-smart-mess-system.vercel.app/api](https://messmate-smart-mess-system.vercel.app/api). Deployment `dpl_kP1a3XXPB3XhWBcymozRZTnwxrZJ` completed through Vercel CLI 59.14.0 on the verified Hobby plan, with an approximately 52-second production build. No paid service was enabled.

The supplied folder had no `.git`; its history was restored from `source-history.bundle`, with all newer local UI/animation changes retained. `origin` points to `https://github.com/ChaitanyaVemula546/messmate-smart-mess-system.git`. On 11 September, authenticated GitHub access verified that this repository is private and permits pushes. The remote was empty before publication. The production baseline was committed and pushed as `0e36665e342596afa61008c8c7e82366b626ac3d`, and `git ls-remote` confirmed the matching `main` SHA. All 51 staged file paths were reviewed, with zero private/build paths; the pre-push secret scan passed for 250 source/history text objects. Git author identity was configured only for this repository. Vercel's GitHub connection remains pending; direct CLI deployment is working.

## Public deployment checks

| Check | Result |
| --- | --- |
| Vercel configuration | Next.js, root `apps/web`, outside-root source enabled, Node 24.x, pnpm 11.19.0 through Corepack |
| Function location | `sin1` (Singapore), Fluid Compute with basic configuration on Hobby |
| Cloud database | Existing Neon pooled PostgreSQL in `ap-southeast-1`; connection succeeded with certificate-verifying TLS |
| Database initialization | Three existing migrations applied to the empty cloud database; first administrator bootstrapped; no demo seed |
| Private runtime configuration | `DATABASE_URL` and `AUTH_SECRET` configured as sensitive production variables; exact canonical `APP_URL` configured |
| Private admin credentials | Stored locally in ignored `.production-credentials.json`; excluded from Git and Vercel uploads |
| Public HTTPS pages | The public check's four pages and the live workflow harness's 17 HTML routes passed |
| Public database health | `/api/health` returned HTTP 200 with `database: connected` |
| Protected user APIs | Admin student listing and student profile returned 401 without a session |
| Device authentication | Both IoT POST endpoints returned 401 without device credentials |
| Exact-origin CORS | Login preflight returned 204 and the canonical allowed origin |
| `pnpm deploy:check` | Fully passed against the production domain; this command makes no record changes |
| Live workflow harness | 17 steps passed, zero failed, zero skipped; completed in 16.783 seconds against the public domain |
| Production web sessions | Real administrator login returned Secure, HttpOnly, SameSite=Lax cookies; database-backed identity and logout invalidation passed |
| Admin APIs and security | Admin read routes/dashboard, five CSV exports, CSRF rejection and role boundaries passed |
| Student meal choices | Temporary student creation, cookie login/profile, tomorrow's meal-choice save, independent readback and history passed |
| Mobile bearer API | Same student identity as the web session; a mobile-authenticated write was visible through the web session |
| Fingerprint attendance API | Two temporary devices provisioned, fingerprint mapped, DINNER attendance written, duplicate protection and student history verified |
| Waste API | Controlled 0.125 kg reading, retry/idempotency, conflicting retry, device boundaries and admin readback passed |
| Fixture cleanup | Exact generated student/device/data fixtures and verification sessions removed successfully; final SQL counts: 1 admin, 0 students, 0 devices, 0 attendance, 0 preferences, 0 waste records, 0 sessions |
| Production browser | Admin login, dashboard with three charts, 390 × 844 viewport with document width 390 (no horizontal overflow), and sign-out back to login passed; no page errors |
| Production error logs | No error-level entries found in the inspected 20-minute window |
| Public JavaScript secret scan | Downloaded 16 JavaScript asset URLs linked from home, login, admin dashboard and student meals; zero matches for the configured production auth secret, database URL/database password or admin password |

The controlled workflow harness was run from the ignored `.test-output/live-verify.mts` against the real public HTTPS API and Neon database. It used temporary student/device records, verified writes through independent reads, and successfully cleaned up only its generated fixtures and sessions. These checks establish software/API behavior on Vercel; the device requests were simulated HTTP requests, not physical sensor readings. The separate read-only `pnpm deploy:check` remains suitable for routine reachability checks without creating records.

## Executed checks

| Check | Result |
| --- | --- |
| Node/pnpm | Node 24.20.0, pnpm 11.19.0 |
| Frozen lockfile install | Passed |
| Workspace TypeScript checks | Passed, including web, API, Expo and tools |
| ESLint | Passed with zero warnings allowed |
| Vitest | 40 passed: 24 domain/API integrations, 8 production adapter/config cases, 7 shared-domain cases, 1 mobile parser-patch regression |
| Production build | Passed for bundled Express and Next.js 16.3.4 |
| Next route output | Home/login prerendered; admin/student dynamic; `/api/[[...path]]` dynamic server route |
| Production rewrites | Empty: no localhost API destination |
| Server API trace | 1,010 traced files, approximately 21 MiB; no `.env`, `.data`, demo credentials or private firmware config found |
| Client bundle secret scan | Zero matches for the existing configured secret/password/token values |
| Source/history secret scan | Passed; 250 text objects in the prior completed local verification |
| Local smoke | 17 HTML routes, 12 API read routes, 5 CSV exports; student/admin access boundaries and web/native student identity passed |
| Dashboard local timing | 8 reads, mean 29 ms, max 37 ms in one local run; not a cloud latency estimate |
| Expo Android export | Passed again with `EXPO_PUBLIC_API_BASE_URL=https://messmate-smart-mess-system.vercel.app/api`; 2,523 modules, approximately 3.9 MB Hermes bundle; this is not an APK/native-device test |
| Production dependency audit | CSV parser advisory resolved by csv-parse 7.0.2; two existing image-size alerts remain for patched Expo build dependency |

The automated production suite exercises the API adapter through **Next.js's actual API resolver**, including its request/cookie/response helpers. It uses a disposable in-memory PostgreSQL-compatible database with production application security settings. It verifies Secure/HttpOnly/SameSite cookies, persisted sessions after a fresh app instance, exact-origin CORS/preflight and CSRF rejection, shared database rate limits, Vercel-scoped client IP handling, body-size limits, malformed JSON, hardware authentication, query strings, and health/404 behavior. It also verifies production TLS/pool configuration and refusal of laptop database hosts. That suite does not exercise a real cloud TLS handshake; the separate successful Neon connection and public health check above cover actual cloud connectivity.

The original integration suite continues to cover meal choices and cutoffs, role enforcement, student/fingerprint management, attendance deduplication, waste/tare/retry behavior, analytics calculations, CSV operations, sessions and device credential rotation.

## Browser checks

Against the live public HTTPS deployment, a dedicated browser session verified administrator login, three dashboard charts, a 390 × 844 viewport with no horizontal overflow, and logout returning to the login page. No browser page errors were reported. This mobile viewport check did not use a physical phone or a separate cellular network.

Using a dedicated agent-browser Chrome session against the existing local development stack:

- Home, login, admin dashboard and student portal loaded.
- Admin/student logins and logout worked with the existing private demo credentials; no credentials were printed.
- Admin dashboard rendered three charts and its KPI/table content.
- At a 390 × 844 viewport, admin and student document widths were 390 pixels (no horizontal overflow).
- Tomorrow's existing breakfast preference was saved again and confirmed after refresh; its original value was preserved.
- No browser page errors were reported during these flows.

Before cloud configuration was available, using a separately started **compiled production Next.js server** on local port 3101:

- Home, login, `/admin/attendance` and `/student/meals` returned HTML 200 on direct loads.
- Home rendered on desktop/mobile; the illustration replay control worked without reported page errors.
- Mobile document width matched the 390-pixel viewport.
- `/api/health` returned sanitized HTTP 503 because cloud runtime configuration was intentionally absent. It did not silently proxy to the laptop API.
- This temporary verification server and dedicated browser sessions were stopped afterward. The user's existing development servers were left running.

## Remaining limits

The private GitHub source push is complete. Automatic Vercel deployment still needs the GitHub account/repository connection in the existing Vercel project's Git settings and a successful Git-triggered release. The public site and API work independently of that integration. Access from a separate physical network, such as a phone on cellular data, has not been verified. Platform-specific lifecycle and forwarded-IP behavior have automated software coverage, but were not separately stress-tested across multiple live Vercel instances. `pnpm smoke:stack` requires an isolated cloud test database and private test accounts and was not run against the production database.

Real ESP32/R307/HX711 operation, TLS root trust on the devices, calibration, and native Expo installation were not tested. Simulated device requests successfully reached the production API and wrote controlled attendance/waste records. The existing hardware payloads and endpoint paths were preserved; both firmware configuration examples now use the production hostname. The Expo export was verified with the real public API URL, and the release guard refuses the Android emulator fallback outside development.

The registry audit cannot recognize the supplied `image-size` 1.2.1 source patch. It still reports two high version-based advisories in Expo's build chain. The repository regression test confirms that the affected parsers are disabled and PNG still works. Do not remove the patch or describe the full workspace audit as clean. A full dev-dependency audit also reports the existing Vitest 3 mock-server advisory; verification uses `vitest run`, not a publicly exposed Vitest server.

See [DEPLOYMENT.md](../DEPLOYMENT.md) for exact account setup, variables, database commands, ESP32 endpoints, logs and rollback instructions.
