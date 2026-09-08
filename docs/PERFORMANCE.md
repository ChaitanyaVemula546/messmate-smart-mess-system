# Performance review

The API uses one PostgreSQL pool (maximum 10 connections), server-side pagination capped at 100, bounded date ranges, imports capped at 5,000 records/700 KB, exports capped at 50,000 rows and JSON bodies capped at 800 KB. Indexes cover date/meal attendance, preferences and waste, token uniqueness, rate-limit/session expiry and audit chronology. Attendance and measurement uniqueness is enforced by the database, avoiding client-only race protection. Waste ingestion serializes state updates per device.

Charts receive aggregated date/meal data instead of complete student histories. The operational dashboard polls every 20 seconds and stops its timer on unmount. Other screens reload on relevant state changes; mobile refreshes after writes and on foreground/pull refresh. No WebSocket or background billing service is needed. API responses containing private data are not cached.

Limits: substring student searches are not indexed for very large campuses; CSV import performs individual lookups/inserts and holds a transaction; audit pagination uses offsets; device listing is unpaginated; no distributed cache or queue is included. PGlite is for a single development process and is not a load-test substitute. Test real PostgreSQL query plans and campus peak arrival bursts before production. Run maintenance to prune expired session/counter rows, with the API stopped if using PGlite.

Measured smoke timings, bundle/build results and dataset size are in VERIFICATION.md. Those timings describe this demonstration environment only, not production latency guarantees or capacity claims.
