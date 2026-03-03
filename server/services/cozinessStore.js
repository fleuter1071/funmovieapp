const supabaseService = require("./cozinessService");
const sqliteService = require("./cozinessSqliteService");
const { searchMovies } = require("./imdbService");
const { getTmdbMetadataByImdbId, isTmdbConfigured } = require("./tmdbService");

function hasSupabaseConfig() {
    return Boolean(String(process.env.SUPABASE_URL || "").trim() && String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
}

function shouldUseSqlite() {
    const storeOverride = String(process.env.COZINESS_STORE || "").trim().toLowerCase();
    if (storeOverride === "sqlite") {
        return true;
    }
    if (storeOverride === "supabase") {
        return false;
    }
    return String(process.env.NODE_ENV || "").trim().toLowerCase() === "development";
}

function getStore() {
    if (shouldUseSqlite()) {
        return sqliteService;
    }
    if (hasSupabaseConfig()) {
        return supabaseService;
    }
    return sqliteService;
}

async function getCozinessRating(imdbId, ctx) {
    return getStore().getCozinessRating(imdbId, ctx);
}

async function getCozinessRatingsBatch(imdbIds, ctx) {
    return getStore().getCozinessRatingsBatch(imdbIds, ctx);
}

async function upsertCozinessRating(imdbId, score, ctx) {
    return getStore().upsertCozinessRating(imdbId, score, ctx);
}

async function upsertMovieMetadata(movie, ctx) {
    const store = getStore();
    if (typeof store.upsertMovieMetadata !== "function") {
        return null;
    }

    const normalizedMovie = {
        imdbId: String(movie?.imdbId || "").trim(),
        title: String(movie?.title || "").trim() || null,
        year: Number.isInteger(Number(movie?.year)) ? Number(movie.year) : null,
        posterUrl: String(movie?.posterUrl || "").trim() || null,
        genres: Array.isArray(movie?.genres) ? movie.genres.map((genre) => String(genre || "").trim()).filter(Boolean) : []
    };

    const needsGenres = !normalizedMovie.genres.length || normalizedMovie.genres.some((genre) => genre.toLowerCase() === "uncategorized");
    if (normalizedMovie.imdbId && needsGenres && isTmdbConfigured()) {
        try {
            const tmdbMetadata = await getTmdbMetadataByImdbId(normalizedMovie.imdbId);
            if (tmdbMetadata) {
                normalizedMovie.title = normalizedMovie.title || tmdbMetadata.title || null;
                normalizedMovie.year = normalizedMovie.year || tmdbMetadata.year || null;
                normalizedMovie.posterUrl = normalizedMovie.posterUrl || tmdbMetadata.posterUrl || null;
                if (Array.isArray(tmdbMetadata.genres) && tmdbMetadata.genres.length) {
                    normalizedMovie.genres = tmdbMetadata.genres;
                }
            }
        } catch (error) {
            // Keep best-effort behavior when TMDB is unavailable.
        }
    }

    return store.upsertMovieMetadata(normalizedMovie, ctx);
}

async function getLeaderboard(options, ctx) {
    const store = getStore();
    if (typeof store.getLeaderboard !== "function") {
        return { items: [], availableGenres: [] };
    }

    const initial = await store.getLeaderboard(options, ctx);
    const items = Array.isArray(initial?.items) ? initial.items : [];
    const canBackfill = typeof store.upsertMovieMetadata === "function";

    if (!canBackfill) {
        return initial;
    }

    const missingRows = items.filter((item) => {
        const imdbId = String(item?.imdbId || "").trim();
        if (!imdbId) {
            return false;
        }
        const title = String(item?.title || "").trim();
        const posterUrl = String(item?.posterUrl || "").trim();
        const genre = String(item?.genre || "").trim();
        return !title
            || title.toLowerCase() === imdbId.toLowerCase()
            || !posterUrl
            || !genre
            || genre.toLowerCase() === "uncategorized";
    }).slice(0, 25);

    if (!missingRows.length) {
        return initial;
    }

    let updatedAny = false;
    for (const row of missingRows) {
        const imdbId = String(row.imdbId || "").trim();
        if (!imdbId) {
            continue;
        }
        try {
            let tmdbMetadata = null;
            if (isTmdbConfigured()) {
                tmdbMetadata = await getTmdbMetadataByImdbId(imdbId);
            }

            const searchResults = await searchMovies(imdbId, { requestId: ctx?.requestId || "unknown" });
            const match = Array.isArray(searchResults)
                ? searchResults.find((candidate) => String(candidate?.imdbId || "").toLowerCase() === imdbId.toLowerCase()) || searchResults[0]
                : null;

            if (!match) {
                continue;
            }

            await store.upsertMovieMetadata({
                imdbId,
                title: tmdbMetadata?.title || match.title || row.title || imdbId,
                year: tmdbMetadata?.year || match.year || row.year || null,
                posterUrl: tmdbMetadata?.posterUrl || match.posterUrl || row.posterUrl || null,
                genres: Array.isArray(tmdbMetadata?.genres) && tmdbMetadata.genres.length
                    ? tmdbMetadata.genres
                    : row.genre && row.genre.toLowerCase() !== "uncategorized"
                        ? [row.genre]
                        : []
            }, ctx);
            updatedAny = true;
        } catch (error) {
            // Continue best-effort enrichment for remaining rows.
        }
    }

    if (!updatedAny) {
        return initial;
    }

    return store.getLeaderboard(options, ctx);
}

module.exports = {
    getCozinessRating,
    getCozinessRatingsBatch,
    upsertCozinessRating,
    upsertMovieMetadata,
    getLeaderboard
};
