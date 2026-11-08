# Cricket AI Pro — GitHub-only deployment

The production target preserves the current app UI and the four trained prediction artifacts while removing Render, FastAPI hosting, admin/customer licensing, and match permissions.

## Refresh
- Frontend/data hosting: GitHub Pages.
- GitHub Actions scheduled refresh: every 30 minutes (UTC; GitHub schedules can be delayed).
- Each workflow run makes up to two RapidAPI calls to Cricket Live Line Advance, using the Actions secret `RAPIDAPI_KEY`.
- Existing CatBoost/LightGBM ensemble and Elo fallback calculations are mirrored in the workflow generator. It precomputes neutral and four toss scenarios for each fixture, which the existing modal UI reads from a JSON snapshot.
- Runs are serialized to avoid concurrent provider requests. A manual workflow dispatch consumes up to two API requests; avoid manual dispatches unless needed.
- Scheduled maximum use: 48 runs/day × 2 pages = 96 calls/day against the 100-call/day quota; avoid manual re-runs to preserve the 4-call buffer.

## Configure Pages
Repository Settings → Pages → Build and deployment → Source: **GitHub Actions**. Confirm the `RAPIDAPI_KEY` Actions secret is configured.

## Feed coverage note
Each run requests the UTC today-to-tomorrow date range, up to 100 items per page, and fetches every reported page (currently up to 2). The frontend displays all returned fixtures (live, upcoming, finished; T10, domestic, and international) and only removes duplicate match IDs. If the provider reports more than 2 pages, any page fails, pagination metadata changes between requests, the fetched count differs from the provider total, or IDs are missing/duplicated, the refresh fails safely and leaves the previous snapshot untouched. The 30-minute schedule allows up to 2 calls per run: 96 scheduled calls/day, below the 100-call quota.

## Model artifacts preserved (immutable)
- `cricket_ensemble_modern.joblib`
- `latest_elo_ratings.joblib`
- `category_mappings.joblib`
- `toss_stats.joblib`

Workflow verifies the tracked Git blob SHA of all four files. They are not retrained or rewritten.
