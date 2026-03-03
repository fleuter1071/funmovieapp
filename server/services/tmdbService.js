const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w342";
const TIMEOUT_MS = 5000;

let genreCache = {
    expiresAt: 0,
    byId: {}
};

function looksLikePlaceholder(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
        return true;
    }
    return normalized.includes("your_") || normalized.includes("replace_") || normalized.includes("example");
}

function getTmdbApiKey() {
    return String(process.env.TMDB_API_KEY || "").trim();
}

function getTmdbReadAccessToken() {
    return String(process.env.TMDB_READ_ACCESS_TOKEN || "").trim();
}

function isTmdbConfigured() {
    const token = getTmdbReadAccessToken();
    const apiKey = getTmdbApiKey();
    const hasToken = token && !looksLikePlaceholder(token);
    const hasApiKey = apiKey && !looksLikePlaceholder(apiKey);
    return Boolean(hasToken || hasApiKey);
}

function getRequestHeaders() {
    const token = getTmdbReadAccessToken();
    const headers = {
        "Content-Type": "application/json"
    };

    if (token && !looksLikePlaceholder(token)) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

function buildUrl(pathname, searchParams = {}) {
    const url = new URL(`${TMDB_BASE_URL}${pathname}`);
    for (const [key, value] of Object.entries(searchParams)) {
        if (value === undefined || value === null || value === "") {
            continue;
        }
        url.searchParams.set(key, String(value));
    }

    const apiKey = getTmdbApiKey();
    if (!url.searchParams.has("api_key") && apiKey && !looksLikePlaceholder(apiKey)) {
        url.searchParams.set("api_key", apiKey);
    }

    return url;
}

async function fetchJson(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: getRequestHeaders(),
            signal: controller.signal
        });
        if (!response.ok) {
            throw new Error(`TMDB response ${response.status}`);
        }
        return await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
}

async function getGenreMap() {
    const now = Date.now();
    if (now < genreCache.expiresAt && Object.keys(genreCache.byId).length) {
        return genreCache.byId;
    }

    const url = buildUrl("/genre/movie/list", { language: "en-US" });
    const payload = await fetchJson(url);
    const genres = Array.isArray(payload?.genres) ? payload.genres : [];
    const byId = {};
    for (const genre of genres) {
        const id = Number(genre?.id);
        const name = String(genre?.name || "").trim();
        if (Number.isInteger(id) && name) {
            byId[id] = name;
        }
    }

    genreCache = {
        byId,
        expiresAt: now + 24 * 60 * 60 * 1000
    };
    return byId;
}

function normalizeReleaseYear(value) {
    const text = String(value || "").trim();
    if (!text) {
        return null;
    }
    const year = Number(text.slice(0, 4));
    return Number.isInteger(year) ? year : null;
}

async function getTmdbMetadataByImdbId(imdbId) {
    const normalizedImdbId = String(imdbId || "").trim();
    if (!normalizedImdbId || !isTmdbConfigured()) {
        return null;
    }

    const findUrl = buildUrl(`/find/${encodeURIComponent(normalizedImdbId)}`, {
        external_source: "imdb_id",
        language: "en-US"
    });

    const findPayload = await fetchJson(findUrl);
    const movieResults = Array.isArray(findPayload?.movie_results) ? findPayload.movie_results : [];
    const match = movieResults[0];
    if (!match) {
        return null;
    }

    const genreIds = Array.isArray(match.genre_ids) ? match.genre_ids.map((id) => Number(id)).filter(Number.isInteger) : [];
    const genreMap = await getGenreMap();
    let genres = genreIds.map((id) => genreMap[id]).filter(Boolean);

    if (!genres.length && Number.isInteger(Number(match.id))) {
        try {
            const detailsUrl = buildUrl(`/movie/${encodeURIComponent(match.id)}`, { language: "en-US" });
            const details = await fetchJson(detailsUrl);
            genres = (Array.isArray(details?.genres) ? details.genres : [])
                .map((genre) => String(genre?.name || "").trim())
                .filter(Boolean);
        } catch (error) {
            // Keep best-effort behavior.
        }
    }

    const posterPath = String(match.poster_path || "").trim();
    const posterUrl = posterPath ? `${TMDB_IMAGE_BASE_URL}${posterPath}` : "";

    return {
        imdbId: normalizedImdbId,
        title: String(match.title || "").trim() || null,
        year: normalizeReleaseYear(match.release_date),
        posterUrl: posterUrl || null,
        genres: [...new Set(genres)].slice(0, 8)
    };
}

module.exports = {
    isTmdbConfigured,
    getTmdbMetadataByImdbId
};
