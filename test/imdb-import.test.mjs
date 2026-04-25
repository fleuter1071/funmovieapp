import test from "node:test";
import assert from "node:assert/strict";

import { parseImdbRatingsCsv } from "../src/features/imdbImport.mjs";
import {
    getCurrentQueueMovie,
    getQueueSummary,
    markImportedMovieRated,
    markImportedMovieSkipped,
    replaceImportBatch,
    restoreSkippedMovies
} from "../src/features/importStorage.mjs";
import { escapeHtml } from "../src/ui/renderers.js";

function createMemoryStorage() {
    const state = new Map();
    return {
        getItem(key) {
            return state.has(key) ? state.get(key) : null;
        },
        setItem(key, value) {
            state.set(key, String(value));
        },
        removeItem(key) {
            state.delete(key);
        }
    };
}

const SAMPLE_CSV = [
    "Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors",
    'tt0117571,8,2026-04-03,"Scream","Scream",https://www.imdb.com/title/tt0117571,Movie,7.4,111,1996,"Horror, Mystery",423424,"1996-12-20","Wes Craven"',
    'tt0903747,10,2026-03-29,"Breaking Bad","Breaking Bad",https://www.imdb.com/title/tt0903747,TV Series,9.5,48,2008,"Drama, Crime, Thriller",2595082,"2008-01-20",',
    'tt0107048,9,2026-03-29,"Groundhog Day","Groundhog Day",https://www.imdb.com/title/tt0107048,Movie,8.0,101,1993,"Comedy, Fantasy, Romance",729394,"1993-02-12","Harold Ramis"'
].join("\n");

test("parseImdbRatingsCsv keeps movie rows and summarizes skipped rows", () => {
    const parsed = parseImdbRatingsCsv(SAMPLE_CSV, { sourceName: "ratings.csv" });

    assert.equal(parsed.sourceName, "ratings.csv");
    assert.equal(parsed.summary.totalRows, 3);
    assert.equal(parsed.summary.importableMovies, 2);
    assert.equal(parsed.summary.skippedNonMovie, 1);
    assert.equal(parsed.records[0].imdbId, "tt0117571");
    assert.deepEqual(parsed.records[0].genres, ["Horror", "Mystery"]);
    assert.equal(parsed.records[1].title, "Groundhog Day");
});

test("escapeHtml renders imported text as inert text", () => {
    const unsafe = `<img src=x onerror="alert('xss')"> & "quote"`;

    assert.equal(
        escapeHtml(unsafe),
        "&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; &quot;quote&quot;"
    );
});

test("import storage tracks rating, skipping, and skipped review state", () => {
    const storage = createMemoryStorage();
    const parsed = parseImdbRatingsCsv(SAMPLE_CSV, { sourceName: "ratings.csv" });

    replaceImportBatch(parsed, { storage });
    let summary = getQueueSummary({ storage });
    assert.equal(summary.totalCount, 2);
    assert.equal(summary.remainingCount, 2);
    assert.equal(getCurrentQueueMovie({ storage }).imdbId, "tt0117571");

    markImportedMovieRated("tt0117571", 7, { storage });
    summary = getQueueSummary({ storage });
    assert.equal(summary.ratedCount, 1);
    assert.equal(summary.remainingCount, 1);
    assert.equal(getCurrentQueueMovie({ storage }).imdbId, "tt0107048");

    markImportedMovieSkipped("tt0107048", { storage });
    summary = getQueueSummary({ storage });
    assert.equal(summary.skippedCount, 1);
    assert.equal(summary.remainingCount, 0);
    assert.equal(getCurrentQueueMovie({ storage }), null);

    restoreSkippedMovies({ storage });
    summary = getQueueSummary({ storage });
    assert.equal(summary.skippedCount, 0);
    assert.equal(summary.remainingCount, 1);
    assert.equal(getCurrentQueueMovie({ storage }).imdbId, "tt0107048");
});
