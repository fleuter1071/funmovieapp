const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const TABLE_NAME = "movie_coziness_ratings";

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

module.exports = {
    getCozinessRating,
    getCozinessRatingsBatch,
    upsertCozinessRating
};
