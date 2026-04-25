# Cozy Import Feature Set

## Purpose

This file is the working brief for the IMDb import + Cozy Queue feature set.

It is meant to preserve:
- the product intent
- the current MVP scope
- what has already been implemented
- what is still planned for later phases
- the main technical decisions that future sessions should preserve

This should let a later session continue the feature without rethinking the full direction from scratch.

---

## Feature summary

### Core idea

Let a user import their IMDb ratings history and quickly turn those already-known movies into a personal `Cozy Queue`, where they can rate each title for coziness one at a time.

### User value

This feature matters because it removes the biggest setup friction:
- the user does not have to search and rate movies one by one
- the app can feel personal much faster
- the user can build a meaningful cozy profile from movies they already know

### Product framing

The feature should be described around the outcome, not the file format.

Preferred product naming:
- `Import IMDb Ratings to Build Your Cozy Queue`

Not preferred:
- `CSV import tool`

---

## Product direction

### Current product decision

The feature uses a **dedicated page / view** called `Cozy Queue`.

It does **not** live inline inside normal Discover search results.

Reason:
- Discover is for browsing and finding movies
- Cozy Queue is a focused, high-speed rating workflow
- separating them keeps the app cleaner and the task clearer

### Interaction model

The Cozy Queue is optimized for **speed first**.

That means:
- one movie at a time
- big simple 1 to 10 cozy controls
- `Save and Next`
- `Skip`
- `Exit`
- resume later on the same device

The intended feel is:
- quick
- calm
- personal
- not spreadsheet-like

---

## Phase plan

## Phase 1

### Goal

Deliver a local-first version that proves users want to import and rate at scale before building accounts or sync.

### Phase 1 scope

- upload IMDb ratings CSV
- parse CSV locally
- import only movie rows
- use IMDb `Const` / IMDb ID as the main identifier
- show import preview
- create a local imported movie library
- create a dedicated Cozy Queue
- let user rate one movie at a time
- support skip and resume later
- save queue progress locally in browser storage
- reuse existing cozy save API for actual cozy scores

### Explicitly out of scope for Phase 1

- account system
- cloud sync
- cross-device persistence
- direct IMDb account connection
- two-way sync
- TV series support in queue
- recommendations engine
- social features
- manual heavy match-correction tools

## Phase 2

### Goal

Attach the local Cozy Queue / imported history to real user identity.

### Planned Phase 2 scope

- user account system or authenticated personal identity
- migrate local import batches and queue state into account-backed storage
- durable personal ownership of imported history
- cross-device resume

## Phase 3

### Goal

Turn imported IMDb history plus cozy ratings into personalization and discovery value.

### Likely Phase 3 ideas

- personalized cozy recommendations
- “movies you loved that may be cozy”
- cozy taste profile / genre insights
- prompts to finish rating important imported movies
- recommendation loops based on imported + cozy data

---

## Current implementation status

## Built so far

The following is now implemented locally in the app:

### 1. Discover entry point

A new launch surface exists on Discover for:
- `Import IMDb Ratings to Build Your Cozy Queue`

This includes:
- CTA to open the queue flow
- queue progress summary when a local queue already exists

### 2. Dedicated Cozy Queue nav/view

The app now has a dedicated `Cozy Queue` view in the bottom navigation.

This is the dedicated place for:
- import prompt
- import preview
- queue progress
- one-at-a-time cozy rating
- skipped review
- completion state

### 3. IMDb CSV parsing

The app now parses IMDb ratings CSV locally.

Supported columns currently depend on:
- `Const`
- `Your Rating`
- `Title`
- `Title Type`

Additional imported metadata used when present:
- `Year`
- `Genres`
- `Date Rated`
- `Runtime (mins)`
- `IMDb Rating`
- `Release Date`
- `Directors`

### 4. Import rules

Current import behavior:
- imports `Movie` rows only
- skips TV rows for now
- skips rows missing IMDb ID
- does not fail whole import because of skipped rows

### 5. Import preview

The preview currently shows:
- total rows found
- movies ready
- TV titles skipped
- invalid / skipped rows

### 6. Local import storage

The import queue is currently stored locally in browser storage.

The local model includes:
- import batch
- imported movie records
- queue state

Important implementation rule already in place:
- imported IMDb data is separated from cozy score state
- local queue records are structured so they can later migrate cleanly into account-backed storage

### 7. Cozy Queue workflow

The queue currently supports:
- one imported movie at a time
- title, year, genres, IMDb user rating
- 1 to 10 cozy selection
- `Save and Next`
- `Skip`
- `Exit`
- automatic resume later

### 8. Completion flow

When the unrated queue is exhausted, the app now shows:
- completion summary
- rated count
- skipped count
- option to review skipped titles
- option to import a new IMDb file
- option to go to leaderboard

### 9. Poster metadata hydration

The queue now hydrates poster metadata for imported movies.

Important detail:
- imported records do not inherently contain poster URLs
- the app now fetches lightweight movie metadata for queue items so the active card can show poster art instead of a blank placeholder block

### 10. Test coverage

There is now regression coverage for this feature in:
- unit / logic tests for parsing and local import state
- browser smoke coverage for upload -> preview -> rate -> reload -> resume -> skip -> review skipped

