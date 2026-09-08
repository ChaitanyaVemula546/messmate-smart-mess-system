# REST API reference

Base: `/api`. Web uses its same-origin Next.js proxy; mobile/devices call the shared API origin. JSON responses are `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code": "...", "message": "..." } }`. CSV exports return `text/csv`. Responses containing application data are not cached.

## Authentication

Web login sets `messmate_session`, an HttpOnly, SameSite=Lax cookie (Secure in production). Include the exact configured `Origin` on browser mutations. Native login uses `X-Messmate-Client: mobile`, no Cookie, and may omit Origin. Its response includes an opaque `token`; store it in SecureStore and send `Authorization: Bearer <session>` thereafter. Native token values are never exposed by web login.

Devices send `Authorization: Bearer <device-token>`; tokens are provisioned by a manager/admin and are independent of user sessions. Device ingestion does not require a browser Origin. Never send authentication/session secrets as device credentials.

| Method | Route | Access / inputs |
|---|---|---|
| GET | `/health` | Public; API and database availability |
| POST | `/auth/login` | `{email,password}`; cookie for web, token for native |
| GET | `/auth/session` | Active session; own user, role and student UUID |
| POST | `/auth/logout` | Revokes the supplied session and clears cookie |

## Student API

All routes require STUDENT. The backend resolves student ownership from the session; supplying another student ID is never accepted.

| Method | Route | Inputs / result |
|---|---|---|
| GET | `/student/meals?date=YYYY-MM-DD` | Today or tomorrow; windows, intentions, attendance and cutoff state |
| PUT | `/student/meals` | `{date,meal,response}`; response COMING or NOT_COMING |
| GET | `/student/history?page=1&pageSize=20` | Meal intentions and attendance combined; `kind=attendance` for only check-ins |
| GET | `/student/profile` | Own profile and assigned fingerprint ID; no password hash |

Meals are BREAKFAST, LUNCH and DINNER. Dates/windows use **Asia/Kolkata**. Cutoff and end times are exclusive boundaries: attendance starts at the meal start and stops at its end; intentions stop at the cutoff. Overnight windows are not supported. The mobile clock cannot bypass a server cutoff.

## Administration API

Unless marked ADMIN, these routes allow ADMIN and MESS_ADMIN. List pagination is one-based, defaults to 20, and is limited to 100 items per page. Date-range routes accept `date=YYYY-MM-DD` or `from=...&to=...`, default to today, and allow at most a 366-day difference (367 inclusive dates).

| Method | Route | Inputs / behavior |
|---|---|---|
| GET | `/admin/dashboard` | Daily/range totals, per-meal rows, trends, recent attendance, devices and settings |
| GET | `/admin/students` | Pagination, `search`, optional `status=ACTIVE/INACTIVE` |
| POST | `/admin/students` | Student fields below and initial password |
| PUT | `/admin/students/:uuid` | Full student profile; deactivation also revokes sessions |
| GET | `/admin/students/:uuid/history` | Paginated history |
| GET | `/admin/fingerprints` | Paginated mapping list; `search`, `mapped=yes/no` |
| PUT | `/admin/fingerprints` | `{studentId: studentUuid,fingerprintId: 1}`; both uniquely assigned |
| DELETE | `/admin/fingerprints/:studentUuid` | Remove database mapping; physical sensor template removal is separate |
| GET | `/admin/attendance?date=...&meal=LUNCH` | Paginated student status, `search`, expected/present/absent/unexpected summary |
| POST | `/admin/attendance` | `{studentId: studentUuid,date,meal,reason}`; audited manual arrival, no future date |
| GET | `/admin/waste` | Date range, pagination, optional `meal` or `UNASSIGNED`; raw/delta measurements |
| PUT | `/admin/preparations` | `{date,meal,weightKg,estimatedCost}`; upsert preparation per meal |
| GET | `/admin/devices` | Status, last seen/result, firmware label, capacity, online indicator; no token hashes |
| POST | `/admin/devices` | `{deviceId,name,type,capacityKg?,firmwareVersion?}`; one-time returned token |
| PATCH | `/admin/devices/:uuid` | `{status: ACTIVE/DISABLED}` and/or `{rotate:true}`; rotation returns new token once |
| GET | `/admin/settings/meals` | Three current windows |
| PUT | `/admin/settings/meals` | Array of three `{meal,start_time,end_time,cutoff_time}` using HH:mm |
| GET | `/admin/settings` | Current nullable assumptions |
| PUT | `/admin/settings` | **ADMIN**; full assumptions object below |
| GET | `/admin/predictions` | Date-range forecasts, sample count, source and historical evaluations |
| POST | `/admin/predictions` | `{date,holiday?,specialEvent?}`; next 1–7 days, explicitly demo baseline |
| POST | `/admin/predictions/evaluate` | Evaluate forecasts dated before today; missing sensor readings remain null |
| GET | `/admin/reports` | Date-range dashboard data plus period; UI supports charts and browser print |
| GET | `/admin/export/:kind` | CSV; kind attendance, students, waste, predictions or reports; at most 50,000 rows |
| POST | `/admin/import/attendance` | **ADMIN**; `{csv: "..."}`; row-level results and duplicate protection |
| GET | `/admin/audit-logs` | **ADMIN**; paginated actor/action/entity/metadata |
| POST | `/admin/administrators` | **ADMIN**; `{email,name,password,role: ADMIN/MESS_ADMIN}` |

