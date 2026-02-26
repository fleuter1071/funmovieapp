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

test("upstream failure returns requestId and 502", async () => {
    const failingServices = {
        async readinessCheck() {
            return true;
        },
        async resolveTrailerUrl() {
            return { url: "https://www.youtube.com/results?search_query=movie+trailer", source: "youtube-fallback", imdbId: null };
        },
        async searchMovies() {
            throw new Error("upstream blew up");
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
        assert.ok(payload.error.requestId);
        assert.equal(response.headers.get("x-request-id"), payload.error.requestId);
    }, failingServices);
});

test("readiness failure returns requestId and 503", async () => {
    const failingServices = {
        async readinessCheck() {
            throw new Error("dependency down");
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
        assert.ok(payload.error.requestId);
        assert.equal(response.headers.get("x-request-id"), payload.error.requestId);
    }, failingServices);
});