---

## Main technical decisions already made

These decisions should be preserved unless there is a strong reason to change them.

### 1. Local-first Phase 1

Phase 1 is intentionally local-first.

Reason:
- validates user demand before account complexity
- keeps scope much smaller
- fits the app’s current local-first patterns like `My Services`

### 2. Dedicated page, not inline Discover

The queue remains a separate focused flow.

Reason:
- better UX
- less Discover clutter
- cleaner implementation boundary

### 3. Use IMDb ID as primary imported key

Imported rows use IMDb `Const` as the canonical identifier when available.

Reason:
- avoids fuzzy title matching as the main path
- much more reliable
- fits the app’s existing IMDb-based movie identification model

### 4. Reuse existing cozy save API

Queue ratings still use the existing cozy save backend path.

Reason:
- keeps cozy score behavior consistent with the rest of the app
- avoids creating a second parallel cozy persistence model

### 5. Structure local data as if accounts already exist

Even though Phase 1 is local-only, the storage model is intentionally user-shaped.

Reason:
- future migration to accounts is simpler
- avoids a large rewrite later

### 6. Keep backend changes minimal

Backend changes should stay narrow and additive.

Current backend additions for this feature are limited to:
- lightweight movie metadata lookup needed for queue poster hydration
- test-only rate limiter bypass for Playwright mock server

---

## Key files currently involved

### Frontend shell and flow
- [index.html](C:\Users\dougs\Movie_Fun_Codex\index.html)
- [src/main.js](C:\Users\dougs\Movie_Fun_Codex\src\main.js)
- [src/ui/renderers.js](C:\Users\dougs\Movie_Fun_Codex\src\ui\renderers.js)
- [styles/main.css](C:\Users\dougs\Movie_Fun_Codex\styles\main.css)

### New import / queue modules
- [src/features/imdbImport.mjs](C:\Users\dougs\Movie_Fun_Codex\src\features\imdbImport.mjs)
- [src/features/importStorage.mjs](C:\Users\dougs\Movie_Fun_Codex\src\features\importStorage.mjs)

### Frontend API client
- [src/api/client.js](C:\Users\dougs\Movie_Fun_Codex\src\api\client.js)

### Backend
- [server/app.js](C:\Users\dougs\Movie_Fun_Codex\server\app.js)
- [server/services/imdbService.js](C:\Users\dougs\Movie_Fun_Codex\server\services\imdbService.js)

### Tests
- [test/imdb-import.test.mjs](C:\Users\dougs\Movie_Fun_Codex\test\imdb-import.test.mjs)
- [test/e2e/smoke.spec.js](C:\Users\dougs\Movie_Fun_Codex\test\e2e\smoke.spec.js)
- [test/e2e/mockServer.js](C:\Users\dougs\Movie_Fun_Codex\test\e2e\mockServer.js)
- [test/e2e/fixtures/imdb-ratings.csv](C:\Users\dougs\Movie_Fun_Codex\test\e2e\fixtures\imdb-ratings.csv)

---

## Current limitations

These are known and acceptable for the current phase unless priorities change.

- queue persistence is local to one browser/device only
- no account ownership yet
- no cross-device sync
- no TV-series queue support yet
- no advanced match correction UI
- no re-import merge strategy beyond replacing the current local queue
- poster metadata depends on upstream metadata lookup success
- import history is currently treated as one active queue model, not a deep import-history management system

---

## Best next product / engineering steps

If continuing this feature in a later session, the highest-value next directions are:

### Option 1: polish Phase 1 UX

- improve queue copy and progress messaging
- improve completion state
- make skipped-review flow richer
- add clearer import success / replacement warnings
- add stronger empty / error states

### Option 2: strengthen Phase 1 data behavior

- preserve multiple import batches instead of only one active local queue
- support safer re-import behavior
- add light dedupe rules if the same movie appears again in a later import

### Option 3: prepare for accounts

- define account-backed data model for imported movies and user-owned cozy queue progress
- design local-to-account migration flow
- choose auth approach before implementation

### Option 4: add personalization after enough data exists

- cozy taste summary
- imported library stats
- “rate these next” prioritization
- recommendation surfaces based on imported + cozy data

---

## Immediate next-session starting point

If a future session resumes from here, the recommended opening move is:

1. Read this file
2. Read [PROJECT_MEMORY.md](C:\Users\dougs\Movie_Fun_Codex\PROJECT_MEMORY.md)
3. Review current Cozy Queue behavior in:
   - [src/main.js](C:\Users\dougs\Movie_Fun_Codex\src\main.js)
   - [src/features/imdbImport.mjs](C:\Users\dougs\Movie_Fun_Codex\src\features\imdbImport.mjs)
   - [src/features/importStorage.mjs](C:\Users\dougs\Movie_Fun_Codex\src\features\importStorage.mjs)
4. Decide whether the next step is:
   - Phase 1 polish
   - Phase 1 data refinement
   - Phase 2 account planning

---

## Short summary

The feature direction is now clear:

- import IMDb ratings
- build a dedicated Cozy Queue
- rate imported movies quickly
- save locally first
- add accounts later
- unlock personalization after ownership and enough data exist

That is the intended path unless product priorities change.
