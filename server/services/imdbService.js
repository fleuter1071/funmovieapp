const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const STREAMING_CACHE_TTL_MS = 15 * 60 * 1000;
const TRAILER_CACHE_TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 5000;
const RETRIES = 1;

const searchCache = new Map();
const streamingCache = new Map();
const trailerCache = new Map();

const KNOWN_PLATFORMS = [
    "Netflix",
    "Hulu",
    "Max",
    "Amazon",
    "Prime Video",
    "Shudder",
    "AMC+",
    "Paramount+",
    "Peacock",
    "Tubi",
    "Apple TV"
];

function readCache(cache, key) {
    const entry = cache.get(key);

    if (!entry) {
        return null;
    }

    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }

    return entry.value;
}

function writeCache(cache, key, value, ttlMs) {
    cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs
    });
}

async function fetchJsonWithRetry(url, requestId) {
    let lastError = null;

    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    "x-request-id": requestId
                }
            });

            if (!response.ok) {
                throw new Error(`Upstream response ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            lastError = error;

            if (attempt === RETRIES) {
                throw lastError;
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw lastError || new Error("Unknown upstream error");
}

async function fetchHeadWithRetry(url, requestId) {
    let lastError = null;

    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: "HEAD",
                signal: controller.signal,
                headers: {
                    "x-request-id": requestId
                }
            });

            if (!response.ok) {
                throw new Error(`Upstream response ${response.status}`);
            }

            return response;
        } catch (error) {
            lastError = error;

            if (attempt === RETRIES) {
                throw lastError;
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw lastError || new Error("Unknown upstream error");
}

function isPlayableMediaContentType(contentType) {
    if (!contentType) {
        return false;
    }

    const normalized = String(contentType).toLowerCase();
    return normalized.startsWith("video/") || normalized.includes("octet-stream");
}

function buildYoutubeFallbackUrl(title) {
    const query = `${title || "movie"} trailer`;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function normalizeSearch(data) {
    const rows = Array.isArray(data?.description) ? data.description : [];

    return rows.map((movie) => ({
        imdbId: movie["#IMDB_ID"] || "",
        title: movie["#TITLE"] || "Untitled",
        year: movie["#YEAR"] || "",
        posterUrl: movie["#IMG_POSTER"] || ""
    })).filter((movie) => movie.imdbId && movie.title);
}

function collectPlatforms(obj, platforms) {
    if (typeof obj === "string") {
        KNOWN_PLATFORMS.forEach((platform) => {
            if (obj.toLowerCase().includes(platform.toLowerCase())) {
                platforms.add(platform);
            }
        });
        return;
    }

    if (Array.isArray(obj)) {
        obj.forEach((item) => collectPlatforms(item, platforms));
        return;
    }

    if (obj && typeof obj === "object") {
        if (typeof obj.provider_name === "string" && obj.provider_name.trim()) {
            platforms.add(obj.provider_name.trim());
        }

        Object.values(obj).forEach((value) => collectPlatforms(value, platforms));
    }
}

async function searchMovies(query, ctx = {}) {
    const requestId = ctx.requestId || "unknown";
    const cacheKey = query.toLowerCase();
    const cached = readCache(searchCache, cacheKey);

    if (cached) {
        return cached;
    }

    const url = `https://imdb.iamidiotareyoutoo.com/search?q=${encodeURIComponent(query)}`;
    const upstream = await fetchJsonWithRetry(url, requestId);
    const normalized = normalizeSearch(upstream);

    writeCache(searchCache, cacheKey, normalized, SEARCH_CACHE_TTL_MS);
    return normalized;
}

async function getStreamingProviders({ imdbId, title }, ctx = {}) {
    const requestId = ctx.requestId || "unknown";
    const normalizedTitle = title || imdbId;
    const cacheKey = normalizedTitle.toLowerCase();
    const cached = readCache(streamingCache, cacheKey);

    if (cached) {
        return cached;
    }

    const url = `https://imdb.iamidiotareyoutoo.com/justwatch?q=${encodeURIComponent(normalizedTitle)}&L=en_US`;
    const upstream = await fetchJsonWithRetry(url, requestId);

    const providersSet = new Set();
    collectPlatforms(upstream, providersSet);
    const providers = Array.from(providersSet).sort((a, b) => a.localeCompare(b));

    const payload = {
        imdbId: imdbId || null,
        providers,
        region: "US",
        lastUpdated: new Date().toISOString()
    };

    writeCache(streamingCache, cacheKey, payload, STREAMING_CACHE_TTL_MS);
    return payload;
}

async function resolveTrailerUrl({ imdbId, title }, ctx = {}) {
    const requestId = ctx.requestId || "unknown";
    const normalizedTitle = (title || "").trim();
    const cacheKey = `${(imdbId || "").toLowerCase()}|${normalizedTitle.toLowerCase()}`;
    const cached = readCache(trailerCache, cacheKey);

    if (cached) {
        return cached;
    }

    const fallback = {
        url: buildYoutubeFallbackUrl(normalizedTitle),
        source: "youtube-fallback",
        imdbId: imdbId || null
    };

    if (!imdbId) {
        writeCache(trailerCache, cacheKey, fallback, TRAILER_CACHE_TTL_MS);
        return fallback;
    }

    try {
        const mediaUrl = `https://imdb.iamidiotareyoutoo.com/media/${encodeURIComponent(imdbId)}`;
        const response = await fetchHeadWithRetry(mediaUrl, requestId);
        const contentType = String(response.headers.get("content-type") || "");

        if (isPlayableMediaContentType(contentType)) {
            const payload = {
                url: mediaUrl,
                source: "free-movie-db",
                imdbId
            };
            writeCache(trailerCache, cacheKey, payload, TRAILER_CACHE_TTL_MS);
            return payload;
        }
    } catch (error) {
        // Fall back to YouTube if upstream media validation fails.
    }

    writeCache(trailerCache, cacheKey, fallback, TRAILER_CACHE_TTL_MS);
    return fallback;
}

module.exports = {
    searchMovies,
    getStreamingProviders,
    resolveTrailerUrl
};
