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

## Date/time
2026-04-03 20:57:00 -04:00

## Feature name
Browser Smoke Test Coverage + Visual Playwright Commands

## Summary
Added Playwright-based browser smoke coverage for the core Discover and Leaderboard flows using a deterministic local mock server. Also added optional visual commands so tests can run invisibly by default or visibly when someone wants to watch the browser interact with the app.

## Files changed
- C:\Users\dougs\Movie_Fun_Codex\package.json
- C:\Users\dougs\Movie_Fun_Codex\package-lock.json
- C:\Users\dougs\Movie_Fun_Codex\playwright.config.js
- C:\Users\dougs\Movie_Fun_Codex\test\e2e\mockServer.js
- C:\Users\dougs\Movie_Fun_Codex\test\e2e\smoke.spec.js
- C:\Users\dougs\Movie_Fun_Codex\AGENTS.md
- C:\Users\dougs\Movie_Fun_Codex\PROJECT_MEMORY.md

## Technical Architecture changes or key technical decisions made
- Added Playwright as a dev dependency and kept browser tests separate from the existing Node test suite.
- Used a local mock Express server for E2E runs so browser tests exercise the real frontend against stable data instead of flaky third-party APIs.
- Added a reset endpoint in the mock server so each test starts from a clean known state.
- Scoped the Node test command to `test/*.test.js` and `test/*.test.mjs` so Playwright files are not accidentally executed by `node --test`.
- Added optional visual commands: `npm run test:e2e:headed` and `npm run test:e2e:ui`.

## Assumptions
- Stable mocked data is the right first step for UI regression coverage in this repo.
- Browser smoke coverage should focus on the highest-risk user flows before expanding to broader permutations.
- Visual Playwright commands are useful for demos and debugging but should not replace the default headless CI-friendly path.

## Known limitations
- The browser suite currently uses mocked backend responses, so it does not validate live third-party integrations.
- Coverage is currently focused smoke coverage, not full regression coverage across all error states, browsers, and device sizes.
- Playwright test runs generate local artifacts such as `test-results/` when failures occur.

## Key learnings that you can bring with you to future sessions
- Keeping browser tests deterministic with a local mock server makes the suite much more maintainable for an app that depends on unstable outside movie APIs.
- It is important to isolate Playwright tests from `node --test` so the two runners do not interfere with each other.
- Visual test commands are useful both for debugging flaky UI behavior and for showing non-technical stakeholders what automated QA is doing.

## Remaining TODOs
- Consider adding a small `.gitignore` update for Playwright artifacts such as `test-results/` if they should stay untracked.
- Expand browser coverage to include more empty/error/degraded states and a mobile-width pass.
- Decide whether to add a production-backed smoke layer later for a smaller set of live integration checks.

## Next steps
1. Optionally add Playwright artifact paths to `.gitignore`.
2. Add one or two mobile-width smoke scenarios for the services sheet and card interactions.
3. Later, add a very small production-backed smoke suite for critical routes if live integration confidence becomes important.

## Date/time
2026-04-04 01:45:00 -04:00

## Feature name
Browser Smoke Coverage, Visual Test Commands, Upstream Failure Hardening, and Production Push

## Summary
Completed a combined quality and reliability pass across the repo. Added Playwright browser smoke coverage for the main user flows, added optional visible Playwright commands for live viewing, updated docs and repo memory to reflect the new test workflow, hardened the backend's movie-provider failure handling, pushed the changes to `main`, and then investigated the new production logs to separate app behavior from upstream provider behavior.

## Files changed
- C:\Users\dougs\Movie_Fun_Codex\.gitignore
- C:\Users\dougs\Movie_Fun_Codex\AGENTS.md
- C:\Users\dougs\Movie_Fun_Codex\PROJECT_MEMORY.md
- C:\Users\dougs\Movie_Fun_Codex\package.json
- C:\Users\dougs\Movie_Fun_Codex\package-lock.json
- C:\Users\dougs\Movie_Fun_Codex\playwright.config.js
- C:\Users\dougs\Movie_Fun_Codex\server\app.js
- C:\Users\dougs\Movie_Fun_Codex\server\services\imdbService.js
- C:\Users\dougs\Movie_Fun_Codex\test\api.test.js
- C:\Users\dougs\Movie_Fun_Codex\test\e2e\mockServer.js
- C:\Users\dougs\Movie_Fun_Codex\test\e2e\smoke.spec.js

