const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createServer } = require("node:http");
const { createApp } = require("../server/app");

function createMockServices() {
    return {
        async readinessCheck() {
            return true;
        },
        async resolveTrailerUrl({ imdbId, title }) {
            return {
                url: imdbId ? `https://imdb.iamidiotareyoutoo.com/media/${imdbId}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} trailer`)}`,
                source: imdbId ? "free-movie-db" : "youtube-fallback",
                imdbId: imdbId || null
            };
        },
        async searchMovies(query) {
            return [{ imdbId: "tt0117571", title: query, year: "1996", posterUrl: "" }];
        },
        async getStreamingProviders({ imdbId, title }) {
            return {
                imdbId: imdbId || "tt0117571",
                providers: ["Netflix", "Hulu"],
                region: "US",
                lastUpdated: "2026-02-25T00:00:00.000Z",
                title
            };
        },
        async getCozinessRating(imdbId) {
            if (imdbId === "tt0117571") {
                return { imdbId, score: 7, updatedAt: "2026-03-02T00:00:00.000Z" };
            }
            return null;
        },
        async getCozinessRatingsBatch(imdbIds) {
            const map = {};
            for (const imdbId of imdbIds) {
                if (imdbId === "tt0117571") {
                    map[imdbId] = { imdbId, score: 7, updatedAt: "2026-03-02T00:00:00.000Z" };
                }
            }
            return map;
        },
        async upsertCozinessRating(imdbId, score) {
            return { imdbId, score, updatedAt: "2026-03-02T00:00:00.000Z" };
        },
        async getLeaderboard({ genre, sortOrder }) {
            return {
                items: [
                    {
                        rank: 1,
                        imdbId: "tt0117571",
                        title: "Scream",
                        year: 1996,
                        posterUrl: "",
                        genre: genre === "all" ? "Horror" : genre,
                        score: sortOrder === "asc" ? 2 : 9
                    }
                ],
                availableGenres: ["Horror", "Comedy"]
            };
        }
    };
}

async function withServer(run, services = createMockServices()) {
    const app = createApp(services);
    const server = createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
        await run(baseUrl);
    } finally {
        server.close();
        await once(server, "close");
    }
}

test("GET /api/v1/health returns health payload", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/health`);
        assert.equal(response.status, 200);

        const payload = await response.json();
        assert.equal(payload.status, "ok");
        assert.equal(payload.service, "movie-fun-api");
        assert.ok(typeof payload.uptimeSeconds === "number");
        assert.ok(payload.requestId);
        assert.equal(response.headers.get("x-request-id"), payload.requestId);
    });
});

test("GET /api/v1/readiness returns ready when upstream check passes", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/readiness`);
        assert.equal(response.status, 200);

        const payload = await response.json();
        assert.equal(payload.status, "ready");
        assert.equal(payload.upstream, "reachable");
        assert.ok(payload.requestId);
    });
});

test("GET /api/v1/search returns normalized data", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/search?q=scream`);
        assert.equal(response.status, 200);

        const payload = await response.json();
        assert.ok(Array.isArray(payload.data));
        assert.equal(payload.data[0].imdbId, "tt0117571");
        assert.ok(payload.requestId);
        assert.equal(response.headers.get("x-request-id"), payload.requestId);
    });
});

test("GET /api/v1/search validates query", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/search?q=`);
        assert.equal(response.status, 400);

        const payload = await response.json();
        assert.equal(payload.error.code, "INVALID_QUERY");
        assert.ok(payload.error.requestId);
        assert.equal(response.headers.get("x-request-id"), payload.error.requestId);
    });
});

test("GET /api/v1/streaming accepts imdbId and returns providers", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/streaming?imdbId=tt0117571`);
        assert.equal(response.status, 200);

        const payload = await response.json();
        assert.deepEqual(payload.data.providers, ["Netflix", "Hulu"]);
    });
});

