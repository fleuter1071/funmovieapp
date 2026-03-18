## Date/time
2026-02-26 08:49:09 -05:00

## Feature name
IMDb Movie Card Button + Local TMDB Secret Configuration

## Summary
Added an IMDb-branded button to each movie card that opens the movie's IMDb title page in a new tab when an IMDb ID is available. Added local environment-variable handling for TMDB credentials and excluded secret files from git tracking.

## Files changed
- C:\Users\dougs\Movie_Fun_Codex\src\ui\renderers.js
- C:\Users\dougs\Movie_Fun_Codex\styles\main.css
- C:\Users\dougs\Movie_Fun_Codex\server\app.js
- C:\Users\dougs\Movie_Fun_Codex\.gitignore
- C:\Users\dougs\Movie_Fun_Codex\.env.example
- C:\Users\dougs\Movie_Fun_Codex\.env (local secret file)
- C:\Users\dougs\Movie_Fun_Codex\src\assets\IMDBlogos\IMDb_PrimaryLogo_Black.svg (used by UI)

## Assumptions
- Search results include valid `imdbId` for most movies.
- IMDb links should always open in a new tab.
- The black IMDb logo on a gold button is the preferred accessible/brand-forward style for this dark theme.
- TMDB credentials should be loaded from local env, not hardcoded in source.

## Known limitations
- No TMDB fallback lookup is implemented yet when `imdbId` is missing.
- If a movie lacks `imdbId`, the IMDb button is shown disabled.
- `.env` parsing is simple key/value parsing and does not support advanced dotenv syntax.

## Key Learnings
- Existing movie data flow already carries `imdbId`, so IMDb linking can be implemented fully client-side with low risk.
- Keeping secrets in `.env` plus `.env.example` prevents accidental commits while keeping onboarding clear.
- In this environment, detached local server startup sometimes needs an out-of-sandbox process to persist.

## Remaining TODOs
- Add optional TMDB-based IMDb ID enrichment for records missing `imdbId`.
- Add automated UI tests for IMDb button render/open/disabled states.
- Decide whether to surface a tooltip/message when IMDb is unavailable.

## Next step
Implement TMDB fallback enrichment for missing IMDb IDs in server search normalization, then keep the same frontend button behavior.

## Date/time
2026-03-02 14:25:00 -05:00

## Feature name
Movie Coziness Rating System, Card Action Redesign, and Trailer Fallback Hardening

## Summary
Implemented end-to-end coziness ratings with API + storage services (Supabase and SQLite fallback), frontend save/load flows, and multiple UX iterations culminating in a strict single-column action stack on movie cards. Added merged cozy accordion interaction, improved mobile touch targets, and fixed trailer resolution logic so non-playable direct-source responses correctly fall back to YouTube.

## Files changed
- C:\Users\dougs\Movie_Fun_Codex\server\app.js
- C:\Users\dougs\Movie_Fun_Codex\server\services\cozinessService.js
- C:\Users\dougs\Movie_Fun_Codex\server\services\cozinessSqliteService.js
- C:\Users\dougs\Movie_Fun_Codex\server\services\cozinessStore.js
- C:\Users\dougs\Movie_Fun_Codex\server\services\imdbService.js
- C:\Users\dougs\Movie_Fun_Codex\src\api\client.js
- C:\Users\dougs\Movie_Fun_Codex\src\main.js
- C:\Users\dougs\Movie_Fun_Codex\src\ui\renderers.js
- C:\Users\dougs\Movie_Fun_Codex\styles\main.css
- C:\Users\dougs\Movie_Fun_Codex\SUPABASE_MOVIE_COZINESS_SCHEMA.sql

