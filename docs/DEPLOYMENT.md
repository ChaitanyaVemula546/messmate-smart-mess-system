# Deployment guide

The current single-project Vercel deployment instructions are in [DEPLOYMENT.md](../DEPLOYMENT.md).

That guide covers private GitHub import, the cloud PostgreSQL database, environment variables, migrations and first administrator, exact ESP32 contracts, free-tier constraints, validation, logs and rollback.

The older two-server hosting examples in `deployment/` are optional self-hosting references. Vercel uses the Next.js API adapter and needs no separate Express service or nginx proxy.

## Manual private GitHub upload

Follow [Private GitHub repository](../DEPLOYMENT.md#5-private-github-repository) in the current guide. Reuse the existing repository if available.