## Technical Architecture changes or key technical decisions made
- Added Playwright as a dev dependency and kept browser tests isolated from the Node test runner by scoping `npm test` to `test/*.test.js` and `test/*.test.mjs`.
- Added Playwright config plus a deterministic local mock Express server so browser tests exercise the real frontend with stable test data instead of live third-party APIs.
- Added browser smoke coverage for search, trailer popup, Where to Watch expansion, cozy save, My Services filtering, and leaderboard load/filter/sort flows.
- Added optional visual commands: `npm run test:e2e:headed` and `npm run test:e2e:ui`.
- Added `.gitignore` entries for Playwright artifact folders to reduce working-tree noise.
- Increased upstream movie-provider search timeout from 5s to 8s and retries from 1 to 2 to make production search less brittle.
- Increased readiness timeout from 3s to 6s.
- Added structured upstream failure metadata (`failureType`, `upstreamStatus` when available) to error responses and server logs so production incidents are easier to diagnose.
- Updated user-facing backend messages for search/readiness outages to explain that the movie data provider is temporarily unavailable rather than only saying the app failed.
- Committed and pushed the combined changes to `main` with commit `ff056df`.

## Assumptions
- Deterministic mocked browser coverage is the right first layer of frontend regression protection for this repo.
- Visual Playwright commands are helpful for demos and debugging but should remain optional rather than replacing the default headless command.
- Better upstream logging and a more honest error contract improve operability even before the app has a backup movie search provider.
- The current production deployment is auto-updating from `main`.

## Known limitations
- The browser suite still uses mocked backend data and does not validate live third-party movie provider behavior.
- The production app still has a single search-provider dependency, so true provider outages still take search down.
- Render logs after deployment showed the upstream search provider returning `404` for broad normal queries like `friday`, `predator`, `christmas story`, and `christmas`, which indicates an upstream provider problem beyond the app's own behavior.
- Search currently still classifies upstream `404` as an upstream failure rather than an empty search state. That remains a likely next UX hardening step if desired.

## Key learnings that you can bring with you to future sessions
- Playwright coverage is valuable in this repo because core quality risks are UI-driven and involve real browser behavior such as panels, localStorage, and view switching.
- Browser smoke suites are much easier to keep reliable when they run against a local deterministic mock server instead of unstable third-party APIs.
- Production incident debugging became much clearer once upstream failures were logged with a machine-readable failure type and optional status.
- The current external movie search provider is a major product reliability risk: recent Render logs showed the service reachable but returning `404` for many normal search terms, which is different from a network outage and points to an upstream quality problem.
- Better app messaging can reduce confusion, but it does not remove the underlying single-point-of-failure risk in search.

## Remaining TODOs
- Consider changing upstream search `404` handling to return an empty result set instead of a hard outage so typo/no-match experiences are less misleading.
- Add a backup movie search provider or fallback strategy so the app is not fully blocked by the current unofficial provider.
- Add mobile-width browser smoke scenarios and more degraded/error-state browser checks.
- Consider production-backed smoke checks for a very small set of live routes once the search-provider strategy is clearer.

## Next steps
1. Decide whether to patch search so upstream `404` becomes an empty-result UX instead of an outage UX.
2. Evaluate a fallback or replacement provider for primary search because current production logs show broad upstream search instability.
3. After the next deploy cycle, re-check Render logs and production readiness/search behavior using the new structured upstream error details.

## Date/time
2026-04-04 16:45:00 -04:00

## Feature name, description, and value provided
IMDb Import Cozy Queue MVP
Description: Added a dedicated local-first IMDb import flow that turns a user's IMDb ratings CSV into a personal Cozy Queue, where they can rate imported movies one at a time for coziness, skip titles, resume later, and review skipped items.
Value provided: Removes the need to search and rate movies one by one, helping users build a meaningful cozy profile much faster from movie history they already have.

## Summary/Overview of work
Implemented a new `Cozy Queue` feature set centered around the product framing `Import IMDb Ratings to Build Your Cozy Queue`. Added a new Discover launcher plus a dedicated queue view in the app shell. Built local CSV parsing for IMDb ratings exports, filtered imports to movie rows only, added an import preview state, created structured local storage for import batches / imported movie records / queue state, and wired a one-at-a-time queue interaction with `Save and Next`, `Skip`, `Exit`, resume, completion, and review-skipped flows. Reused the existing cozy save API for actual cozy ratings so imported queue ratings stay consistent with the rest of the app. After local QA, fixed a product-quality issue where queue cards initially showed blank poster areas by adding lightweight movie metadata hydration for imported titles. Added unit coverage for parsing/storage and browser smoke coverage for the import-to-queue flow. Added a dedicated feature brief file to preserve direction and future-phase planning.

