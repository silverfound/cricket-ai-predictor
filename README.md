# Cricket AI Pro — GitHub-only deployment

The production target preserves the current app UI and the four trained prediction artifacts while removing Render, FastAPI hosting, admin/customer licensing, and match permissions.

## Refresh
- Frontend/data hosting: GitHub Pages.
- GitHub Actions scheduled refresh: every 15 minutes (UTC; GitHub schedules can be delayed).
- Each workflow run makes exactly one RapidAPI call to Cricket Live Line Advance, using the Actions secret `RAPIDAPI_KEY`.
- Existing CatBoost/LightGBM ensemble and Elo fallback calculations are mirrored in the workflow generator. It precomputes neutral and four toss scenarios for each fixture, which the existing modal UI reads from a JSON snapshot.
- Runs are serialized to avoid concurrent provider requests. A manual workflow dispatch also consumes one API request.
- Scheduled nominal use: 96 calls/day against a 100-call/day quota; leave room by avoiding manual re-runs.

## Configure Pages
Repository Settings → Pages → Build and deployment → Source: **GitHub Actions**. Confirm the `RAPIDAPI_KEY` Actions secret is configured.

## Feed coverage note
Each run requests the UTC today-to-tomorrow date range in one provider call, page 1, up to 50 items. The frontend displays all returned fixtures (live, upcoming, finished; T10, domestic, and international) and only removes duplicate match IDs. If the provider reports more than one page for the requested date range, the refresh fails safely rather than publishing a knowingly incomplete snapshot.

## Model artifacts preserved (immutable)
- `cricket_ensemble_modern.joblib`
- `latest_elo_ratings.joblib`
- `category_mappings.joblib`
- `toss_stats.joblib`

Workflow verifies the tracked Git blob SHA of all four files. They are not retrained or rewritten.
