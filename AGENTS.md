# AGENTS.md

## Purpose
This repository is a mobile-first movie discovery web app. Use this file as the stable operating guide for future work in this repo.

Keep this file focused on how to work in the repo. Do not turn it into a change log. Historical work, handoff notes, and milestone summaries belong in `PROJECT_MEMORY.md` and `Move_App_Handoff.md`.

## Product Summary
- Core experience: a movie discovery app with `Discover` and `Leaderboard` views.
- Discover supports movie search, trailers, where-to-watch, critic metadata, global coziness rating, and local `My Services` personalization.
- Leaderboard shows cozy-rated movies with sorting and genre filtering.
- Rating model is global, not user-specific. Current behavior is last write wins per movie.

## Stack And Architecture
- Frontend: vanilla HTML, CSS, and JS modules.
- Backend: Node.js + Express.
- Storage:
  - Local/dev: SQLite fallback
  - Production target: Supabase
- External integrations:
  - `imdb.iamidiotareyoutoo.com` for search, trailers, and streaming/provider data
  - OMDb for IMDb and Rotten Tomatoes critic scores
  - TMDB for metadata enrichment and backfill

Key entrypoints:
- `index.html`: app shell and analytics script
- `src/main.js`: frontend orchestration and page behavior
- `src/ui/renderers.js`: card, leaderboard, and status rendering
- `src/features/myServices.mjs`: curated streaming-service matching rules
- `src/features/discoverServices.mjs`: Discover-page services controller
- `server/app.js`: Express app and API routes
- `server/services/imdbService.js`: upstream integration, normalization, caches
- `server/services/cozinessStore.js`: storage selection and orchestration
- `server/services/cozinessService.js`: Supabase adapter
- `server/services/cozinessSqliteService.js`: SQLite adapter
- `server/services/tmdbService.js`: metadata enrichment and genre mapping

## Source Of Truth Files
Read these first when getting up to speed:
1. `PROJECT_MEMORY.md`
2. `Move_App_Handoff.md`
3. `Technical_Architecture_Overview.md`
4. `src/main.js`
5. `src/ui/renderers.js`
6. `server/app.js`
7. `server/services/imdbService.js`

## Local Run And Test
- Install dependencies: `npm install`
- Start app: `npm start`
- Run tests: `npm test`

If the local server appears stale or behavior does not match code, use `LOCAL_SERVER_RESTART_INSTRUCTIONS.txt`.

Default local port:
- `3000` unless overridden by `PORT`

Useful endpoints:
- `GET /api/v1/health`
- `GET /api/v1/readiness`
- `GET /api/v1/search?q=...`
- `GET /api/v1/trailer?imdbId=...&title=...`
- `GET /api/v1/streaming?imdbId=...&title=...`
- `GET /api/v1/coziness?imdbId=...`
- `POST /api/v1/coziness/batch`
- `POST /api/v1/coziness`
- `GET /api/v1/leaderboard?genre=...&sortOrder=asc|desc`

## Environment Expectations
Expected env vars:
- `OMDB_API_KEY`
- `TMDB_API_KEY` and/or `TMDB_READ_ACCESS_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `COZINESS_STORE`
- `SQLITE_DB_PATH`
- `PORT`

Notes:
- `.env` is used locally and should not be committed.
- Prefer SQLite fallback for local work unless explicitly validating Supabase behavior.
- Production behavior may differ if env vars are missing or stale.

## Engineering Guidance
- Preserve the existing vanilla-JS architecture unless there is a strong reason to change it.
- Keep secrets server-side. Do not move API keys into frontend code.
- Treat third-party integrations as unreliable by default. Favor graceful fallback behavior.
- Preserve the current mobile-first card hierarchy:
  - `Watch Trailer` is the primary CTA
  - `Where to Watch` is secondary
  - Cozy controls and IMDb should not visually overpower the primary CTA
- Keep `My Services` lightweight and local-first unless the user explicitly wants account-based persistence.
- Be careful with ambiguous-title streaming behavior. Year-aware matching and cache keys are important.
- Prefer additive API changes over breaking contract changes.

## QA And Risk Areas
Pay extra attention to:
- Trailer fallback behavior
- Streaming provider correctness, especially same-title remakes/originals
- Progressive hydration behavior for `My Services` badges and `Included only`
- Coziness save/load behavior and leaderboard consistency
- External API failure handling and degraded UX states
- Mobile interaction quality for sheets, accordions, and action stacks

Current known gap:
- The repo has automated Node tests, but no full browser E2E coverage yet.

## Collaboration Style For This Repo
When working with the user in this repo:
- Use succinct language.
- Explain what you are doing and why you are doing it.
- When asking questions, keep them short and concrete.
- Assume the user is acting as a somewhat less technical product manager.
- Help connect the dots between:
  - feature behavior
  - UX/design decisions
  - technical architecture
  - concrete code changes
- Do not dump raw implementation detail without translating it into product impact.
- When proposing tradeoffs, explain both the user-facing effect and the engineering consequence.
- When something is risky or incomplete, say so plainly.

## Preferred Working Pattern
1. Read the memory and handoff docs before major changes.
2. Inspect the current code path before proposing or implementing changes.
3. Make the smallest coherent change that solves the problem.
4. Verify with tests, targeted endpoint checks, or manual validation steps.
5. Summarize results in product + technical terms, not just file edits.

## Documentation Maintenance
Update this file only when stable repo conventions change.

Update `PROJECT_MEMORY.md` when completing meaningful work so future sessions can recover context quickly.