## Assumptions
- Local development should continue functioning without Supabase by using SQLite fallback where configured.
- Production should use Supabase with valid `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `COZINESS_STORE=supabase`.
- Card action hierarchy should prioritize trailer playback as the primary CTA and reduce visual competition from other actions.

## Known limitations
- UI validation was primarily manual; no browser E2E suite currently verifies card interaction states.
- Trailer discovery still depends on third-party sources and can degrade when upstream endpoints change behavior.
- Supabase data visibility depends on confirming the correct project/table (`movie_coziness_ratings`) and environment configuration alignment.

## Key learnings that you can bring with you to future sessions
- Keep local and hosted storage paths explicit and observable to avoid confusion about where ratings are persisted.
- For trailer URLs, "reachable" is not enough; treat only playable media responses as direct-source success and fallback otherwise.
- Mobile card UX improves significantly when actions are a single full-width vertical stack with a clear CTA hierarchy.

## Remaining TODOs
- Add automated UI regression/E2E coverage for card accordions, save interactions, and watch-provider toggle behavior.
- Add lightweight diagnostics/logging for active storage backend at runtime to reduce env debugging time.
- Consider optimistic UI and clearer save state transitions for community cozy score interactions.

## Next steps
1. Add Playwright (or equivalent) smoke flows for trailer, where-to-watch expand/collapse, and cozy save/close interactions.
2. Add a small admin/debug endpoint or startup log line showing active cozy store backend (`sqlite` vs `supabase`).
3. Run one final cross-browser manual pass after deployment to confirm Supabase writes and trailer fallback behavior in production.
## 2026-03-04 11:10 ET - Coziness Leaderboard + Mobile Navigation

### Date/time
2026-03-04 11:10 ET

### Feature name
Coziness Leaderboard + Two-Page Mobile Navigation

### Summary
Implemented a new leaderboard page and mobile-first navigation between Discover and Leaderboard. Added backend leaderboard API with genre filtering and sort order controls, plus frontend ranked-list rendering. Added metadata enrichment/backfill flow so legacy cozy-rated movies can resolve title/year/poster/genres via TMDB for leaderboard display.

### Files changed
- index.html
- src/main.js
- src/api/client.js
- src/ui/renderers.js
- styles/main.css
- server/app.js
- server/services/cozinessStore.js
- server/services/cozinessSqliteService.js
- server/services/cozinessService.js
- server/services/tmdbService.js
- SUPABASE_MOVIE_COZINESS_SCHEMA.sql
- test/api.test.js

### Assumptions
- Coziness is a single global movie score (last write wins), not user-specific.
- Discover remains the default landing view; Leaderboard is secondary via bottom nav.
- TMDB credentials are available in runtime env for metadata enrichment/backfill.
- Production persistent store is Supabase; local dev may use SQLite.

### Known limitations
- If TMDB metadata lookup fails, some rows may still display fallback identifiers and/or Uncategorized genre.
- Backfill is opportunistic (on-demand) unless a dedicated backfill job is run.
- Render free tier cold starts still show Render wake page before app becomes available.

### Key learnings that you can bring with you to future sessions
- Ensure service env vars are read at runtime (not import-time) to avoid stale config.
- Legacy rating rows need metadata normalization for meaningful leaderboard UX.
- Keep local server process management explicit; stale processes can mask route availability.
- Mobile UX improves materially with strict vertical action hierarchy and full-width controls.

### Remaining TODOs
- Run Supabase schema update in production for leaderboard catalog/view alignment.
- Ensure Render has `COZINESS_STORE=supabase` and TMDB env vars configured.
- Optional: execute a one-time full metadata backfill script for all historical IMDb IDs.
- Optional: add observability around TMDB lookup failures and fallback rates.

### Next steps
1. Deploy latest `main` to Render and confirm healthy boot.
2. Smoke test Discover + Leaderboard flows in production (filters, sort, rating overwrite).
3. Verify Supabase tables/views contain expected rows and leaderboard outputs.
4. Decide whether to add scheduled metadata backfill and user-level rating model later.

## Date/time
2026-03-06 20:03:56 -05:00

## Feature name, description, and value provided
OMDb Critic Score Aggregation + Movie Card Metadata Row
Description: Added server-side OMDb enrichment for IMDb and Rotten Tomatoes critic scores and surfaced those scores in a conditional metadata row on each movie card.
Value provided: Improves decision-making in search results by showing high-signal critic context without disrupting primary actions.

## Summary/Overview of work
Implemented an API aggregation pattern in the search flow: for each movie with an IMDb ID, the backend calls OMDb and merges imdbRating plus rottenTomatoesRating (from OMDb Ratings). Added graceful fallback so missing/failed OMDb lookups do not block normal movie results. Updated card renderer to display a metadata row below year and above actions only when score data exists. Applied a small designer polish pass to spacing, contrast, and readability across desktop/mobile card layouts.

## Files changed
- C:\Users\dougs\Movie_Fun_Codex\server\services\imdbService.js
- C:\Users\dougs\Movie_Fun_Codex\src\ui\renderers.js
- C:\Users\dougs\Movie_Fun_Codex\styles\main.css
- C:\Users\dougs\Movie_Fun_Codex\.env.example

## Technical Architecture changes or key technical decisions made
- Added OMDb enrichment in backend search service (not frontend) to keep API keys server-side.
- Introduced OMDb-specific cache (omdbCache) to reduce repeated upstream calls.
- Used additive payload shape (imdbRating, rottenTomatoesRating) so existing consumers remain backward compatible.
- Implemented non-blocking failure behavior: OMDb failure returns base movie data unchanged.
- Kept metadata row conditionally rendered on frontend to avoid empty UI placeholders.

## Assumptions
- OMDB_API_KEY is configured in runtime environments (local .env and Render env vars).
- OMDb responses continue to include IMDb rating and optional Rotten Tomatoes values in expected fields.
- Existing search volume remains within acceptable OMDb usage limits with caching enabled.

## Known limitations
- Rotten Tomatoes score is unavailable for some titles and therefore may not render.
- No dedicated automated UI/E2E test currently validates metadata row visibility/state transitions.
- OMDb dependency is external and subject to latency/rate limits/availability.

## Key learnings that you can bring with you to future sessions
- Aggregate external metadata server-side to protect secrets and simplify frontend logic.
- Additive response fields enable feature rollout without breaking existing consumers.
- Conditional rendering + graceful degradation maintains UX quality under partial data.
- Stale local server processes can mask new behavior; clean restart is important after env/code changes.

## Remaining TODOs
- Add API tests that explicitly assert imdbRating/rottenTomatoesRating pass-through behavior.
- Add browser-level checks for metadata-row rendering in mobile and desktop breakpoints.
- Add lightweight monitoring/logging for OMDb failure rate and cache hit ratio.

## Next steps
1. Validate production payloads after Render deploy/restart with OMDB_API_KEY present.
2. Run a focused visual smoke test on top search queries to confirm metadata row consistency.
3. Add regression coverage for OMDb aggregation and conditional metadata rendering.



## Date/time
2026-03-09 19:40:00 -04:00

## Feature name, description, and value provided
My Services MVP + Streaming Disambiguation Fix
Description: Added a lightweight Discover-page personalization feature that lets users select their streaming services locally, surfaces included matches on movie cards, filters Discover results to included-only matches, and prioritizes matching providers in Where to Watch. Also fixed same-title streaming collisions by making the provider lookup/cache year-aware for ambiguous titles such as Friday the 13th.
Value provided: Helps users answer "Can I already watch this with the services I have?" without adding accounts or a new page, while improving streaming accuracy for same-title remakes and originals.

## Summary/Overview of work
Implemented a compact Discover-level My Services control row below Search with a secondary Included only filter. Added a polished selector experience that opens as a compact dialog on desktop and a bottom sheet on mobile, stores selections in localStorage, and hydrates safely on reload. Search results now hydrate streaming availability in the background for current results so matching cards can show a concise included badge and the Included only filter can work client-side. In the Where to Watch panel, providers that match the user's selected services are moved to the top and labeled. During QA, a defect was found where same-title movies like Friday the 13th could share the wrong streaming providers; that was fixed by adding year-aware streaming requests, year-aware upstream selection, and year-aware cache keys.

## Files changed
- C:\Users\dougs\Movie_Fun_Codex\index.html
- C:\Users\dougs\Movie_Fun_Codex\styles\main.css
- C:\Users\dougs\Movie_Fun_Codex\src\main.js
- C:\Users\dougs\Movie_Fun_Codex\src\ui\renderers.js
- C:\Users\dougs\Movie_Fun_Codex\src\api\client.js
- C:\Users\dougs\Movie_Fun_Codex\src\features\myServices.mjs
- C:\Users\dougs\Movie_Fun_Codex\src\features\discoverServices.mjs
- C:\Users\dougs\Movie_Fun_Codex\server\app.js
- C:\Users\dougs\Movie_Fun_Codex\server\services\imdbService.js
- C:\Users\dougs\Movie_Fun_Codex\test\my-services.test.mjs
- C:\Users\dougs\Movie_Fun_Codex\test\streaming-disambiguation.test.js

## Technical Architecture changes or key technical decisions made
- Kept persistence strictly client-side via localStorage using selectedStreamingServices and includedOnlyFilterEnabled.
- Avoided adding a new route surface or provider-management subsystem; reused the existing /api/v1/streaming endpoint and current normalized provider payload.
- Added a small frontend service-matching module (myServices.mjs) for curated service definitions, alias normalization, and included-vs-rent/buy matching rules.
- Added a Discover-scoped controller module (discoverServices.mjs) to isolate sheet state, service selections, streaming hydration, badge application, and included-only filtering from the rest of main.js.
- Preserved backward compatibility in the streaming API by making year an additive optional parameter rather than changing the endpoint contract.
- Fixed same-title provider collisions by including imdbId/title/year in the streaming cache key, including year in ambiguous upstream queries, and using year-aware row selection when the upstream response contains multiple rows with the same title.

## Assumptions
- Background per-result streaming hydration is acceptable for MVP even though badges and included filtering may resolve progressively after search results first render.
- The curated service list is sufficient for initial user value and is preferable to exposing every provider from the upstream feed.
- Included/subscription matching should count only flatrate-like access types and exclude rent/buy storefront availability.
- The current dark cinematic design language should remain the visual frame for the new modal/sheet and filter controls.
- When a title/year pair is available, it should be used to disambiguate streaming availability for remakes and originals.

## Known limitations
- Discover badges and Included only filtering rely on background streaming hydration for the current result set, so matches can appear incrementally rather than all at once.
- There is still no browser automation or visual E2E coverage for the new sheet/modal interactions and progressive badge/filter updates.
- The service selector is curated and local-only; there is no cross-device persistence or dynamic provider discovery in MVP.
- Upstream JustWatch/imdb proxy data can still change independently of the app, so watch-provider outputs remain dependent on third-party availability quality.

## Key learnings that you can bring with you to future sessions
- Same-title streaming lookups are a real correctness risk; title-only caching is too weak once the catalog contains remakes and originals with identical names.
- For lightweight personalization, a small localStorage-backed controller can deliver meaningful user value without dragging the app into auth or backend preference complexity.
- Provider matching logic stays maintainable when service normalization and access-type rules live in a dedicated helper module instead of being spread across UI components.
- Client-side Discover filtering can remain bounded if the app hydrates only the currently visible result set rather than attempting a broader provider sync model.
- Browser retests after restarting the local server matter whenever the bug involves cached streaming/provider data.

## Remaining TODOs
- Run a production browser smoke test for My Services selection, Included only, and provider ordering in Where to Watch.
- Consider adding a lightweight loading indicator/state hint for progressive badge hydration if users need clearer feedback while streaming data resolves.
- Add future browser/E2E coverage around same-title streaming disambiguation and My Services bottom-sheet interactions.
- Consider whether certain upstream provider aliases should be broadened further if users report common misses against the curated list.

## Next steps
1. Smoke test the deployed app for My Services on both desktop and mobile widths.
2. Validate a few additional ambiguous-title cases beyond Friday the 13th to confirm the year-aware streaming fix generalizes well.
3. If the feature performs well in production, decide whether to add richer badge copy or a small persistent summary of selected services later without expanding scope into accounts.

## Date/time
2026-03-17 00:00:00 -04:00

## Feature name
Repository Agent Instructions File

## Summary
Added `AGENTS.md` as the stable repo-level instruction file for future agent sessions. It captures the app's product context, architecture entrypoints, local run/test workflow, environment expectations, risk areas, and collaboration preferences so new sessions can get aligned faster without relying only on historical memory notes.

## Files changed
- C:\Users\dougs\Movie_Fun_Codex\AGENTS.md
- C:\Users\dougs\Movie_Fun_Codex\PROJECT_MEMORY.md

## Assumptions
- `AGENTS.md` should remain focused on stable working conventions, not feature history.
- Ongoing implementation history and handoff details should continue to live in `PROJECT_MEMORY.md` and `Move_App_Handoff.md`.
- Future sessions should read `AGENTS.md` early to align communication style and repo workflow.

## Known limitations
- `AGENTS.md` is only useful if it is kept current when repo conventions materially change.
- It does not replace deeper code inspection or the detailed milestone history in project memory.

## Next step
Use `AGENTS.md` as the first-stop repo instruction file in future sessions, then consult `PROJECT_MEMORY.md` and `Move_App_Handoff.md` for recent feature context.

## Date/time
2026-03-17 21:40:00 -04:00

## Feature name
Static File Exposure Lockdown + Fail-Closed Coziness Store Selection

## Summary
Hardened the app in two critical ways. First, the Express server no longer serves the entire repo as static content and now exposes only the frontend asset paths required by the browser plus `index.html`. Second, the coziness store selection now validates configuration explicitly and fails closed when `COZINESS_STORE=supabase` is set without valid Supabase environment variables, instead of silently falling back to SQLite. Added startup diagnostics for the active store and regression tests covering both behaviors.

## Files changed
- C:\Users\dougs\Movie_Fun_Codex\server\app.js
- C:\Users\dougs\Movie_Fun_Codex\server\services\cozinessStore.js
- C:\Users\dougs\Movie_Fun_Codex\test\hardening.test.js
- C:\Users\dougs\Movie_Fun_Codex\PROJECT_MEMORY.md

## Technical Architecture changes or key technical decisions made
- Replaced repo-root static serving with explicit public mounts for `/styles` and `/src`, while keeping SPA fallback to `index.html`.
- Added startup-time store validation so production-like misconfiguration is surfaced immediately instead of causing hidden data writes to the wrong backend.
- Added lightweight store diagnostics via startup logging and `cozinessStore` in health/readiness payloads.
- Added regression tests that assert internal files are not exposed and store validation fails as expected for broken Supabase configuration.

## Assumptions
- The frontend only needs `index.html`, `/styles`, and `/src` publicly served in the current architecture.
- Silent fallback from explicitly requested Supabase storage is a worse outcome than startup failure.
- Local development can still use SQLite intentionally via development defaults or explicit `COZINESS_STORE=sqlite`.

## Known limitations
- Direct requests to internal file paths now fall back to `index.html` rather than returning a hard 404, which is acceptable for current SPA routing but not as strict as a dedicated public asset manifest.
- This work does not yet remove leaderboard metadata backfill from the request path.
- Browser-level manual QA is still needed for search, trailer, streaming, My Services, and coziness-save interactions.

## Verification
- `npm test` passed with 27 tests and 0 failures.
- Verified local startup logs active store selection.
- Verified `GET /api/v1/health`, `GET /api/v1/readiness`, and `GET /api/v1/leaderboard?genre=all&sortOrder=desc` succeed locally.
- Verified `/PROJECT_MEMORY.md` and `/movie_fun_dev.sqlite` no longer expose raw file contents from the running server.

## Next steps
1. Run a short browser QA pass for search, trailer, Where to Watch, My Services, cozy save, and Leaderboard interactions.
2. Remove leaderboard metadata backfill from the live request path and move it to a background/admin flow.
3. Continue hardening observability around upstream dependency degradation because critic scores and watch availability are product-critical.
