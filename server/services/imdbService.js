const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const STREAMING_CACHE_TTL_MS = 15 * 60 * 1000;
const TRAILER_CACHE_TTL_MS = 10 * 60 * 1000;
const TRAILER_FAILURE_CACHE_TTL_MS = 60 * 1000;
const OMDB_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;
const RETRIES = 2;

const searchCache = new Map();
const streamingCache = new Map();
const trailerCache = new Map();
const omdbCache = new Map();

const PROVIDER_BRAND_DOMAIN_MAP = {
    "Amazon Video": "amazon.com",
    "Prime Video": "primevideo.com",
    "Apple TV Store": "apple.com",
    "Apple TV+": "apple.com",
    "Google Play Movies": "play.google.com",
    "YouTube": "youtube.com",
    "YouTube Movies": "youtube.com",
    "Netflix": "netflix.com",
    "Hulu": "hulu.com",
    "Max": "max.com",
    "Disney Plus": "disneyplus.com",
    "Paramount Plus": "paramountplus.com",
    "Peacock Premium": "peacocktv.com",
    "Tubi TV": "tubitv.com",
    "MGM Plus": "mgmplus.com",
    "AMC Plus Apple TV Channel ": "amcplus.com",
    "Shudder Amazon Channel": "shudder.com",
    "Fandango At Home": "vudu.com"
};

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
                const error = new Error(`Upstream response ${response.status}`);
                error.code = "UPSTREAM_HTTP_ERROR";
                error.upstream = {
                    failureType: "http_error",
                    status: response.status,
                    url,
                    method: "GET"
                };
                throw error;
            }

            return await response.json();
        } catch (error) {
            lastError = normalizeUpstreamError(error, url, attempt, "GET");

            if (attempt === RETRIES) {
                throw lastError;
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw lastError || new Error("Unknown upstream error");
}

async function fetchWithMethodRetry(url, requestId, method = "GET") {
    let lastError = null;

    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method,
                signal: controller.signal,
                headers: {
                    "x-request-id": requestId
                }
            });

            if (!response.ok) {
                const error = new Error(`Upstream response ${response.status}`);
                error.code = "UPSTREAM_HTTP_ERROR";
                error.upstream = {
                    failureType: "http_error",
                    status: response.status,
                    url,
                    method
                };
                throw error;
            }

            return response;
        } catch (error) {
            lastError = normalizeUpstreamError(error, url, attempt, method);

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
    return (
        normalized.startsWith("video/") ||
        normalized.includes("octet-stream") ||
        normalized.includes("application/vnd.apple.mpegurl") ||
        normalized.includes("application/x-mpegurl") ||
        normalized.includes("application/dash+xml") ||
        normalized.includes("mp2t")
    );
}

function isLikelyPlayableMediaUrl(url) {
    if (!url) {
        return false;
    }
    const normalized = String(url).toLowerCase();
    return (
        normalized.includes(".mp4") ||
        normalized.includes(".m3u8") ||
        normalized.includes(".mpd") ||
        normalized.includes(".webm") ||
        normalized.includes("/video/") ||
        normalized.includes("/stream/")
    );
}

function logTrailerDecision(requestId, details) {
    const log = {
        ts: new Date().toISOString(),
        requestId,
        event: "trailer_resolution",
        ...details
    };

    console.log(JSON.stringify(log));
}

function normalizeUpstreamError(error, url, attempt, method = "GET") {
    const normalized = error instanceof Error ? error : new Error(String(error || "Unknown upstream error"));
    const failureType = normalized?.name === "AbortError"
        ? "timeout"
        : normalized?.code === "UPSTREAM_HTTP_ERROR"
            ? "http_error"
            : normalized?.cause?.code === "ENOTFOUND" || normalized?.code === "ENOTFOUND"
                ? "dns_failure"
                : normalized?.cause?.code === "ECONNRESET" || normalized?.code === "ECONNRESET"
                    ? "connection_reset"
                    : normalized?.cause?.code === "ECONNREFUSED" || normalized?.code === "ECONNREFUSED"
                        ? "connection_refused"
                        : "network_error";

    normalized.upstream = {
        ...(normalized.upstream || {}),
        failureType,
        url,
        method,
        attempt: attempt + 1,
        timeoutMs: TIMEOUT_MS
    };

    return normalized;
}

