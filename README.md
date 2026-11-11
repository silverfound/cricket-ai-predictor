# Cricket AI Pro — GitHub-only deployment

The production target preserves the current app UI and the four trained prediction artifacts while removing Render, FastAPI hosting, admin/customer licensing, and match permissions.

## Refresh
- Frontend/data hosting: GitHub Pages.
- GitHub Actions scheduled refresh: every 30 minutes (UTC; GitHub schedules can be delayed).
- Each workflow run makes up to two RapidAPI calls to Cricket Live Line Advance, using the Actions secret `RAPIDAPI_KEY`.
- CricketData is backup-only during normal operation; it is not polled on the schedule while the primary feed is healthy. It is called only if the primary feed is unavailable or invalid, with Highlightly as the final fallback. This removes the previous 48-call/day normal CricketData enrichment load.
- The primary Cricket Live Line Advance feed remains on the 30-minute cadence (up to two pages per run). This keeps the public live/upcoming fixture board fresh. Toss/score enrichment is no longer polled for every fixture.
- Head-to-head and recent venue-form statistics are computed locally from the existing 2024–2026 match history, so they do not consume provider quota. Important model boundary: the current trained CatBoost/LightGBM runtime consumes 11 features, including venue name, toss decision and toss-winner identity; it does not consume the separate toss-stats artifact or the calculated venue-form columns. Those extra statistics must not be described as influencing predictions until a model-schema change is separately trained and validated. Weather is a separate optional context source: Open-Meteo's free API is non-commercial, requires attribution, and is not yet fed into the trained predictor. The ground directory currently marks its starter coordinates as needing verification, so weather must not be attached to a fixture until its venue coordinates are verified.
- CricketDatabase was evaluated as a possible toss/venue source. Its free key allows 50 calls/day but does not include the live-match endpoints; live data requires its Match Week plan. It is therefore not enabled as a free live-toss provider. See [official plan matrix](https://cricketdatabase.com/documentation/guides/plans) and [pricing](https://cricketdatabase.com/pricing).
- Existing CatBoost/LightGBM ensemble and Elo fallback calculations are mirrored in the workflow generator. It precomputes neutral and four toss scenarios for each fixture, which the existing modal UI reads from a JSON snapshot.
- SportScore is queried only after a visitor clicks **Predict Winner** for a specific match: the browser looks up that day’s cricket fixtures, then requests one detail record for the selected match. Fixture lists and match details are cached in memory for 10 minutes. Four to five selected predictions therefore use approximately 5–6 SportScore calls per browser page session, not continuous polling. The visible Powered by SportScore attribution is included as required by its free-tier terms. SportScore detail fields are best-effort; toss is populated only if the response explicitly provides both toss winner and decision.
- Scheduled primary-feed maximum: 48 runs/day × 2 pages = 96 RapidAPI calls/day. Normal CricketData enrichment is zero calls/day while the primary provider succeeds. SportScore is user-triggered and cached; its current official terms state approximately 10,000 requests/24h/IP, while an older MCP README says 1,000, so the app uses a conservative usage pattern rather than relying on the larger number.

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
