# Cricket AI Pro — GitHub-only deployment

The production app keeps three distinct prediction features:
- **Pre-Toss AI prediction:** neutral baseline, calculated before toss by averaging the four possible toss outcomes.
- **Post-Toss AI prediction:** recalculated for the actual/selected toss winner and bat/field decision.
- **Ilmi / Abjad prediction:** the separate Urdu-name, Abjad, captain, venue, Hijri-date and time compatibility calculation in the frontend.

The in-play/live win-probability prediction experiment is not part of the product. Live match fixtures and scores remain in the feed; only the live win-probability model is excluded.

## Refresh
- Frontend/data hosting: GitHub Pages.
- GitHub Actions scheduled fixture refresh: **every 15 minutes** (UTC; GitHub may delay scheduled starts). The schedule is intentionally kept at 15 minutes.
- Normal primary feed: one Highlightly `/matches` request per scheduled run, using the Actions secret `SECONDARY_API_KEY`. At 96 scheduled runs/day, the normal path uses up to 96 Highlightly requests/day.
- If Highlightly is unavailable or returns unusable data, Cricket Live Line Advance is tried as the backup using `RAPIDAPI_KEY`. The backup fetches one page and, when the provider reports a second page, makes one additional request. If the backup also fails, CricketData `currentMatches` is used as the emergency fixture fallback. Emergency fallback is not blocked by the hourly enrichment limit, so the site can still refresh when upstream providers fail.
- Optional CricketData enrichment is separate from emergency fallback. It runs only when Cricket Live Line Advance is the active feed, and only on scheduled runs during minute 00–14 of each UTC hour; the :15, :30, and :45 runs skip it. In that hourly slot it can make at most one `currentMatches` request and one `match_info` request for one active fixture missing toss details (up to 48 enrichment requests/day in the normal case). When CricketData itself is the emergency fixture provider, extra `match_info` calls are disabled to protect its free daily quota. Manual runs and push-triggered runs skip optional enrichment.
- Quota planning: normal Highlightly usage is up to 96 requests/day. If Highlightly is down and the backup is needed on every run, Cricket Live Line Advance can use up to 192 requests/day (96 runs × 2 pages); check the RapidAPI plan allowance for that failure scenario. These are separate provider quotas. The 15-minute schedule is not reduced to manage optional enrichment.
- Head-to-head and recent venue-form statistics are computed locally from the existing 2024–2026 match history, so they do not consume provider quota. Important model boundary: the current trained CatBoost/LightGBM runtime consumes 11 features, including venue name, toss decision and toss-winner identity; it does not consume the separate toss-stats artifact or the calculated venue-form columns. Those extra statistics must not be described as influencing predictions until a model-schema change is separately trained and validated. Weather is a separate optional context source: Open-Meteo's free API is non-commercial, requires attribution, and is not yet fed into the trained predictor. The ground directory currently marks its starter coordinates as needing verification, so weather must not be attached to a fixture until its venue coordinates are verified.
- CricketDatabase was evaluated as a possible toss/venue source. Its free key allows 50 calls/day but does not include the live-match endpoints; live data requires its Match Week plan. It is therefore not enabled as a free live-toss provider. See [official plan matrix](https://cricketdatabase.com/documentation/guides/plans) and [pricing](https://cricketdatabase.com/pricing).
- Existing CatBoost/LightGBM ensemble and Elo fallback calculations are mirrored in the workflow generator. It precomputes a neutral pre-toss baseline and four post-toss scenarios for each fixture, which the existing modal UI reads from a JSON snapshot.
- Runs are serialized to avoid concurrent provider requests. A manual workflow dispatch uses the same fixture-provider fallback chain but skips optional CricketData enrichment.

## Configure Pages
Repository Settings → Pages → Build and deployment → Source: **GitHub Actions**. Confirm the `SECONDARY_API_KEY`, `RAPIDAPI_KEY`, and `CRICKETDATA_API_KEY` Actions secrets are configured for the providers you use.

## Feed coverage note
Each run requests the Riyadh-local current date from Highlightly. The backup requests the UTC today-to-tomorrow date range, up to 100 items per page, and fetches every reported page (currently up to 2). The frontend displays all returned fixtures (live, upcoming, finished; T10, domestic, and international) and only removes duplicate match IDs. If the backup provider reports more than 2 pages, any page fails, pagination metadata changes between requests, the fetched count differs from the provider total, or IDs are missing/duplicated, that backup refresh is rejected and the fallback chain continues; the previous published snapshot is left untouched if all providers fail.

## Model artifacts preserved (immutable)
- `cricket_ensemble_modern.joblib`
- `latest_elo_ratings.joblib`
- `category_mappings.joblib`
- `toss_stats.joblib`

Workflow verifies the tracked Git blob SHA of all four files. They are not retrained or rewritten. Historical match data and ground data are also retained because prediction calculations, venue resolution and feed display depend on them.


### Team identity and provider aliases

All provider-to-model team aliases are maintained in `data/team_aliases.json` and shared by the browser and scheduled prediction pipeline. Matching removes known competition suffixes and normalizes punctuation, but preserves men's/women's identity and avoids fuzzy prefix matches. Short result aliases are accepted only when they uniquely identify one of the two teams in that fixture. Add new aliases to the shared registry and cover them with the Python and browser regression tests.
