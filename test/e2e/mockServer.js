const { createApp } = require("../../server/app");

function createPosterDataUrl(title) {
    const safeTitle = String(title || "Movie").replace(/[<&>]/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="375"><rect width="100%" height="100%" fill="#111827"/><text x="50%" y="50%" fill="#fbbf24" font-size="22" text-anchor="middle" dominant-baseline="middle">${safeTitle}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createInitialState() {
    const movieMetadata = new Map([
        ["tt0117571", {
            imdbId: "tt0117571",
            title: "Scream",
            year: 1996,
            posterUrl: createPosterDataUrl("Scream"),
            genres: ["Horror"]
        }],
        ["tt0107048", {
            imdbId: "tt0107048",
            title: "Groundhog Day",
            year: 1993,
            posterUrl: createPosterDataUrl("Groundhog Day"),
            genres: ["Comedy"]
        }]
    ]);

    const ratings = new Map([
        ["tt0117571", 6],
        ["tt0107048", 8]
    ]);

    return { movieMetadata, ratings };
}

let state = createInitialState();

function resetState() {
    state = createInitialState();
}

function buildSearchResults() {
    const scream = state.movieMetadata.get("tt0117571");
    const groundhogDay = state.movieMetadata.get("tt0107048");

    return [
        {
            ...scream,
            year: String(scream.year),
            imdbRating: "7.4",
            rottenTomatoesRating: "79%"
        },
        {
            ...groundhogDay,
            year: String(groundhogDay.year),
            imdbRating: "8.0",
            rottenTomatoesRating: "94%"
        }
    ];
}

function buildProviders(imdbId) {
    if (imdbId === "tt0117571") {
        return [
            {
                name: "Netflix",
                logoUrl: "",
                movieUrl: "https://example.com/netflix/scream",
                availabilityType: "stream",
                isClickable: true
            },
            {
                name: "Apple TV Store",
                logoUrl: "",
                movieUrl: "https://example.com/apple/scream",
                availabilityType: "buy",
                isClickable: true
            }
        ];
    }

    if (imdbId === "tt0107048") {
        return [
            {
                name: "Prime Video",
                logoUrl: "",
                movieUrl: "https://example.com/prime/groundhog-day",
                availabilityType: "rent",
                isClickable: true
            }
        ];
    }

    return [];
}

function createServices() {
    const port = Number(process.env.PORT || 3200);
    const baseUrl = `http://127.0.0.1:${port}`;

    return {
        async readinessCheck() {
            return true;
        },
        async searchMovies() {
            return buildSearchResults();
        },
        async resolveTrailerUrl({ imdbId, title }) {
            return {
                url: `${baseUrl}/__e2e/trailer/${encodeURIComponent(imdbId || title || "movie")}`,
                source: "mock-trailer",
                imdbId: imdbId || null
            };
        },
        async getStreamingProviders({ imdbId }) {
            return {
                imdbId,
                providers: buildProviders(imdbId),
                region: "US",
                lastUpdated: "2026-04-03T00:00:00.000Z"
            };
        },
        async getCozinessRating(imdbId) {
            if (!state.ratings.has(imdbId)) {
                return null;
            }
            return {
                imdbId,
                score: state.ratings.get(imdbId),
                updatedAt: "2026-04-03T00:00:00.000Z"
            };
        },
        async getCozinessRatingsBatch(imdbIds) {
            const result = {};
            imdbIds.forEach((imdbId) => {
                if (state.ratings.has(imdbId)) {
                    result[imdbId] = {
                        imdbId,
                        score: state.ratings.get(imdbId),
                        updatedAt: "2026-04-03T00:00:00.000Z"
                    };
                }
            });
            return result;
        },
        async upsertCozinessRating(imdbId, score) {
            state.ratings.set(imdbId, score);
            return {
                imdbId,
                score,
                updatedAt: "2026-04-03T00:00:00.000Z"
            };
        },
        async upsertMovieMetadata(movie) {
            if (!movie?.imdbId) {
                return null;
            }

            const existing = state.movieMetadata.get(movie.imdbId) || {};
            state.movieMetadata.set(movie.imdbId, {
                ...existing,
                imdbId: movie.imdbId,
                title: movie.title || existing.title || movie.imdbId,
                year: movie.year || existing.year || null,
                posterUrl: movie.posterUrl || existing.posterUrl || createPosterDataUrl(movie.title || movie.imdbId),
                genres: Array.isArray(movie.genres) && movie.genres.length ? movie.genres : (existing.genres || [])
            });

            return state.movieMetadata.get(movie.imdbId);
        },
        async getLeaderboard({ genre, sortOrder }) {
            const availableGenres = [...new Set(
                [...state.movieMetadata.values()]
                    .flatMap((movie) => Array.isArray(movie.genres) ? movie.genres : [])
                    .filter(Boolean)
            )].sort((a, b) => a.localeCompare(b));

            const items = [...state.ratings.entries()]
                .map(([imdbId, score]) => {
                    const movie = state.movieMetadata.get(imdbId) || {};
                    const primaryGenre = Array.isArray(movie.genres) && movie.genres.length ? movie.genres[0] : "Uncategorized";
                    return {
                        imdbId,
                        title: movie.title || imdbId,
                        year: movie.year || null,
                        posterUrl: movie.posterUrl || "",
                        genre: primaryGenre,
                        score
                    };
                })
                .filter((item) => genre === "all" || item.genre === genre)
                .sort((a, b) => {
                    if (sortOrder === "asc") {
                        return a.score - b.score || a.title.localeCompare(b.title);
                    }
                    return b.score - a.score || a.title.localeCompare(b.title);
                })
                .map((item, index) => ({ ...item, rank: index + 1 }));

            return { items, availableGenres };
        }
    };
}

const app = createApp(createServices());

app.post("/__e2e/reset", (_req, res) => {
    resetState();
    res.json({ ok: true });
});

app.get("/__e2e/trailer/:id", (req, res) => {
    res.type("html").send(`<!DOCTYPE html><html lang="en"><body><h1>Trailer Mock ${req.params.id}</h1></body></html>`);
});

const port = Number(process.env.PORT || 3200);
app.listen(port, () => {
    console.log(`Mock E2E server running on http://127.0.0.1:${port}`);
});
