# Security model and review

Passwords use bcrypt with cost 12 when accounts are created. Sessions are 32 random bytes, expire after seven days, and are stored only as HMAC-SHA256 digests using the deployment's AUTH_SECRET. Rotating that secret invalidates sessions and device credentials; re-provision devices afterward. Web responses set HttpOnly, SameSite=Lax cookies and Secure in production. Browser mutations validate the configured Origin. Native clients without cookies use explicit bearer sessions or a native-client login header. The browser never stores a session token in localStorage.

Every admin/student resource checks role on the server. Students are resolved from the session, not request-supplied user IDs. Deactivation updates user/student status transactionally and revokes their sessions. Only ADMIN can create administrators, alter financial/environmental assumptions, import history or read audit logs. MESS_ADMIN can manage operational attendance, students, fingerprints, meals and devices.

Device secrets are separate from user sessions. A device's token is shown once on creation/rotation and its digest is omitted from lists. Ingestion enforces status, device type and payload identity. Tokens must be kept private in the actual firmware configuration. Fingerprint images/templates are never uploaded; only a numeric sensor enrollment ID is sent.

Authentication attempts use persistent per-account and per-network-source limits. Device requests have a persistent per-device limit. Behind the web proxy, network-source limits aggregate proxied requests; size limits and reverse-proxy connection/rate controls should be tuned for real campus load. No untrusted X-Forwarded-For header is trusted. Public health checks expose availability only.

SQL values are bound through Drizzle. CSV exports escape cells and prefix spreadsheet formula-leading characters. JSON bodies, date ranges, page sizes, imports and exports have explicit bounds. Error responses never return stack traces, password hashes or database connection details. Operational changes write an audit entry in their transaction. Data responses use Cache-Control: no-store.

## Deployment controls

Use HTTPS for web/API/mobile/devices. Keep PostgreSQL private, use a least-privilege DB role, rotate credentials, back up data and apply package updates. `.env` and firmware private config files are ignored; `pnpm secrets:check` inspects working source and local Git history. This automated scan is a guard, not a guarantee that a production security assessment is unnecessary.

No public default administrator credentials are included. `pnpm run setup` creates random local credentials and `pnpm db:seed` uses them only for a development database. Production administrator creation reads a password from the process environment, never from committed source or command arguments.

## Known scope

No multi-tenant isolation, email password recovery, MFA, push notifications or campus identity provider is implemented. Sessions do not silently refresh: students sign in after expiry. The application is source-complete for the documented single-campus flows, with production rollout, independent review and physical integration remaining deployment tasks.

## Dependency review result

Available Drizzle/PostCSS/qs/UUID fixes are included. Two high version-based image-size findings remain in pnpm audit. The committed pnpm patch disables the affected ICNS/HEIF/JXL parsers, and a regression test verifies rejection under a timeout. This is a targeted mitigation, not an audit-clean claim. See VERIFICATION.md for advisory identifiers and the upstream-update follow-up. No user-supplied image parsing endpoint exists in the API.

New passwords are limited to 72 UTF-8 bytes so bcrypt cannot silently truncate them. Device status and credential rotation are rechecked while the ingestion transaction holds its device lock. Production startup requires an exact HTTPS browser origin. The source scanner also checks generated local credential values against source/Git objects without printing them.
