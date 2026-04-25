const fs = require("node:fs");
const express = require("express");
const path = require("path");
const crypto = require("node:crypto");
const { getMovieMetadata, searchMovies, getStreamingProviders, resolveTrailerUrl } = require("./services/imdbService");
const {
    assertStoreConfiguration,
    getStoreStatus,
    getCozinessRating,
    getCozinessRatingsBatch,
    upsertCozinessRating,
    upsertMovieMetadata,
    getLeaderboard
} = require("./services/cozinessStore");

function loadEnvFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const separator = trimmed.indexOf("=");
        if (separator <= 0) {
            continue;
        }

        const key = trimmed.slice(0, separator).trim();
        const value = trimmed.slice(separator + 1).trim();
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnvFromFile(path.resolve(__dirname, "../.env"));

const APP_ROOT = path.resolve(__dirname, "..");
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 60;
const MAX_QUERY_LENGTH = 120;
const READINESS_TIMEOUT_MS = 6000;

function createRequestId() {
    if (typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sendError(res, requestId, status, code, message, retryable, details = null) {
    const payload = {
        code,
        message,
        retryable,
        requestId
    };

    if (details && typeof details === "object") {
        payload.details = details;
    }

    res.status(status).json({ error: payload });
}

function isValidImdbId(value) {
    return /^tt\d{5,10}$/i.test(value);
}

function isValidTextQuery(value) {
    return typeof value === "string" && value.trim().length > 0 && value.trim().length <= MAX_QUERY_LENGTH;
}

function isValidCozinessScore(value) {
    return Number.isInteger(value) && value >= 1 && value <= 10;
}

function sanitizeMovieMetadata(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const imdbId = String(value.imdbId || "").trim();
    if (!isValidImdbId(imdbId)) {
        return null;
    }

    const title = String(value.title || "").trim().slice(0, 240);
    const yearRaw = Number(value.year);
    const year = Number.isInteger(yearRaw) ? yearRaw : null;
    const posterUrl = String(value.posterUrl || "").trim().slice(0, 1024);
    const genres = Array.isArray(value.genres)
        ? value.genres.map((genre) => String(genre || "").trim()).filter(Boolean).slice(0, 8)
        : [];
    const singleGenre = String(value.genre || "").trim();
    if (singleGenre && !genres.length) {
        genres.push(singleGenre);
    }

    return {
        imdbId,
        title: title || null,
        year,
        posterUrl: posterUrl || null,
        genres
    };
}

function getSafeStoreStatus() {
    try {
        return getStoreStatus();
    } catch (error) {
        return {
            activeStore: "unavailable",
            reason: error?.code || "unknown",
            supabaseConfigured: false
        };
    }
}

function logStartupConfiguration() {
    const storeStatus = getStoreStatus();
    console.log(JSON.stringify({
        ts: new Date().toISOString(),
        event: "startup_configuration",
        activeStore: storeStatus.activeStore,
        storeReason: storeStatus.reason,
        supabaseConfigured: storeStatus.supabaseConfigured
    }));
}

function createRequestIdMiddleware() {
    return function requestIdMiddleware(req, res, next) {
        const incoming = req.get("x-request-id");
        const requestId = typeof incoming === "string" && incoming.trim() ? incoming.trim() : createRequestId();
        req.requestId = requestId;
        res.setHeader("x-request-id", requestId);
        next();
    };
}

function createRequestLogger() {
    return function requestLogger(req, res, next) {
        const startedAt = Date.now();

        res.on("finish", () => {
            const log = {
                ts: new Date().toISOString(),
                requestId: req.requestId,
                method: req.method,
                path: req.originalUrl,
                status: res.statusCode,
                durationMs: Date.now() - startedAt,
                ip: req.ip || req.socket.remoteAddress || "unknown"
            };

            console.log(JSON.stringify(log));
        });

        next();
    };
}

function logUpstreamError(req, route, error) {
    const log = {
        ts: new Date().toISOString(),
        requestId: req.requestId,
        route,
        event: "UPSTREAM_FAILURE",
        name: error?.name || "Error",
        message: error?.message || "Unknown upstream error",
        upstream: error?.upstream || null
    };

    console.error(JSON.stringify(log));
}

function getUpstreamErrorDetails(error) {
    return {
        failureType: String(error?.upstream?.failureType || "unknown"),
        upstreamStatus: Number.isInteger(error?.upstream?.status) ? error.upstream.status : undefined
    };
}

function createRateLimiter() {
    const requestLog = new Map();

    return function rateLimit(req, res, next) {
        const now = Date.now();
        const ip = req.ip || req.socket.remoteAddress || "unknown";
        const current = requestLog.get(ip) || [];
        const recent = current.filter((ts) => now - ts < RATE_WINDOW_MS);

        if (recent.length >= RATE_MAX) {
            sendError(res, req.requestId, 429, "RATE_LIMITED", "Too many requests. Please retry in a minute.", true);
            return;
        }

        recent.push(now);
        requestLog.set(ip, recent);
        next();
    };
}

async function defaultReadinessCheck(ctx = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), READINESS_TIMEOUT_MS);

    try {
        const response = await fetch("https://imdb.iamidiotareyoutoo.com/search?q=scream", {
            signal: controller.signal,
            headers: {
                "x-request-id": ctx.requestId || "unknown"
            }
        });

        if (!response.ok) {
            const error = new Error(`Upstream response ${response.status}`);
            error.code = "UPSTREAM_HTTP_ERROR";
            error.upstream = {
                failureType: "http_error",
                status: response.status,
                url: "https://imdb.iamidiotareyoutoo.com/search?q=scream",
                timeoutMs: READINESS_TIMEOUT_MS
            };
            throw error;
        }

        return true;
    } catch (error) {
        if (!error?.upstream) {
            error.upstream = {
                failureType: error?.name === "AbortError" ? "timeout" : "network_error",
                url: "https://imdb.iamidiotareyoutoo.com/search?q=scream",
                timeoutMs: READINESS_TIMEOUT_MS
            };
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function createApp(
    services = {
        searchMovies,
        getMovieMetadata,
        getStreamingProviders,
        resolveTrailerUrl,
        getCozinessRating,
        getCozinessRatingsBatch,
        upsertCozinessRating,
        upsertMovieMetadata,
        getLeaderboard
    },
    options = {}
) {
    const app = express();
    const readinessCheck = typeof services.readinessCheck === "function" ? services.readinessCheck : defaultReadinessCheck;
    const rateLimitEnabled = options.rateLimit !== false;

    app.use(express.json());
    app.use(createRequestIdMiddleware());
    app.use(createRequestLogger());
    if (rateLimitEnabled) {
        app.use(createRateLimiter());
    }

    app.get("/api/v1/health", (req, res) => {
        res.json({
            status: "ok",
            service: "movie-fun-api",
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            cozinessStore: getSafeStoreStatus().activeStore
        });
    });

    app.get("/api/v1/readiness", async (req, res) => {
        try {
            await readinessCheck({ requestId: req.requestId });
            res.json({
                status: "ready",
                upstream: "reachable",
                timestamp: new Date().toISOString(),
                requestId: req.requestId,
                cozinessStore: getSafeStoreStatus().activeStore
            });
        } catch (error) {
            logUpstreamError(req, "/api/v1/readiness", error);
            sendError(
                res,
                req.requestId,
                503,
                "UPSTREAM_UNREADY",
                "Movie data provider is temporarily unavailable.",
                true,
                getUpstreamErrorDetails(error)
            );
        }
    });

    app.get("/api/v1/search", async (req, res) => {
        const q = String(req.query.q || "").trim();

        if (!isValidTextQuery(q)) {
            sendError(res, req.requestId, 400, "INVALID_QUERY", "Query parameter 'q' must be 1-120 characters.", false);
            return;
        }

        try {
            const data = await services.searchMovies(q, { requestId: req.requestId });
            res.json({ data, requestId: req.requestId });
        } catch (error) {
            logUpstreamError(req, "/api/v1/search", error);
            sendError(
                res,
                req.requestId,
                502,
                "UPSTREAM_FAILURE",
                "Movie search is temporarily unavailable. Please try again shortly.",
                true,
                getUpstreamErrorDetails(error)
            );
        }
    });

    app.get("/api/v1/streaming", async (req, res) => {
        const imdbId = String(req.query.imdbId || "").trim();
        const title = String(req.query.title || "").trim();
        const year = String(req.query.year || "").trim();

        const hasValidImdbId = imdbId.length === 0 || isValidImdbId(imdbId);
        const hasValidTitle = title.length === 0 || isValidTextQuery(title);
        const hasValidYear = year.length === 0 || /^\d{4}$/.test(year);

        if (!imdbId && !title) {
            sendError(res, req.requestId, 400, "INVALID_QUERY", "Provide imdbId or title.", false);
            return;
        }

        if (!hasValidImdbId) {
            sendError(res, req.requestId, 400, "INVALID_IMDB_ID", "imdbId must look like tt1234567.", false);
            return;
        }

        if (!hasValidTitle) {
            sendError(res, req.requestId, 400, "INVALID_TITLE", "title must be 1-120 characters when provided.", false);
            return;
        }

        if (!hasValidYear) {
            sendError(res, req.requestId, 400, "INVALID_YEAR", "year must be a 4-digit year when provided.", false);
            return;
        }

        try {
            const data = await services.getStreamingProviders({ imdbId, title, year }, { requestId: req.requestId });
            res.json({ data, requestId: req.requestId });
        } catch (error) {
            logUpstreamError(req, "/api/v1/streaming", error);
            sendError(res, req.requestId, 502, "UPSTREAM_FAILURE", "Failed to fetch streaming providers.", true);
        }
    });

    app.get("/api/v1/movie-metadata", async (req, res) => {
        const imdbId = String(req.query.imdbId || "").trim();
        const title = String(req.query.title || "").trim();
        const year = String(req.query.year || "").trim();

        const hasValidImdbId = imdbId.length === 0 || isValidImdbId(imdbId);
        const hasValidTitle = title.length === 0 || isValidTextQuery(title);
        const hasValidYear = year.length === 0 || /^\d{4}$/.test(year);

        if (!imdbId && !title) {
            sendError(res, req.requestId, 400, "INVALID_QUERY", "Provide imdbId or title.", false);
            return;
        }

        if (!hasValidImdbId) {
            sendError(res, req.requestId, 400, "INVALID_IMDB_ID", "imdbId must look like tt1234567.", false);
            return;
        }

        if (!hasValidTitle) {
            sendError(res, req.requestId, 400, "INVALID_TITLE", "title must be 1-120 characters when provided.", false);
            return;
        }

        if (!hasValidYear) {
            sendError(res, req.requestId, 400, "INVALID_YEAR", "year must be a 4-digit year when provided.", false);
            return;
        }

        try {
            const data = await services.getMovieMetadata({ imdbId, title, year }, { requestId: req.requestId });
            res.json({ data, requestId: req.requestId });
        } catch (error) {
            logUpstreamError(req, "/api/v1/movie-metadata", error);
            sendError(res, req.requestId, 502, "UPSTREAM_FAILURE", "Failed to fetch movie metadata.", true);
        }
    });

    app.get("/api/v1/trailer", async (req, res) => {
        const imdbId = String(req.query.imdbId || "").trim();
        const title = String(req.query.title || "").trim();

        const hasValidImdbId = imdbId.length === 0 || isValidImdbId(imdbId);
        const hasValidTitle = title.length === 0 || isValidTextQuery(title);

        if (!imdbId && !title) {
            sendError(res, req.requestId, 400, "INVALID_QUERY", "Provide imdbId or title.", false);
            return;
        }

        if (!hasValidImdbId) {
            sendError(res, req.requestId, 400, "INVALID_IMDB_ID", "imdbId must look like tt1234567.", false);
            return;
        }

        if (!hasValidTitle) {
            sendError(res, req.requestId, 400, "INVALID_TITLE", "title must be 1-120 characters when provided.", false);
            return;
        }

        try {
            const data = await services.resolveTrailerUrl({ imdbId, title }, { requestId: req.requestId });
            res.json({ data, requestId: req.requestId });
        } catch (error) {
            logUpstreamError(req, "/api/v1/trailer", error);
            sendError(res, req.requestId, 502, "UPSTREAM_FAILURE", "Failed to resolve trailer URL.", true);
        }
    });

    app.get("/api/v1/coziness", async (req, res) => {
        const imdbId = String(req.query.imdbId || "").trim();

        if (!isValidImdbId(imdbId)) {
            sendError(res, req.requestId, 400, "INVALID_IMDB_ID", "imdbId must look like tt1234567.", false);
            return;
        }

        try {
            const data = await services.getCozinessRating(imdbId, { requestId: req.requestId });
            res.json({ data, requestId: req.requestId });
        } catch (error) {
            if (error?.code === "COZINESS_NOT_CONFIGURED") {
                sendError(res, req.requestId, 503, "COZINESS_UNAVAILABLE", "Coziness service is not configured.", false);
                return;
            }
            logUpstreamError(req, "/api/v1/coziness", error);
            sendError(res, req.requestId, 502, "UPSTREAM_FAILURE", "Failed to fetch coziness rating.", true);
        }
    });

    app.post("/api/v1/coziness/batch", async (req, res) => {
        const imdbIds = Array.isArray(req.body?.imdbIds)
            ? req.body.imdbIds.map((id) => String(id || "").trim()).filter(Boolean)
            : [];

        if (!imdbIds.length || imdbIds.some((id) => !isValidImdbId(id))) {
            sendError(res, req.requestId, 400, "INVALID_IMDB_ID", "imdbIds must be an array of valid IMDb IDs.", false);
            return;
        }

        const uniqueImdbIds = [...new Set(imdbIds)];

        try {
            const data = await services.getCozinessRatingsBatch(uniqueImdbIds, { requestId: req.requestId });
            res.json({ data, requestId: req.requestId });
        } catch (error) {
            if (error?.code === "COZINESS_NOT_CONFIGURED") {
                sendError(res, req.requestId, 503, "COZINESS_UNAVAILABLE", "Coziness service is not configured.", false);
                return;
            }
            logUpstreamError(req, "/api/v1/coziness/batch", error);
            sendError(res, req.requestId, 502, "UPSTREAM_FAILURE", "Failed to fetch coziness ratings.", true);
        }
    });

    app.post("/api/v1/coziness", async (req, res) => {
        const imdbId = String(req.body?.imdbId || "").trim();
        const score = Number(req.body?.score);
        const movie = sanitizeMovieMetadata(req.body?.movie);

        if (!isValidImdbId(imdbId)) {
            sendError(res, req.requestId, 400, "INVALID_IMDB_ID", "imdbId must look like tt1234567.", false);
            return;
        }

        if (!isValidCozinessScore(score)) {
            sendError(res, req.requestId, 400, "INVALID_SCORE", "score must be an integer between 1 and 10.", false);
            return;
        }

        try {
            if (movie && typeof services.upsertMovieMetadata === "function") {
                await services.upsertMovieMetadata(movie, { requestId: req.requestId });
            }
            const data = await services.upsertCozinessRating(imdbId, score, { requestId: req.requestId });
            res.json({ data, requestId: req.requestId });
        } catch (error) {
            if (error?.code === "COZINESS_NOT_CONFIGURED") {
                sendError(res, req.requestId, 503, "COZINESS_UNAVAILABLE", "Coziness service is not configured.", false);
                return;
            }
            logUpstreamError(req, "/api/v1/coziness", error);
            sendError(res, req.requestId, 502, "UPSTREAM_FAILURE", "Failed to save coziness rating.", true);
        }
    });

    app.get("/api/v1/leaderboard", async (req, res) => {
        const genre = String(req.query.genre || "all").trim() || "all";
        const sortOrderRaw = String(req.query.sortOrder || "desc").trim().toLowerCase();
        const sortOrder = sortOrderRaw === "asc" ? "asc" : sortOrderRaw === "desc" ? "desc" : "";

        if (!sortOrder) {
            sendError(res, req.requestId, 400, "INVALID_SORT_ORDER", "sortOrder must be 'asc' or 'desc'.", false);
            return;
        }

        try {
            const data = await services.getLeaderboard({ genre, sortOrder }, { requestId: req.requestId });
            res.json({ data, requestId: req.requestId });
        } catch (error) {
            if (error?.code === "COZINESS_NOT_CONFIGURED") {
                sendError(res, req.requestId, 503, "COZINESS_UNAVAILABLE", "Coziness service is not configured.", false);
                return;
            }
            logUpstreamError(req, "/api/v1/leaderboard", error);
            sendError(res, req.requestId, 502, "UPSTREAM_FAILURE", "Failed to fetch leaderboard.", true);
        }
    });

    app.use("/styles", express.static(path.join(APP_ROOT, "styles"), { fallthrough: false }));
    app.use("/src", express.static(path.join(APP_ROOT, "src"), { fallthrough: false }));

    app.get("*", (req, res) => {
        res.sendFile(path.join(APP_ROOT, "index.html"));
    });

    return app;
}

function startServer(port = DEFAULT_PORT) {
    assertStoreConfiguration();
    logStartupConfiguration();
    const app = createApp();
    return app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });
}

if (require.main === module) {
    startServer();
}

module.exports = {
    createApp,
    startServer,
    isValidImdbId,
    isValidTextQuery
};
