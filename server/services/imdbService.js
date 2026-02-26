const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const STREAMING_CACHE_TTL_MS = 15 * 60 * 1000;
const TRAILER_CACHE_TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 5000;
const RETRIES = 1;

const searchCache = new Map();
const streamingCache = new Map();
const trailerCache = new Map();

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

function logTrailerDecision(requestId, details) {
    const log = {
        ts: new Date().toISOString(),
        requestId,
        event: "trailer_resolution",
        ...details
    };

    console.log(JSON.stringify(log));
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

function pickBestDescription(rows, imdbId) {
    if (!rows.length) {
        return null;
    }

    if (imdbId) {
        const exact = rows.find((row) => String(row?.imdbId || "").toLowerCase() === String(imdbId).toLowerCase());
        if (exact) {
            return exact;
        }
    }

    return rows[0];
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

    const descriptions = Array.isArray(upstream?.description) ? upstream.description : [];
    const selected = pickBestDescription(descriptions, imdbId);
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
        writeCache(trailerCache, cacheKey, payload, TRAILER_CACHE_TTL_MS);
        return payload;
    }

    try {
        const mediaUrl = `https://imdb.iamidiotareyoutoo.com/media/${encodeURIComponent(imdbId)}`;
        const response = await fetchHeadWithRetry(mediaUrl, requestId);
        const contentType = String(response.headers.get("content-type") || "");

        if (isPlayableMediaContentType(contentType)) {
            const payload = {
                url: mediaUrl,
                source: "free-movie-db",
                imdbId,
                trailerDecisionReason: "playable_media_content_type"
            };
            logTrailerDecision(requestId, {
                imdbId,
                source: payload.source,
                reason: payload.trailerDecisionReason,
                contentType
            });
            writeCache(trailerCache, cacheKey, payload, TRAILER_CACHE_TTL_MS);
            return payload;
        }

        const payload = {
            ...fallbackBase,
            trailerDecisionReason: "non_playable_media_content_type"
        };
        logTrailerDecision(requestId, {
            imdbId,
            source: payload.source,
            reason: payload.trailerDecisionReason,
            contentType
        });
        writeCache(trailerCache, cacheKey, payload, TRAILER_CACHE_TTL_MS);
        return payload;
    } catch (error) {
        const payload = {
            ...fallbackBase,
            trailerDecisionReason: "media_head_request_failed"
        };
        logTrailerDecision(requestId, {
            imdbId,
            source: payload.source,
            reason: payload.trailerDecisionReason,
            error: String(error?.message || error)
        });
        writeCache(trailerCache, cacheKey, payload, TRAILER_CACHE_TTL_MS);
        return payload;
    }
}

module.exports = {
    searchMovies,
    getStreamingProviders,
    resolveTrailerUrl
};
