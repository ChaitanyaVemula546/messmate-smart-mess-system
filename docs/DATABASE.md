# Database and migrations

The database package uses Drizzle's PostgreSQL schema and parameterized SQL interface with either the node-postgres or PGlite driver. Production uses a PostgreSQL connection pool. All business records live in one database.

| Table | Purpose |
|---|---|
| users | Hashed passwords, role, status and display name |
| students | Unique campus ID, user link, registration, hostel, room |
| sessions | Hashed opaque session, user and expiry |
| meal_windows | Start, end and response cutoff for each meal |
| meal_preferences | One intention per student/date/meal |
| attendance | One actual arrival per student/date/meal |
| fingerprint_mappings | Unique sensor template ID and student mapping |
| devices | Type, hashed token, status, capacity and waste high-water state |
| waste_measurements | Raw weight, attributed increment, event ID, tare/session and time |
| food_preparations | Prepared weight and estimated cost per date/meal |
| predictions | Source-labelled forecasts and inputs |
| prediction_results | Evaluation against completed historical meals |
| system_settings | Nullable cost, baseline, portion and environmental assumptions |
| audit_logs | Actor, action, entity and sanitized metadata |
| rate_limits | Persistent atomic request counters |
| schema_migrations | Applied migration ledger |

`0001_initial.sql` creates relations, defaults, uniqueness, check constraints and query indexes. `0002_historical_times.sql` permits null original check-in times on historical imports. `0003_unknown_waste.sql` preserves null actual waste for evaluation when there are no non-tare sensor observations. Migrations are transactional and serialized with a database lock; re-running them is safe. Add subsequent migration files in numeric order. The small migration runner supports semicolon-separated SQL statements; complex stored procedures should use a dedicated migration tool rather than placing semicolons inside procedural bodies.

PGlite default directory is `.data/messmate`, relative to the repository root. Only one running API/migration/seed process may own it. Stop `pnpm dev` before migration, seeding or maintenance. The seed refuses existing users and never deletes your data. Back up the directory with the process stopped.

## PostgreSQL

Install PostgreSQL locally, create a database and limited application role, and put the connection URL in the ignored `.env`. Alternatively use the optional Compose definition after setting private `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` values in your local environment. Never include passwords in command-line history or commits. For a managed server, configure TLS according to its provider; do not disable certificate verification to resolve connection problems.

```bash
pnpm db:migrate
# Optional only for an empty, nonproduction development database
pnpm db:seed
```

Use `pg_dump`/`pg_restore` for real PostgreSQL backups, manage connection credentials outside Git, and test restores before relying on the system. Retention policy for actual student records should be determined by the campus; the application does not silently delete attendance history.
