# Product Handoff Summary: Movie Fun App

## 1) What the app is
A mobile-first movie discovery web app with two core experiences:

1. `Discover` page: search movies, open trailers, find where to watch, view critic metadata, and set a global “coziness” score.
2. `Leaderboard` page: ranked list of cozy-rated movies with genre filter and sort controls.

The rating model is global, not user-specific: last write wins.

---

## 2) UX/Layout overview

### Discover page layout
- Hero section with product value prop.
- Search panel with single search input + primary Search CTA.
- Results grid of movie cards (responsive cards on desktop, stacked on mobile).
- Bottom fixed nav with two tabs: `Discover` and `Leaderboard`.
- Results header (`Results` + meta count/status) now shows only after a real search.

### Movie card structure
- Poster
- Title + year
- Metadata row (conditional): `IMDb` score and Rotten Tomatoes score (if available)
- Vertical full-width action stack:
  - `Watch Trailer` (primary, orange)
  - `Where to Watch` (secondary)
  - `? Cozy Rating` accordion toggle (merged display + action)
  - `IMDb` link action (muted style, not competing with primary CTA)
- Expandable sections:
  - Streaming providers panel
  - Cozy score panel (1–10 chips + save action + feedback)

### Leaderboard page layout
- Header with ranked count.
- Two control dropdowns:
  - Genre (`Genre: All` + dynamic genres)
  - Sort (`Most Cozy ?` / `Least Cozy ?`)
- Single-column ranked rows:
  - Rank number
  - Poster thumbnail
  - Title + year
  - Cozy badge (`Cozy X/10`)
- No chart/progress bars by design, compact mobile-first rows.

---

## 3) Functional features

### Search and result rendering
- Searches through backend `/api/v1/search`.
- Frontend shows loading skeletons, then cards.
- Empty/error states are rendered with friendly status copy.

### Trailer behavior
- Backend tries direct-source trailer URL resolution first.
- If source is not actually playable, backend/frontend fall back to YouTube search.
- This was hardened to avoid broken “error five” direct-source cases.

### Streaming providers
- Loads on demand from `/api/v1/streaming`.
- Providers ranked by availability quality.
- “Smart Watch Options” shows best picks first.
- Remaining providers can be expanded via “More options”.

### Coziness ratings
- Global 1–10 score per IMDb ID.
- Save via `/api/v1/coziness`.
- Cards hydrate existing ratings via `/api/v1/coziness/batch`.
- Cozy panel auto-closes after successful save (UX behavior implemented).
- Metadata for title/year/poster/genre is upserted with rating saves when provided.

### Leaderboard
- `/api/v1/leaderboard?genre=...&sortOrder=asc|desc`
- Filters and sorting applied server-side.
- Dynamic genre options sourced from rated movies.
- Includes best-effort backfill/enrichment for older rows missing metadata.

### Critic score aggregation (OMDb)
- Search results enriched server-side with:
  - `imdbRating`
  - `rottenTomatoesRating`
- Graceful degradation when OMDb lacks data or is unavailable.
- Frontend conditionally renders only existing scores.

### Analytics
- GA4 events from client:
  - `search`
  - `watch_trailer_click`
  - `where_to_watch_click`
  - `imdb_click`
  - `provider_click`
  - `coziness_saved`
  - `coziness_panel_open`

---

## 4) Tech architecture

### Stack
- Frontend: Vanilla HTML/CSS/JS modules.
- Backend: Node.js + Express.
- Persistence:
  - Supabase (production target)
  - SQLite fallback (local dev/default in development).
- External data:
  - `imdb.iamidiotareyoutoo.com` (search/media/justwatch proxy)
  - OMDb (critic scores)
  - TMDB (genre/title/poster enrichment/backfill)

### App shape
- Single Express service serves API and static frontend.
- SPA-like page switching is done client-side via hidden sections.
- API namespace: `/api/v1/*`.

### Important backend services
- `imdbService`: search normalization, trailer resolution, streaming normalization, OMDb enrichment, in-memory caches.
- `cozinessStore`: store selector + orchestration + enrichment/backfill.
- `cozinessService`: Supabase adapter.
- `cozinessSqliteService`: SQLite adapter.
- `tmdbService`: IMDb?TMDB metadata lookup and genre map caching.

### Caching/reliability patterns
- In-memory TTL caches:
  - Search, streaming, trailer, OMDb.
- Request timeout + retry around upstream calls.
- Structured request IDs and JSON request logging.
- Readiness endpoint checks upstream dependency.
- Rate limiter on API requests.

---

## 5) Data model (current behavior)

### Core entities
- Ratings table: one row per `imdb_id`, stores `coziness_score` + `updated_at`.
- Movie catalog table: `imdb_id`, `title`, `release_year`, `poster_url`, `primary_genre`, optional genre list.
- Leaderboard view/query joins ratings + movie metadata.

### Business rule
- Global score per movie, not per user.
- Update overwrites previous score for same movie (last write wins).

---

## 6) Key routes

- `GET /api/v1/health`
- `GET /api/v1/readiness`
- `GET /api/v1/search?q=...`
- `GET /api/v1/trailer?imdbId=...&title=...`
- `GET /api/v1/streaming?imdbId=...&title=...`
- `GET /api/v1/coziness?imdbId=...`
- `POST /api/v1/coziness/batch`
- `POST /api/v1/coziness`
- `GET /api/v1/leaderboard?genre=...&sortOrder=asc|desc`

---

## 7) Environment/config needed

- `OMDB_API_KEY`
- `TMDB_API_KEY` and/or `TMDB_READ_ACCESS_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `COZINESS_STORE` (`supabase` in production, `sqlite` for local)
- `SQLITE_DB_PATH` (local fallback file path)
- `PORT` (optional; defaults to 3000)

---

## 8) Current known limitations/risk areas

- Trailer/streaming sources are third-party and can change behavior.
- No user-level cozy ratings yet (global overwrite model only).
- Genre/poster/title backfill is best-effort; failures can leave partial metadata.
- UI regressions are mostly caught by manual QA; no full browser E2E suite yet.
- Some static text has encoding artifacts (arrow/emoji characters) in source files that should be normalized.

---

## 9) Test and release posture

- Automated tests: Node test suite for API behavior and error paths.
- Manual QA has been heavily used for UX interaction flows (cards, cozy panel, streaming panel, leaderboard).
- Local run:
  - `npm start`
  - `npm test`

---

## 10) Best onboarding path for a new team

1. Read product behavior in [PROJECT_MEMORY.md](./PROJECT_MEMORY.md).
2. Review architecture in [Technical_Architecture_Overview.md](./Technical_Architecture_Overview.md).
3. Start with frontend orchestration in [src/main.js](./src/main.js).
4. Review UI composition in [src/ui/renderers.js](./src/ui/renderers.js).
5. Review API surface in [server/app.js](./server/app.js).
6. Review integrations in [server/services/imdbService.js](./server/services/imdbService.js).
7. Review storage strategy in [server/services/cozinessStore.js](./server/services/cozinessStore.js), [server/services/cozinessService.js](./server/services/cozinessService.js), and [server/services/cozinessSqliteService.js](./server/services/cozinessSqliteService.js).

If you want, I can also generate a one-page “Product + Engineering Brief” version suitable for pasting directly into a kickoff doc.