function buildYoutubeFallbackUrl(title) {
    const query = `${title || "movie"} trailer`;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function getOmdbApiKey() {
    return String(process.env.OMDB_API_KEY || "").trim();
}

function normalizeImdbRating(value) {
    const normalized = String(value || "").trim();
    if (!normalized || normalized.toUpperCase() === "N/A") {
        return null;
    }
    return normalized;
}

function normalizeRottenTomatoesRating(ratings) {
    const list = Array.isArray(ratings) ? ratings : [];
    const match = list.find((entry) => String(entry?.Source || "").toLowerCase() === "rotten tomatoes");
    const value = String(match?.Value || "").trim();
    if (!value || value.toUpperCase() === "N/A") {
        return null;
    }
    return value;
}

async function getOmdbCriticScores(imdbId, requestId) {
    const normalizedImdbId = String(imdbId || "").trim();
    if (!normalizedImdbId) {
        return null;
    }

    const cacheKey = normalizedImdbId.toLowerCase();
    const cached = readCache(omdbCache, cacheKey);
    if (cached) {
        return cached;
    }

    const apiKey = getOmdbApiKey();
    if (!apiKey) {
        return null;
    }

    const url = `https://www.omdbapi.com/?i=${encodeURIComponent(normalizedImdbId)}&apikey=${encodeURIComponent(apiKey)}`;

    try {
        const payload = await fetchJsonWithRetry(url, requestId);
        if (String(payload?.Response || "").toLowerCase() === "false") {
            return null;
        }

        const scores = {
            imdbRating: normalizeImdbRating(payload?.imdbRating),
            rottenTomatoesRating: normalizeRottenTomatoesRating(payload?.Ratings)
        };

        if (!scores.imdbRating && !scores.rottenTomatoesRating) {
            return null;
        }

        writeCache(omdbCache, cacheKey, scores, OMDB_CACHE_TTL_MS);
        return scores;
    } catch (error) {
        return null;
    }
}

async function enrichSearchResultsWithCriticScores(movies, requestId) {
    if (!Array.isArray(movies) || !movies.length || !getOmdbApiKey()) {
        return movies;
    }

    const enriched = await Promise.all(movies.map(async (movie) => {
        const imdbId = String(movie?.imdbId || "").trim();
        if (!imdbId) {
            return movie;
        }

        const scores = await getOmdbCriticScores(imdbId, requestId);
        if (!scores) {
            return movie;
        }

        return {
            ...movie,
            ...(scores.imdbRating ? { imdbRating: scores.imdbRating } : {}),
            ...(scores.rottenTomatoesRating ? { rottenTomatoesRating: scores.rottenTomatoesRating } : {})
        };
    }));

    return enriched;
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

function isSafeHttpUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
        return false;
    }

    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (error) {
        return false;
    }
}

function inferAvailabilityType(rawType) {
    const type = String(rawType || "").toUpperCase();

    if (type.includes("CINEMA")) {
        return "cinema";
    }

    if (type.includes("RENT")) {
        return "rent";
    }

    if (type.includes("BUY")) {
        return "buy";
    }

    if (type.includes("FREE") || type.includes("ADS")) {
        return "free";
    }

    return "stream";
}

