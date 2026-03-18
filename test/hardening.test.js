const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createServer } = require("node:http");
const { createApp } = require("../server/app");
const { assertStoreConfiguration, getStoreStatus } = require("../server/services/cozinessStore");

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
        async getStreamingProviders() {
            return {
                imdbId: "tt0117571",
                providers: [],
                region: "US",
                lastUpdated: "2026-03-18T00:00:00.000Z"
            };
        },
        async getCozinessRating() {
            return null;
        },
        async getCozinessRatingsBatch() {
            return {};
        },
        async upsertCozinessRating(imdbId, score) {
            return { imdbId, score, updatedAt: "2026-03-18T00:00:00.000Z" };
        },
        async getLeaderboard() {
            return { items: [], availableGenres: [] };
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

function withEnv(overrides, run) {
    const previous = new Map();
    for (const [key, value] of Object.entries(overrides)) {
        previous.set(key, process.env[key]);
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    try {
        return run();
    } finally {
        for (const [key, value] of previous.entries()) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

test("internal project files are not served as static assets", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/PROJECT_MEMORY.md`);
        assert.equal(response.status, 200);

        const body = await response.text();
        assert.match(body, /<!DOCTYPE html>/i);
        assert.doesNotMatch(body, /## Date\/time/);
    });
});

test("health includes active coziness store", async () => {
    await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/health`);
        assert.equal(response.status, 200);

        const payload = await response.json();
        assert.equal(payload.cozinessStore, getStoreStatus().activeStore);
    });
});

test("supabase override without required env fails store validation", () => {
    withEnv({
        COZINESS_STORE: "supabase",
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        NODE_ENV: "production"
    }, () => {
        assert.throws(() => assertStoreConfiguration(), /Supabase env vars are missing/);
    });
});

test("sqlite override remains valid without Supabase env", () => {
    withEnv({
        COZINESS_STORE: "sqlite",
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        NODE_ENV: "production"
    }, () => {
        assert.doesNotThrow(() => assertStoreConfiguration());
        assert.equal(getStoreStatus().activeStore, "sqlite");
    });
});
