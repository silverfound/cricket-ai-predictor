# Cricket AI Pro — GitHub-only deployment

The production target preserves the current app UI and the four trained prediction artifacts while removing Render, FastAPI hosting, admin/customer licensing, and match permissions.

## Refresh
- Frontend/data hosting: GitHub Pages.
- GitHub Actions scheduled refresh: every 15 minutes (UTC; GitHub schedules can be delayed).
- Each workflow run makes up to two RapidAPI calls to Cricket Live Line Advance, using the Actions secret `RAPIDAPI_KEY`.
- Highlightly is the first backup fixture source if Cricket Live Line Advance fails. CricketData is the tertiary fixture backup and a separate, best-effort enrichment source. On the scheduled hourly slot only (the `:00` run), the workflow makes at most one `currentMatches` request and one `match_info` request for an active fixture missing toss details. Normal enrichment remains capped at 48 CricketData calls/day (24 list + 24 detail); manual runs skip optional enrichment. If the primary feed fails, Highlightly is tried first; CricketData is tried only if Highlightly also fails.
- The primary Cricket Live Line Advance feed remains on the 15-minute cadence (one page per run). The primary feed makes at most one request per scheduled run (96/day), staying below its 100-hit/day allowance. The secondary Highlightly key is used only on primary-feed failure. A delayed hourly CricketData enrichment slot is skipped rather than making duplicate calls.
- Head-to-head and recent venue-form statistics are computed locally from the existing 2024–2026 match history, so they do not consume provider quota. Important model boundary: the current trained CatBoost/LightGBM runtime consumes 11 features, including venue name, toss decision and toss-winner identity; it does not consume the separate toss-stats artifact or the calculated venue-form columns. Those extra statistics must not be described as influencing predictions until a model-schema change is separately trained and validated. Weather is a separate optional context source: Open-Meteo's free API is non-commercial, requires attribution, and is not yet fed into the trained predictor. The ground directory currently marks its starter coordinates as needing verification, so weather must not be attached to a fixture until its venue coordinates are verified.
- CricketDatabase was evaluated as a possible toss/venue source. Its free key allows 50 calls/day but does not include the live-match endpoints; live data requires its Match Week plan. It is therefore not enabled as a free live-toss provider. See [official plan matrix](https://cricketdatabase.com/documentation/guides/plans) and [pricing](https://cricketdatabase.com/pricing).
- Existing CatBoost/LightGBM ensemble and Elo fallback calculations are mirrored in the workflow generator. It precomputes neutral and four toss scenarios for each fixture, which the existing modal UI reads from a JSON snapshot.
- Runs are serialized to avoid concurrent provider requests. A manual workflow dispatch uses the primary feed and skips optional CricketData enrichment; if the primary feed is unavailable, Highlightly is tried first and CricketData second.
- Scheduled primary-feed maximum: 96 runs/day × 1 page = 96 RapidAPI calls/day. If the provider reports multiple pages, only page 1 is fetched to preserve the 100-hit/day quota; the snapshot marks that feed as partial. Normal CricketData enrichment is separately capped at 48 calls/day. These are separate provider quotas.

## Configure Pages
Repository Settings → Pages → Build and deployment → Source: **GitHub Actions**. Confirm the `RAPIDAPI_KEY` Actions secret is configured.

## Feed coverage note
Each run requests the UTC current-day fixture range and fetches page 1 (up to 100 items) only. Additional pages are intentionally skipped to keep the 15-minute schedule within the daily API quota. The frontend displays all returned fixtures (live, upcoming, finished; T10, domestic, and international) and only removes duplicate match IDs. If the provider reports more than 2 pages, any page fails, pagination metadata changes between requests, the fetched count differs from the provider total, or IDs are missing/duplicated, the refresh fails safely and leaves the previous snapshot untouched. The 15-minute schedule allows exactly 1 primary call per run: up to 96 scheduled calls/day, below the 100-call quota.

## Model artifacts preserved (immutable)
- `cricket_ensemble_modern.joblib`
- `latest_elo_ratings.joblib`
- `category_mappings.joblib`
- `toss_stats.joblib`

Workflow verifies the tracked Git blob SHA of all four files. They are not retrained or rewritten.