function getProviderLogoUrl(name, movieUrl) {
    const mappedDomain = PROVIDER_BRAND_DOMAIN_MAP[name];
    if (mappedDomain) {
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(mappedDomain)}&sz=64`;
    }

    if (isSafeHttpUrl(movieUrl)) {
        try {
            const hostname = new URL(movieUrl).hostname.replace(/^www\./i, "");
            if (hostname) {
                return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
            }
        } catch (error) {
            return "";
        }
    }

    return "";
}

function normalizeOffer(offer) {
    const name = String(offer?.name || "").trim();
    const movieUrl = String(offer?.url || "").trim();

    if (!name || !isSafeHttpUrl(movieUrl)) {
        return null;
    }

    return {
        name,
        logoUrl: getProviderLogoUrl(name, movieUrl),
        movieUrl,
        availabilityType: inferAvailabilityType(offer?.type),
        isClickable: true
    };
}

function normalizeTitleForMatch(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function getRowImdbId(row) {
    return String(row?.imdbId || row?.["#IMDB_ID"] || "").trim().toLowerCase();
}

function getRowTitle(row) {
    return String(row?.title || row?.["#TITLE"] || row?.["#TEXT"] || row?.name || "").trim();
}

function getRowYear(row) {
    const candidates = [row?.year, row?.["#YEAR"], row?.releaseYear, row?.release_year];
    for (const candidate of candidates) {
        const raw = String(candidate || "").trim();
        const match = raw.match(/\b(\d{4})\b/);
        if (match) {
            return match[1];
        }
    }
    return "";
}

function buildStreamingCacheKey({ imdbId, title, year }) {
    return [String(imdbId || "").trim().toLowerCase(), String(title || "").trim().toLowerCase(), String(year || "").trim()]
        .filter(Boolean)
        .join("|");
}

function buildStreamingQuery({ imdbId, title, year }) {
    const normalizedTitle = String(title || "").trim();
    const normalizedYear = String(year || "").trim();
    if (normalizedTitle && normalizedYear) {
        return `${normalizedTitle} ${normalizedYear}`;
    }
    return normalizedTitle || String(imdbId || "").trim();
}
function pickBestDescription(rows, imdbId, title = "", year = "") {
    if (!rows.length) {
        return null;
    }

    const normalizedImdbId = String(imdbId || "").trim().toLowerCase();
    if (normalizedImdbId) {
        const exact = rows.find((row) => getRowImdbId(row) === normalizedImdbId);
        if (exact) {
            return exact;
        }
    }

    const normalizedTitle = normalizeTitleForMatch(title);
    let candidates = rows;
    if (normalizedTitle) {
        const titleMatches = rows.filter((row) => normalizeTitleForMatch(getRowTitle(row)) === normalizedTitle);
        if (titleMatches.length) {
            candidates = titleMatches;
        }
    }

    const normalizedYear = String(year || "").trim();
    if (normalizedYear) {
        const yearMatch = candidates.find((row) => getRowYear(row) === normalizedYear);
        if (yearMatch) {
            return yearMatch;
        }
    }

    return candidates[0] || rows[0];
}

function dedupeProviders(offers) {
    const typePriority = {
        stream: 1,
        free: 2,
        rent: 3,
        buy: 4,
        cinema: 5
    };
    const byName = new Map();

    for (const offer of offers) {
        const existing = byName.get(offer.name);
        if (!existing) {
            byName.set(offer.name, offer);
            continue;
        }

        const currentRank = typePriority[offer.availabilityType] || 99;
        const existingRank = typePriority[existing.availabilityType] || 99;
        if (currentRank < existingRank) {
            byName.set(offer.name, offer);
        }
    }

    return Array.from(byName.values()).sort((a, b) => {
        const rankA = typePriority[a.availabilityType] || 99;
        const rankB = typePriority[b.availabilityType] || 99;
        if (rankA !== rankB) {
            return rankA - rankB;
        }
        return a.name.localeCompare(b.name);
    });
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
    const enriched = await enrichSearchResultsWithCriticScores(normalized, requestId);

    writeCache(searchCache, cacheKey, enriched, SEARCH_CACHE_TTL_MS);
    return enriched;
}

async function getStreamingProviders({ imdbId, title, year }, ctx = {}) {
    const requestId = ctx.requestId || "unknown";
    const searchQuery = buildStreamingQuery({ imdbId, title, year });
    const cacheKey = buildStreamingCacheKey({ imdbId, title, year }) || searchQuery.toLowerCase();
    const cached = readCache(streamingCache, cacheKey);

    if (cached) {
        return cached;
    }

    const url = `https://imdb.iamidiotareyoutoo.com/justwatch?q=${encodeURIComponent(searchQuery)}&L=en_US`;
    const upstream = await fetchJsonWithRetry(url, requestId);

    const descriptions = Array.isArray(upstream?.description) ? upstream.description : [];
    const selected = pickBestDescription(descriptions, imdbId, title, year);
    const rawOffers = Array.isArray(selected?.offers) ? selected.offers : [];
    const providers = dedupeProviders(rawOffers.map(normalizeOffer).filter(Boolean));

    const payload = {
        imdbId: imdbId || null,
        providers,
        providersLegacy: providers.map((provider) => provider.name),
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

    const fallbackBase = {
        url: buildYoutubeFallbackUrl(normalizedTitle),
        source: "youtube-fallback",
        imdbId: imdbId || null
    };

    if (!imdbId) {
        const payload = {
            ...fallbackBase,
            trailerDecisionReason: "missing_imdb_id"
        };
        logTrailerDecision(requestId, {
            imdbId: null,
            source: payload.source,
            reason: payload.trailerDecisionReason
        });
        writeCache(trailerCache, cacheKey, payload, TRAILER_FAILURE_CACHE_TTL_MS);
        return payload;
    }

    try {
        const mediaUrl = `https://imdb.iamidiotareyoutoo.com/media/${encodeURIComponent(imdbId)}`;
        const headResponse = await fetchWithMethodRetry(mediaUrl, requestId, "HEAD");
        const headContentType = String(headResponse.headers.get("content-type") || "");

        if (isPlayableMediaContentType(headContentType)) {
            const payload = {
                url: mediaUrl,
                source: "free-movie-db",
                imdbId,
                trailerDecisionReason: "playable_media_content_type_head"
            };
            logTrailerDecision(requestId, {
                imdbId,
                source: payload.source,
                reason: payload.trailerDecisionReason,
                contentType: headContentType
            });
            writeCache(trailerCache, cacheKey, payload, TRAILER_CACHE_TTL_MS);
            return payload;
        }

        // HEAD can be unreliable on some CDNs. Retry with GET probe before falling back.
        const getResponse = await fetchWithMethodRetry(mediaUrl, requestId, "GET");
        const getContentType = String(getResponse.headers.get("content-type") || "");
        const isPlayableGet = isPlayableMediaContentType(getContentType);
        const isPlayableUrl = isLikelyPlayableMediaUrl(getResponse?.url);

        if (isPlayableGet || isPlayableUrl) {
            const payload = {
                url: mediaUrl,
                source: "free-movie-db",
                imdbId,
                trailerDecisionReason: isPlayableGet
                    ? "playable_media_content_type_get"
                    : "playable_media_url_get_probe"
            };
            logTrailerDecision(requestId, {
                imdbId,
                source: payload.source,
                reason: payload.trailerDecisionReason,
                contentTypeHead: headContentType,
                contentTypeGet: getContentType,
                finalUrl: String(getResponse?.url || "")
            });
            writeCache(trailerCache, cacheKey, payload, TRAILER_CACHE_TTL_MS);
            return payload;
        }

        const payload = {
            ...fallbackBase,
            trailerDecisionReason: "non_playable_media_content_type_after_get_probe"
        };
        logTrailerDecision(requestId, {
            imdbId,
            source: payload.source,
            reason: payload.trailerDecisionReason,
            contentTypeHead: headContentType,
            contentTypeGet: getContentType
        });
        writeCache(trailerCache, cacheKey, payload, TRAILER_FAILURE_CACHE_TTL_MS);
        return payload;
    } catch (error) {
        const payload = {
            ...fallbackBase,
            trailerDecisionReason: "media_probe_request_failed"
        };
        logTrailerDecision(requestId, {
            imdbId,
            source: payload.source,
            reason: payload.trailerDecisionReason,
            error: String(error?.message || error)
        });
        writeCache(trailerCache, cacheKey, payload, TRAILER_FAILURE_CACHE_TTL_MS);
        return payload;
    }
}

module.exports = {
    searchMovies,
    getStreamingProviders,
    resolveTrailerUrl,
    buildStreamingCacheKey,
    buildStreamingQuery,
    pickBestDescription
};
