import { getStreamingInfo, getTrailerInfo, searchMovies } from "./api/client.js";
import {
    renderLoadingSkeletons,
    renderMovies,
    renderStatus,
    renderStreamingProviders,
    renderStreamingStatus
} from "./ui/renderers.js";

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const results = document.getElementById("results");
const resultsMeta = document.getElementById("resultsMeta");
const buttonResetTimers = new WeakMap();

function setResultsMeta(message) {
    if (resultsMeta) {
        resultsMeta.textContent = message;
    }
}

function setSearchPending(isPending) {
    searchButton.disabled = isPending;
    searchButton.textContent = isPending ? "Searching..." : "Search";
    results.setAttribute("aria-busy", isPending ? "true" : "false");
}

async function handleSearch() {
    const query = searchInput.value.trim();

    if (!query) {
        setResultsMeta("Add a title to start your search.");
        renderStatus(results, "Enter a movie title to search.", "empty");
        return;
    }

    setSearchPending(true);
    setResultsMeta(`Searching for "${query}"...`);
    renderLoadingSkeletons(results, 6);

    try {
        const payload = await searchMovies(query);
        const movies = payload?.data || [];

        if (!movies.length) {
            setResultsMeta("No matches found.");
            renderStatus(results, "No movies found. Try another title.", "empty");
            return;
        }

        setResultsMeta(`${movies.length} result${movies.length === 1 ? "" : "s"} found.`);
        renderMovies(results, movies);
    } catch (error) {
        setResultsMeta("Search unavailable.");
        renderStatus(results, "We could not reach the movie service. Please try again.", "error");
    } finally {
        setSearchPending(false);
    }
}

async function openTrailer(imdbId, title) {
    const popup = window.open("about:blank", "_blank");

    if (!popup) {
        const query = `${title || "movie"} trailer`;
        window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        return;
    }

    try {
        popup.opener = null;
    } catch (error) {
        // Ignore if browser prevents setting opener.
    }

    try {
        const payload = await getTrailerInfo(imdbId, title);
        const url = payload?.data?.url;

        if (url) {
            popup.location.replace(url);
            return;
        }
    } catch (error) {
        // Fall through to local YouTube fallback.
    }

    const query = `${title || "movie"} trailer`;
    popup.location.replace(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
}

async function handleStreaming(card, button) {
    const imdbId = card.dataset.imdbId || "";
    const title = card.dataset.title || "";
    const dataBox = card.querySelector(".data-box");
    const summary = card.querySelector(".movie-streaming-summary");

    if (!dataBox || !button) {
        return;
    }

    button.disabled = true;
    const previousLabel = button.textContent;
    button.textContent = "Checking...";
    renderStreamingStatus(dataBox, "Locating US streaming rights...");

    try {
        const payload = await getStreamingInfo(imdbId, title);
        const providers = payload?.data?.providers || [];
        renderStreamingProviders(dataBox, providers);

        if (summary) {
            const normalized = providers.map((provider) => {
                if (typeof provider === "string") {
                    return { name: provider, availabilityType: "stream" };
                }
                return provider;
            });

            const subscriptionLike = normalized.find((provider) => provider.availabilityType === "stream" || provider.availabilityType === "free");
            if (subscriptionLike?.name) {
                summary.textContent = `Popular on: ${subscriptionLike.name}`;
            } else if (normalized[0]?.name) {
                const type = normalized[0].availabilityType || "stream";
                summary.textContent = `Available to ${type} on ${normalized[0].name}`;
            } else {
                summary.textContent = "No major subscription platforms right now";
            }
        }

        button.textContent = "Updated";
    } catch (error) {
        renderStreamingStatus(dataBox, "Unable to pull streaming data right now.");
        if (summary) {
            summary.textContent = "Availability check failed - try again";
        }
        button.textContent = "Try Again";
    } finally {
        button.disabled = false;

        const existingTimer = buttonResetTimers.get(button);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timerId = setTimeout(() => {
            if (button.isConnected) {
                button.textContent = previousLabel;
            }
        }, 1500);
        buttonResetTimers.set(button, timerId);
    }
}

searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSearch();
});

results.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) {
        return;
    }

    const card = button.closest(".movie-card");

    if (!card) {
        return;
    }

    const action = button.dataset.action;

    if (action === "trailer") {
        openTrailer(card.dataset.imdbId || "", card.dataset.title || "");
        return;
    }

    if (action === "streaming") {
        handleStreaming(card, button);
    }
});
