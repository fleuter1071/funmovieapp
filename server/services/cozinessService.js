const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const TABLE_NAME = "movie_coziness_ratings";
const MOVIE_TABLE_NAME = "movie_catalog";
const LEADERBOARD_VIEW = "movie_coziness_leaderboard";

function createConfigurationError() {
    const error = new Error("Coziness ratings service is not configured.");
    error.code = "COZINESS_NOT_CONFIGURED";
    return error;
}

function createUpstreamError(message, status) {
    const error = new Error(message);
    error.code = "COZINESS_UPSTREAM_ERROR";
    error.status = status;
    return error;
}

function assertConfigured() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw createConfigurationError();
    }
}

function getDefaultHeaders() {
    return {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
    };
}

async function readJsonResponse(response) {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw createUpstreamError("Unexpected Supabase response format.", response.status);
    }
}

function normalizeRow(row) {
    if (!row) {
        return null;
    }

    return {
        imdbId: row.imdb_id,
        score: row.coziness_score,
        updatedAt: row.updated_at || null
    };
}

function buildBatchInFilter(imdbIds) {
    return `in.(${imdbIds.map((id) => `"${id}"`).join(",")})`;
}

async function getCozinessRating(imdbId) {
    assertConfigured();
    const url = new URL(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}`);
    url.searchParams.set("select", "imdb_id,coziness_score,updated_at");
    url.searchParams.set("imdb_id", `eq.${imdbId}`);
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
        method: "GET",
        headers: getDefaultHeaders()
    });

    if (!response.ok) {
        throw createUpstreamError("Failed to fetch coziness rating.", response.status);
    }

    const payload = await readJsonResponse(response);
    return normalizeRow(Array.isArray(payload) ? payload[0] : null);
}

async function getCozinessRatingsBatch(imdbIds) {
    assertConfigured();

    if (!imdbIds.length) {
        return {};
    }

    const url = new URL(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}`);
    url.searchParams.set("select", "imdb_id,coziness_score,updated_at");
    url.searchParams.set("imdb_id", buildBatchInFilter(imdbIds));

    const response = await fetch(url, {
        method: "GET",
        headers: getDefaultHeaders()
    });

    if (!response.ok) {
        throw createUpstreamError("Failed to fetch coziness ratings.", response.status);
    }

    const payload = await readJsonResponse(response);
    const map = {};
    const rows = Array.isArray(payload) ? payload : [];

    for (const row of rows) {
        const normalized = normalizeRow(row);
        if (normalized?.imdbId) {
            map[normalized.imdbId] = normalized;
        }
    }

    return map;
}

async function upsertCozinessRating(imdbId, score) {
    assertConfigured();
    const url = new URL(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}`);
    url.searchParams.set("on_conflict", "imdb_id");
    url.searchParams.set("select", "imdb_id,coziness_score,updated_at");

    const response = await fetch(url, {
        method: "POST",
        headers: {
            ...getDefaultHeaders(),
            Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify([
            {
                imdb_id: imdbId,
                coziness_score: score
            }
        ])
    });

    if (!response.ok) {
        throw createUpstreamError("Failed to save coziness rating.", response.status);
    }

    const payload = await readJsonResponse(response);
    return normalizeRow(Array.isArray(payload) ? payload[0] : null);
}

function normalizeGenreList(genres) {
    if (!Array.isArray(genres)) {
        return [];
    }
    return genres
        .map((genre) => String(genre || "").trim())
        .filter(Boolean)
        .slice(0, 8);
}

async function upsertMovieMetadata(movie) {
    assertConfigured();

    const imdbId = String(movie?.imdbId || "").trim();
    if (!imdbId) {
        return null;
    }

    const title = String(movie?.title || "").trim() || null;
    const releaseYear = Number.isInteger(Number(movie?.year)) ? Number(movie.year) : null;
    const posterUrl = String(movie?.posterUrl || "").trim() || null;
    const genres = normalizeGenreList(movie?.genres);
    const primaryGenre = genres[0] || String(movie?.genre || "").trim() || "Uncategorized";

    const url = new URL(`${SUPABASE_URL}/rest/v1/${MOVIE_TABLE_NAME}`);
    url.searchParams.set("on_conflict", "imdb_id");
    url.searchParams.set("select", "imdb_id,title,release_year,poster_url,primary_genre,genres,updated_at");

    const response = await fetch(url, {
        method: "POST",
        headers: {
            ...getDefaultHeaders(),
            Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify([
            {
                imdb_id: imdbId,
                title,
                release_year: releaseYear,
                poster_url: posterUrl,
                primary_genre: primaryGenre,
                genres: genres.length ? genres : null
            }
        ])
    });

    if (!response.ok) {
        throw createUpstreamError("Failed to upsert movie metadata.", response.status);
    }

    const payload = await readJsonResponse(response);
    return Array.isArray(payload) ? payload[0] || null : null;
}

async function getLeaderboard(options = {}) {
    assertConfigured();

    const genre = String(options?.genre || "all").trim();
    const sortOrder = String(options?.sortOrder || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc";

    const url = new URL(`${SUPABASE_URL}/rest/v1/${LEADERBOARD_VIEW}`);
    url.searchParams.set("select", "imdb_id,title,release_year,poster_url,primary_genre,coziness_score,updated_at");
    if (genre && genre.toLowerCase() !== "all") {
        url.searchParams.set("primary_genre", `eq.${genre}`);
    }
    url.searchParams.set("order", `coziness_score.${sortOrder},title.asc`);

    const response = await fetch(url, {
        method: "GET",
        headers: getDefaultHeaders()
    });

    if (!response.ok) {
        throw createUpstreamError("Failed to fetch leaderboard data.", response.status);
    }

    const payload = await readJsonResponse(response);
    const rows = Array.isArray(payload) ? payload : [];
    const items = rows.map((row, index) => ({
        rank: index + 1,
        imdbId: row.imdb_id,
        title: row.title || row.imdb_id,
        year: row.release_year || null,
        posterUrl: row.poster_url || "",
        genre: row.primary_genre || null,
        score: Number(row.coziness_score),
        updatedAt: row.updated_at || null
    }));

    const genreUrl = new URL(`${SUPABASE_URL}/rest/v1/${LEADERBOARD_VIEW}`);
    genreUrl.searchParams.set("select", "primary_genre");
    genreUrl.searchParams.set("primary_genre", "not.is.null");

    const genreResponse = await fetch(genreUrl, {
        method: "GET",
        headers: getDefaultHeaders()
    });

    let availableGenres = [];
    if (genreResponse.ok) {
        const genrePayload = await readJsonResponse(genreResponse);
        const unique = new Set((Array.isArray(genrePayload) ? genrePayload : []).map((row) => String(row.primary_genre || "").trim()).filter(Boolean));
        availableGenres = Array.from(unique).sort((a, b) => a.localeCompare(b));
    }

    return { items, availableGenres };
}

module.exports = {
    getCozinessRating,
    getCozinessRatingsBatch,
    upsertCozinessRating,
    upsertMovieMetadata,
    getLeaderboard
};
