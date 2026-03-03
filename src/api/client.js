import { API_BASE, REQUEST_TIMEOUT_MS } from "../config.js";

async function fetchJson(path, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            signal: controller.signal
        });

        const payload = await response.json();

        if (!response.ok) {
            const message = payload?.error?.message || "Request failed";
            throw new Error(message);
        }

        return payload;
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function searchMovies(query) {
    return fetchJson(`/search?q=${encodeURIComponent(query)}`);
}

export async function getStreamingInfo(imdbId, title) {
    return fetchJson(`/streaming?imdbId=${encodeURIComponent(imdbId)}&title=${encodeURIComponent(title)}`);
}

export async function getTrailerInfo(imdbId, title) {
    return fetchJson(`/trailer?imdbId=${encodeURIComponent(imdbId)}&title=${encodeURIComponent(title)}`);
}

export async function getCozinessRatingsBatch(imdbIds) {
    return fetchJson("/coziness/batch", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ imdbIds })
    });
}

export async function saveCozinessRating(imdbId, score, movie = null) {
    return fetchJson("/coziness", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ imdbId, score, movie })
    });
}

export async function getLeaderboard(genre = "all", sortOrder = "desc") {
    const params = new URLSearchParams({
        genre,
        sortOrder
    });
    return fetchJson(`/leaderboard?${params.toString()}`);
}