Student profile fields: `studentId` (campus identifier), `registrationNumber`, `name`, `email`, `hostel`, `roomNumber`, optional `phone`, `status`. Initial account passwords must be at least 12 characters and no more than 72 UTF-8 bytes; profile editing does not change passwords. API parameters called `:uuid` and mapping/manual `studentId` use the internal UUID, whereas CSV `studentId` uses the campus identifier.

Settings object: `costPerKg`, `baselineWastePerStudent`, `co2PerKg`, `waterLitresPerKg`, `portionKg` (each number or null), `onlineThresholdMinutes` (integer 1–1440). Financial amounts use INR in the UI. Explicit zero is different from unconfigured null. The online indicator means a device authenticated recently; it does not prove hardware health.

CSV import headers are `date,meal,studentId,attendance`, with attendance PRESENT/ABSENT. Up to 5,000 rows and 700 KB text; quoted fields supported. PRESENT inserts once; duplicates count separately. ABSENT validates and counts as processed success, but creates no event and does not erase attendance. Imported arrivals have a null original check-in time. Errors report line numbers without raw database errors. All exports quote cells and neutralize spreadsheet formula prefixes; attendance export is an event report, not a round-trip import template.

## Fingerprint ingestion

`POST /iot/attendance`, authenticated FINGERPRINT_SCANNER device:

```json
{"fingerprintId":1}
```

A valid scan resolves the database mapping, checks an active student and current meal, and inserts an arrival. Its success result is also included at the top level for simple ESP32 clients:

```json
{
  "success": true,
  "status": "recorded",
  "student": {"id":"student-uuid","studentId":"campus-id","name":"Student name"},
  "meal": "LUNCH",
  "date": "YYYY-MM-DD",
  "data": {"status":"recorded","student":{"id":"student-uuid","studentId":"campus-id","name":"Student name"},"meal":"LUNCH","date":"YYYY-MM-DD"}
}
```

Repeated scans return `already_recorded` with HTTP 200. A database unique constraint protects even simultaneous scans. Numeric IDs must be integers from 1–1000; actual capacity depends on the physical sensor. IDs are global to the campus deployment, so multiple sensors must share a consistent enrollment map.

| HTTP | Error code | Meaning |
|---|---|---|
| 400 | INVALID_FINGERPRINT_ID | Invalid/extra body fields or out-of-range ID |
| 401 | UNAUTHORIZED_DEVICE | Missing/invalid/rotated credential |
| 403 | DEVICE_DISABLED / DEVICE_TYPE_MISMATCH | Disabled device or wrong device type |
| 404 | FINGERPRINT_NOT_REGISTERED | No mapping to an active student |
| 409 | NO_ACTIVE_MEAL | Receipt time is outside all configured windows |
| 429 | RATE_LIMITED | Too many device requests |

## Waste ingestion

`POST /iot/waste`, authenticated WASTE_MONITOR device:

```json
{"deviceId":"WASTE_BIN_01","weightKg":3.42}
```

Recommended retry-safe body (generate a new UUID once per new reading):

```json
{"deviceId":"WASTE_BIN_01","weightKg":3.42,"measurementId":"8b59c9a2-243f-49cd-aeb3-224612924c43","tare":false}
```

Response data includes `status`, `addedKg`, `measurementId` and, for a new event, server `date` and `meal`. `meal` is null outside meal windows. The baseline increases only when the measured bin weight exceeds its session high-water mark. An explicit tare starts a new session with zero increment; physically empty and calibrate the bin first. Exact retry IDs do not add rows or repeat a tare. Lower readings do not infer emptying. Send a measurement identifier on every firmware event.

Authentication, payload device identity, device status/type, finite nonnegative weight and configured capacity are checked. Invalid JSON/body returns 400; over-capacity is INVALID_WEIGHT; a payload device different from the credential is DEVICE_MISMATCH (403); reusing a measurement ID for changed weight/tare returns IDEMPOTENCY_CONFLICT (409). Unknown credentials return 401. Each device is limited to 120 requests per minute.

## Metric definitions and missing values

- Expected = number of COMING intentions; actual = unique check-ins. Neither is a trained prediction.
- Attendance agreement = max(0, 1 − abs(actual − expected) / expected) × 100. Null if expected is zero.
- Waste = sum of stored **delta_kg**, never sum of cumulative weight_kg. Out-of-window readings remain separate from meal totals.
- Waste per check-in = meal waste / actual when attendance is nonzero and attended meals have sensor observations.
- Waste percentage = meal waste / prepared kg × 100 only when all included meals have preparation and sufficient waste observations.
- Avoided waste estimate = max(0, actual × configured baseline kg/check-in − meal waste), only with observations for attended meals.
- Money/CO₂/water estimates multiply avoided waste by configured factors. They are assumption-based estimates, not direct savings or environmental measurements.

`has_waste` distinguishes a recorded zero from missing sensor data in metric rows and report CSV. API aggregate sums may be zero with no rows; clients must honor this flag and nullable derived metrics. No invented factors or dashboard numbers are used. See PREDICTIONS.md for baseline assumptions.
