# Technical Architecture Overview

## What it is
- A lightweight movie discovery web app.
- User searches a title, sees movie cards, then can:
  - watch trailer
  - open IMDb
  - open streaming platform links for that specific movie

## Tech stack
- Frontend: vanilla HTML/CSS/JS (no framework)
- Backend: Node.js + Express
- Data source: external movie APIs (search, trailer, streaming via service layer)
- Hosting pattern: static frontend + Node backend (local and cloud deploy)

## Architecture
- `index.html`: app shell + GA4 script
- `src/main.js`: frontend controller (search flow, button actions, API calls, analytics events)
- `src/ui/renderers.js`: UI rendering for cards, streaming sections, provider tiles
- `styles/main.css`: design system + component styling
- `server/app.js`: Express server, API routes, health/readiness
- `server/services/imdbService.js`: API integration, normalization, provider ranking/deduping, caching

## Backend API (core routes)
- `GET /api/v1/search?q=...`
- `GET /api/v1/trailer?imdbId=...&title=...`
- `GET /api/v1/streaming?imdbId=...&title=...`
- Plus health/readiness endpoints

## Key design/UX logic
- Movie cards have 3 primary actions: `Watch Trailer` (primary), `Where to Watch`, `IMDb`
- Smart Watch Options:
  - providers ranked by type (`included/free/stream` -> `rent` -> `buy` -> `other`)
  - top featured options shown first (up to 4 accepted)
  - remainder behind `More options`
- Provider cards are clickable and open new tab to provider-specific movie page
- Trailer flow has fallback behavior when direct trailer URL unavailable

## Analytics
- GA4 gtag installed in `index.html`
- Tracked events in `src/main.js`:
  - `search` (`search_query`)
  - `watch_trailer_click`
  - `where_to_watch_click`
  - `imdb_click`
  - `provider_click` (`provider_name`, `availability_type`)

## Quality/ops
- Tests run via `npm test` (Node test runner), includes API route validation and failure-path coverage
- Local run: `npm start`

## What a new programmer should do first
1. Read `src/main.js` and `src/ui/renderers.js` (main behavior + UI composition).
2. Read `server/services/imdbService.js` (all external data shaping happens here).
3. Run app + tests locally (`npm start`, `npm test`).
4. Verify one full flow: search -> trailer -> streaming -> provider click -> GA realtime events.