## Files changed
- C:\Users\dougs\Movie_Fun_Codex\index.html
- C:\Users\dougs\Movie_Fun_Codex\src\main.js
- C:\Users\dougs\Movie_Fun_Codex\src\ui\renderers.js
- C:\Users\dougs\Movie_Fun_Codex\styles\main.css
- C:\Users\dougs\Movie_Fun_Codex\src\features\imdbImport.mjs
- C:\Users\dougs\Movie_Fun_Codex\src\features\importStorage.mjs
- C:\Users\dougs\Movie_Fun_Codex\src\api\client.js
- C:\Users\dougs\Movie_Fun_Codex\server\app.js
- C:\Users\dougs\Movie_Fun_Codex\server\services\imdbService.js
- C:\Users\dougs\Movie_Fun_Codex\test\imdb-import.test.mjs
- C:\Users\dougs\Movie_Fun_Codex\test\e2e\smoke.spec.js
- C:\Users\dougs\Movie_Fun_Codex\test\e2e\mockServer.js
- C:\Users\dougs\Movie_Fun_Codex\test\e2e\fixtures\imdb-ratings.csv
- C:\Users\dougs\Movie_Fun_Codex\COZY_IMPORT_FEATURE_SET.md
- C:\Users\dougs\Movie_Fun_Codex\PROJECT_MEMORY.md

## Technical Architecture changes or key technical decisions made
- Added a third main frontend view, `Cozy Queue`, rather than mixing imported-rating work into Discover.
- Kept Phase 1 local-first by storing import batches, imported movie records, and queue progress in browser storage instead of adding accounts or backend persistence first.
- Structured the local data model as if it were already user-owned data so a later migration to account-backed storage can be straightforward.
- Used IMDb `Const` / IMDb ID from the export as the primary imported identifier, avoiding fuzzy title matching as the main import path.
- Reused the existing cozy save API for queue ratings instead of creating a separate queue-specific cozy persistence path.
- Added a narrow backend `movie-metadata` lookup path so imported queue items can hydrate poster metadata and core movie details when the local import record does not contain a poster URL.
- Added a test-only option to disable rate limiting in the Playwright mock server so the expanded browser smoke suite remains deterministic without changing production behavior.

## Assumptions
- The supported IMDb export remains CSV-based and continues to include stable IMDb IDs in the `Const` column.
- Phase 1 value is still worth testing before introducing accounts, sync, or personalized recommendations.
- Movies are the only import target for now; TV titles are intentionally skipped rather than partially supported.
- Replacing the current local queue on re-import is acceptable for MVP and preferable to introducing merge/conflict behavior too early.
- Existing cozy rating semantics remain global last-write-wins even when ratings come through the queue flow.

## Known limitations
- Queue progress and imported history are local to the current browser/device only.
- There is no account ownership, cloud sync, or cross-device resume yet.
- TV Series rows are skipped and not supported in the queue flow.
- Re-import currently replaces the current local queue instead of preserving multiple user-manageable import batches.
- Queue poster hydration depends on upstream metadata lookup success; if lookup fails, the queue still works but may fall back to placeholder presentation.
- There is no advanced manual match-correction UI or deep import-management dashboard in this phase.

## Key learnings that you can bring with you to future sessions
- A dedicated queue page is the right UX shape for this task; trying to embed imported-rating work inside Discover would have made the flow feel cluttered and unnatural.
- The actual product value is not the file upload itself; it is the fast post-import one-movie-at-a-time cozy-rating loop.
- Designing Phase 1 local storage as structured user-like data is important because it preserves a clean path to Phase 2 account migration.
- Imported IMDb data rarely includes everything needed for a polished card, so lightweight metadata hydration is worth doing even in an otherwise local-first flow.
- Browser smoke coverage is especially useful for this feature because the important behaviors are UI-driven: file upload, queue progression, persistence, reload/resume, and completion states.

## Remaining TODOs
- Decide whether to keep the current single active local queue model or preserve multiple local import batches in a later Phase 1.x refinement.
- Add more UX polish to the Cozy Queue page, especially progress language, completion copy, and skipped-review states.
- Plan the Phase 2 account model and the local-to-account migration flow for imported batches and queue progress.
- Decide how re-import should behave long-term once accounts exist: replace, merge, or allow multiple import sets.
- Explore Phase 3 personalized discovery ideas once enough imported + cozy data exists to make them meaningful.

## Next steps
1. Use `COZY_IMPORT_FEATURE_SET.md` as the main resume brief for future sessions on this feature.
2. Decide whether the next work slice should be Phase 1 UX polish, local data/refinement work, or Phase 2 account planning.
3. If continuing implementation soon, start by reviewing the current queue flow in `src/main.js`, `src/features/imdbImport.mjs`, and `src/features/importStorage.mjs`.
