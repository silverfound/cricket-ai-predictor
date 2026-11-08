# Hosting migration decision

## Chosen shape

Use GitHub Pages for the static web/PWA frontend, while retaining a Python FastAPI service for the existing inference and protected business logic. PostgreSQL remains the durable source of license records. This separates the static website from the runtime that actually executes the trained models.

## Why a Pages-only rewrite is not equivalent

The current application loads CatBoost/LightGBM/Elo artifacts with joblib, calls a RapidAPI cricket feed using a private key, and checks device-bound licenses against PostgreSQL. A browser-only GitHub Pages app cannot safely perform those operations. GitHub Actions are finite workflow runs, not a persistent request/response server for customer devices. Moving model inference into browser JavaScript would require converting/reimplementing the models and exposing protected logic; that violates the model-preservation requirement.

## Preserve trained artifacts

Treat the four existing `.joblib` files as immutable release inputs:
- `cricket_ensemble_modern.joblib`
- `latest_elo_ratings.joblib`
- `category_mappings.joblib`
- `toss_stats.joblib`

The migration must copy these files without loading/saving them back out, retraining, or changing their bytes. Record SHA-256 checksums from the source checkout and compare them against the staged runtime image before release.

## Staged rollout

1. Build a static frontend deployment workflow with a configurable API base URL.
2. Package the existing FastAPI app and model files in a Python runtime; add readiness checks and bounded startup/model-load diagnostics without changing inference math.
3. Restrict CORS to the exact Pages origin; keep admin credentials and provider keys server-side.
4. Back up PostgreSQL, restore into the new database, and compare license counts/IDs/permissions before any cutover.
5. Run regression tests for model output parity, activation/device binding, admin actions, match feed caching, and browser API calls.
6. Cut over only after tests pass; retain the old host and database backup for rollback.

## Blockers before a live release

- Select and authorize a reliable Python host capable of the app's ML dependencies and memory footprint.
- Provision its secrets: `RAPIDAPI_KEY`, `DATABASE_URL`, `ADMIN_API_KEY`.
- Obtain a verified PostgreSQL backup and restore it.
- Confirm the production frontend origin/domain and any Android APK API URL.
- Run a real staging smoke test from a customer device.

No provider is silently selected here. The rejected Railway deployment file is intentionally excluded.