test("GET /api/v1/streaming validates imdbId format", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/streaming?imdbId=bad-id`);
        assert.equal(response.status, 400);

        const payload = await response.json();
        assert.equal(payload.error.code, "INVALID_IMDB_ID");
        assert.ok(payload.error.requestId);
    });
});

test("GET /api/v1/trailer prefers free movie db URL when imdbId is valid", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/trailer?imdbId=tt0117571&title=scream`);
        assert.equal(response.status, 200);

        const payload = await response.json();
        assert.equal(payload.data.source, "free-movie-db");
        assert.ok(payload.data.url.includes("/media/tt0117571"));
    });
});

test("GET /api/v1/trailer validates imdbId format", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/trailer?imdbId=bad-id&title=scream`);
        assert.equal(response.status, 400);

        const payload = await response.json();
        assert.equal(payload.error.code, "INVALID_IMDB_ID");
    });
});

test("GET /api/v1/coziness returns rating when present", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/coziness?imdbId=tt0117571`);
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.data.imdbId, "tt0117571");
        assert.equal(payload.data.score, 7);
    });
});

test("POST /api/v1/coziness/batch returns map for valid ids", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/coziness/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imdbIds: ["tt0117571", "tt0133093"] })
        });
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.data.tt0117571.score, 7);
        assert.equal(payload.data.tt0133093, undefined);
    });
});

test("POST /api/v1/coziness validates score range", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/coziness`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imdbId: "tt0117571", score: 11 })
        });
        assert.equal(response.status, 400);
        const payload = await response.json();
        assert.equal(payload.error.code, "INVALID_SCORE");
    });
});

test("POST /api/v1/coziness upserts valid payload", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/coziness`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imdbId: "tt0117571", score: 9 })
        });
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.data.imdbId, "tt0117571");
        assert.equal(payload.data.score, 9);
    });
});

test("GET /api/v1/leaderboard returns ranked list payload", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/leaderboard?genre=all&sortOrder=desc`);
        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.data.items[0].imdbId, "tt0117571");
        assert.equal(payload.data.items[0].rank, 1);
        assert.deepEqual(payload.data.availableGenres, ["Horror", "Comedy"]);
    });
});

test("GET /api/v1/leaderboard validates sort order", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/leaderboard?genre=all&sortOrder=sideways`);
        assert.equal(response.status, 400);
        const payload = await response.json();
        assert.equal(payload.error.code, "INVALID_SORT_ORDER");
    });
});

test("upstream failure returns requestId and 502", async () => {
    const failingServices = {
        async readinessCheck() {
            return true;
        },
        async resolveTrailerUrl() {
            return { url: "https://www.youtube.com/results?search_query=movie+trailer", source: "youtube-fallback", imdbId: null };
        },
        async searchMovies() {
            const error = new Error("upstream blew up");
            error.upstream = {
                failureType: "timeout"
            };
            throw error;
        },
        async getStreamingProviders() {
            return { providers: [] };
        }
    };

    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/search?q=scream`);
        assert.equal(response.status, 502);

        const payload = await response.json();
        assert.equal(payload.error.code, "UPSTREAM_FAILURE");
        assert.equal(payload.error.message, "Movie search is temporarily unavailable. Please try again shortly.");
        assert.equal(payload.error.details.failureType, "timeout");
        assert.ok(payload.error.requestId);
        assert.equal(response.headers.get("x-request-id"), payload.error.requestId);
    }, failingServices);
});

test("readiness failure returns requestId and 503", async () => {
    const failingServices = {
        async readinessCheck() {
            const error = new Error("dependency down");
            error.upstream = {
                failureType: "http_error",
                status: 503
            };
            throw error;
        },
        async resolveTrailerUrl() {
            return { url: "https://www.youtube.com/results?search_query=movie+trailer", source: "youtube-fallback", imdbId: null };
        },
        async searchMovies() {
            return [];
        },
        async getStreamingProviders() {
            return { providers: [] };
        }
    };

    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/readiness`);
        assert.equal(response.status, 503);

        const payload = await response.json();
        assert.equal(payload.error.code, "UPSTREAM_UNREADY");
        assert.equal(payload.error.message, "Movie data provider is temporarily unavailable.");
        assert.equal(payload.error.details.failureType, "http_error");
        assert.equal(payload.error.details.upstreamStatus, 503);
        assert.ok(payload.error.requestId);
        assert.equal(response.headers.get("x-request-id"), payload.error.requestId);
    }, failingServices);
});
