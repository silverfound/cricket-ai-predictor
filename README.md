# Cricket AI Predictor

Migration preparation is isolated on `migration/github-pages-frontend`. Production `main` remains unchanged.

## Immutable trained models

These existing trained artifacts must remain byte-for-byte unchanged throughout the hosting migration:

- `cricket_ensemble_modern.joblib`
- `latest_elo_ratings.joblib`
- `category_mappings.joblib`
- `toss_stats.joblib`

Do not retrain, regenerate, replace, or resave them. Any future model change requires separate explicit approval.

## Target architecture

- **GitHub Pages:** static customer frontend and PWA.
- **Python FastAPI service:** existing model inference, live cricket feed proxy, and protected licensing API.
- **PostgreSQL:** persistent license and permission data, migrated only after verified backup/restore.
- **Admin panel:** authenticated API operations; secrets stay server-side.

GitHub Pages alone cannot execute Python/joblib models, keep provider credentials secret, or provide a persistent authenticated API/database. GitHub Actions are finite workflow runs, not a 24/7 API server.

## Release gates

1. Select a Python host capable of the existing ML dependencies and memory requirements.
2. Back up PostgreSQL and verify restore; compare license IDs, counts, and permissions.
3. Record and compare SHA-256 hashes for all four model artifacts.
4. Test model inference parity, match feed, activation/device binding, admin operations, and frontend CORS on staging.
5. Configure the Pages frontend to use the staging API URL.
6. Cut over only after all tests pass; keep the old host and backup for rollback.

## Runtime secrets

- `RAPIDAPI_KEY`
- `DATABASE_URL`
- `ADMIN_API_KEY`

Store these only in the selected host's secret manager. Never commit them or expose them in browser JavaScript.

## Current status

Preparation only. No production deployment, database migration, DNS change, or customer cutover has occurred. The Python hosting provider, secrets, production database backup, and staging smoke test are still required before release.
