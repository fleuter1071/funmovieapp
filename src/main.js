import { getCozinessRatingsBatch, getLeaderboard, getMovieMetadata, getStreamingInfo, getTrailerInfo, saveCozinessRating, searchMovies } from "./api/client.js";
import { createDiscoverServicesController } from "./features/discoverServices.mjs";
import { parseImdbRatingsCsv } from "./features/imdbImport.mjs";
import {
    getCurrentQueueMovie,
    getQueueSummary,
    markImportedMovieRated,
    markImportedMovieSkipped,
    replaceImportBatch,
    restoreSkippedMovies,
    updateImportedMovieMetadata
} from "./features/importStorage.mjs";
import { getMatchingServiceLabels } from "./features/myServices.mjs";
import {
    renderCozyQueueCompletion,
    renderCozyQueueState,
    renderQueueImportPreview,
    renderQueueImportPrompt,
    renderLeaderboard,
    renderLoadingSkeletons,
    renderMovies,
    renderStatus,
    renderStreamingProviders,
    renderStreamingStatus,
    updateCardCoziness
} from "./ui/renderers.js";

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const results = document.getElementById("results");
const resultsHead = document.getElementById("resultsHead");
const resultsMeta = document.getElementById("resultsMeta");
const discoverFilterState = document.getElementById("discoverFilterState");
const tabButtons = [...document.querySelectorAll("[data-tab]")];
const searchView = document.getElementById("searchView");
const cozyQueueView = document.getElementById("cozyQueueView");
const cozyQueueContent = document.getElementById("cozyQueueContent");
const leaderboardView = document.getElementById("leaderboardView");
const leaderboardResults = document.getElementById("leaderboardResults");
const leaderboardMeta = document.getElementById("leaderboardMeta");
const leaderboardGenre = document.getElementById("leaderboardGenre");
const leaderboardSort = document.getElementById("leaderboardSort");
const openQueueButton = document.getElementById("openQueueButton");
const queueLauncherMeta = document.getElementById("queueLauncherMeta");
const imdbImportInput = document.getElementById("imdbImportInput");
const myServicesButton = document.getElementById("myServicesButton");
const includedOnlyWrap = document.getElementById("includedOnlyWrap");
const includedOnlyInput = document.getElementById("includedOnlyInput");
const servicesSheet = document.getElementById("servicesSheet");
const servicesSheetBackdrop = document.getElementById("servicesSheetBackdrop");
const servicesSheetClose = document.getElementById("servicesSheetClose");
const servicesOptions = document.getElementById("servicesOptions");
const servicesDoneButton = document.getElementById("servicesDoneButton");
const servicesClearButton = document.getElementById("servicesClearButton");
const cozyAutoCloseTimers = new WeakMap();

const leaderboardState = {
    genre: "all",
    sortOrder: "desc"
};

const queueUiState = {
    preview: null,
    selectedScore: null,
    feedbackMessage: "",
    feedbackTone: "",
    isSaving: false,
    metadataLoading: false,
    flashMessage: "",
    flashTone: "",
    reviewingSkipped: false,
    reviewTotal: 0
};

const discoverServices = createDiscoverServicesController({
    results,
    filterState: discoverFilterState,
    setResultsMeta,
    myServicesButton,
    includedOnlyWrap,
    includedOnlyInput,
    sheet: servicesSheet,
    backdrop: servicesSheetBackdrop,
    closeButton: servicesSheetClose,
    servicesOptions,
    doneButton: servicesDoneButton,
    clearButton: servicesClearButton
});

function trackEvent(name, params = {}) {
    if (typeof window.gtag !== "function") {
        return;
    }
    window.gtag("event", name, params);
}

function setResultsMeta(message) {
    if (resultsMeta) {
        resultsMeta.textContent = message;
    }
}

function setResultsHeadVisible(isVisible) {
    if (resultsHead) {
        resultsHead.hidden = !isVisible;
    }
}

function setQueueFlash(message = "", tone = "") {
    queueUiState.flashMessage = message;
    queueUiState.flashTone = tone;
}

function clearQueueFlash() {
    setQueueFlash("", "");
}

function setSearchPending(isPending) {
    searchButton.disabled = isPending;
    searchButton.textContent = isPending ? "Searching..." : "Search";
    results.setAttribute("aria-busy", isPending ? "true" : "false");
}

function setLeaderboardPending(isPending) {
    if (leaderboardSort) {
        leaderboardSort.disabled = isPending;
    }
    if (leaderboardGenre) {
        leaderboardGenre.disabled = isPending;
    }
}

function setLeaderboardMeta(message) {
    if (leaderboardMeta) {
        leaderboardMeta.textContent = message;
    }
}

function setActiveView(view) {
    const next = view === "leaderboard"
        ? "leaderboard"
        : view === "queue"
            ? "queue"
            : "discover";

    if (searchView) {
        searchView.hidden = next !== "discover";
    }
    if (cozyQueueView) {
        cozyQueueView.hidden = next !== "queue";
    }
    if (leaderboardView) {
        leaderboardView.hidden = next !== "leaderboard";
    }

    tabButtons.forEach((tab) => {
        const isActive = tab.dataset.tab === next;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    if (next === "leaderboard") {
        loadLeaderboard();
    } else if (next === "queue") {
        renderQueueView();
    }
}

function updateQueueLauncher() {
    const summary = getQueueSummary();
    if (!openQueueButton || !queueLauncherMeta) {
        return;
    }

    if (!summary.batch) {
        openQueueButton.textContent = "Open Cozy Queue";
        queueLauncherMeta.textContent = "Upload your IMDb ratings and rate familiar movies for coziness one at a time. Saved locally on this device for now.";
        return;
    }

    openQueueButton.textContent = summary.remainingCount > 0 ? "Continue Cozy Queue" : "Open Cozy Queue";
    queueLauncherMeta.textContent = `${summary.ratedCount} rated, ${summary.skippedCount} skipped, ${summary.remainingCount} left. Saved locally on this device for now.`;
}

function injectQueueFlashMessage() {
    if (!cozyQueueContent || !queueUiState.flashMessage) {
        return;
    }

    const flash = document.createElement("p");
    flash.className = `message${queueUiState.flashTone ? ` is-${queueUiState.flashTone}` : ""}`;
    flash.textContent = queueUiState.flashMessage;
    cozyQueueContent.prepend(flash);
}

function renderQueueView() {
    if (!cozyQueueContent) {
        return;
    }

    const summary = getQueueSummary();

    if (queueUiState.preview) {
        renderQueueImportPreview(cozyQueueContent, {
            fileName: queueUiState.preview.sourceName,
            summary: queueUiState.preview.summary,
            hasExistingBatch: Boolean(summary.batch)
        });
        injectQueueFlashMessage();
        return;
    }

    if (!summary.batch) {
        renderQueueImportPrompt(cozyQueueContent, { hasExistingBatch: false });
        injectQueueFlashMessage();
        return;
    }

    if (summary.remainingCount === 0) {
        renderCozyQueueCompletion(cozyQueueContent, summary);
        injectQueueFlashMessage();
        return;
    }

    const currentMovie = getCurrentQueueMovie();
    renderCozyQueueState(cozyQueueContent, {
        movie: currentMovie,
        selectedScore: queueUiState.selectedScore,
        ratedCount: summary.ratedCount,
        skippedCount: summary.skippedCount,
        remainingCount: summary.remainingCount,
        totalCount: summary.totalCount,
        isReviewingSkipped: queueUiState.reviewingSkipped,
        reviewTotal: queueUiState.reviewTotal,
        feedbackMessage: queueUiState.feedbackMessage,
        feedbackTone: queueUiState.feedbackTone,
        isSaving: queueUiState.isSaving || queueUiState.metadataLoading
    });
    injectQueueFlashMessage();

    if (currentMovie && !String(currentMovie.posterUrl || "").trim()) {
        hydrateQueueMovieMetadata(currentMovie);
    }
}

function openImportPicker() {
    if (!imdbImportInput) {
        return;
    }
    imdbImportInput.value = "";
    imdbImportInput.click();
}

async function handleImportFileSelection(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    clearQueueFlash();
    queueUiState.feedbackMessage = "";
    queueUiState.feedbackTone = "";

    try {
        const text = await file.text();
        queueUiState.preview = parseImdbRatingsCsv(text, { sourceName: file.name });
        queueUiState.selectedScore = null;
        setActiveView("queue");
    } catch (error) {
        queueUiState.preview = null;
        setQueueFlash(error.message || "This IMDb file could not be imported.", "error");
        setActiveView("queue");
    }
}

function updateVisibleCardScore(imdbId, score) {
    const card = results.querySelector(`.movie-card[data-imdb-id="${CSS.escape(imdbId)}"]`);
    if (!card) {
        return;
    }
    updateCardCoziness(card, score);
}

async function persistQueueRating() {
    const movie = getCurrentQueueMovie();
    const score = Number(queueUiState.selectedScore);
    if (!movie?.imdbId || !Number.isInteger(score) || score < 1 || score > 10 || queueUiState.isSaving) {
        return;
    }

    clearQueueFlash();
    queueUiState.isSaving = true;
    queueUiState.feedbackMessage = "Saving...";
    queueUiState.feedbackTone = "";
    renderQueueView();

    try {
        const payload = await saveCozinessRating(movie.imdbId, score, {
            imdbId: movie.imdbId,
            title: movie.title,
            year: movie.year,
            genres: movie.genres
        });
        const savedScore = Number(payload?.data?.score);
        const nextScore = Number.isInteger(savedScore) ? savedScore : score;
        markImportedMovieRated(movie.imdbId, nextScore);
        updateVisibleCardScore(movie.imdbId, nextScore);
        queueUiState.selectedScore = null;
        queueUiState.feedbackMessage = "Saved. Next movie loaded.";
        queueUiState.feedbackTone = "success";
        updateQueueLauncher();
    } catch (error) {
        queueUiState.feedbackMessage = "Could not save this cozy score. Try again.";
        queueUiState.feedbackTone = "error";
    } finally {
        queueUiState.isSaving = false;
        renderQueueView();
    }
}

async function hydrateQueueMovieMetadata(movie) {
    if (!movie?.imdbId || queueUiState.metadataLoading) {
        return;
    }

    queueUiState.metadataLoading = true;
    renderQueueView();

    try {
        const payload = await getMovieMetadata(movie.imdbId, movie.title, movie.year ? String(movie.year) : "");
        const data = payload?.data;
        if (data?.imdbId) {
            updateImportedMovieMetadata(movie.imdbId, data);
        }
    } catch (error) {
        // Keep the queue usable even if metadata hydration fails.
    } finally {
        queueUiState.metadataLoading = false;
        renderQueueView();
    }
}

function parseCardGenres(card) {
    try {
        const parsed = JSON.parse(card.dataset.genres || "[]");
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
        return [];
    }
}

function getCardMovieMetadata(card) {
    const yearValue = Number(card.dataset.year);
    return {
        imdbId: String(card.dataset.imdbId || "").trim(),
        title: String(card.dataset.title || "").trim(),
        year: Number.isInteger(yearValue) && yearValue > 1800 ? yearValue : null,
        posterUrl: String(card.dataset.posterUrl || "").trim(),
        genres: parseCardGenres(card)
    };
}

function applyGenreOptions(availableGenres = []) {
    if (!leaderboardGenre) {
        return;
    }

    const previous = leaderboardState.genre || "all";
    leaderboardGenre.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "Genre: All";
    leaderboardGenre.appendChild(allOption);

    availableGenres.forEach((genre) => {
        const option = document.createElement("option");
        option.value = genre;
        option.textContent = `Genre: ${genre}`;
        leaderboardGenre.appendChild(option);
    });

    const nextValue = [...leaderboardGenre.options].some((opt) => opt.value === previous) ? previous : "all";
    leaderboardState.genre = nextValue;
    leaderboardGenre.value = nextValue;
}

async function loadLeaderboard() {
    if (!leaderboardResults) {
        return;
    }

    setLeaderboardPending(true);
    setLeaderboardMeta("Loading leaderboard...");
    renderLoadingSkeletons(leaderboardResults, 5);

    try {
        const payload = await getLeaderboard(leaderboardState.genre, leaderboardState.sortOrder);
        const data = payload?.data || { items: [], availableGenres: [] };
        applyGenreOptions(Array.isArray(data.availableGenres) ? data.availableGenres : []);
        const items = Array.isArray(data.items) ? data.items : [];
        renderLeaderboard(leaderboardResults, { items });
        setLeaderboardMeta(`${items.length} ranked movie${items.length === 1 ? "" : "s"}.`);
    } catch (error) {
        renderStatus(leaderboardResults, "Leaderboard is unavailable right now.", "error");
        setLeaderboardMeta("Could not load leaderboard.");
    } finally {
        setLeaderboardPending(false);
    }
}

function closeCozinessPanel(card) {
    const cozyBox = card.querySelector(".coziness-box");
    const cozyToggleBtn = card.querySelector(".cozy-btn");

    if (!cozyBox || !cozyToggleBtn) {
        return;
    }

    cozyBox.classList.remove("visible");
    cozyToggleBtn.setAttribute("aria-expanded", "false");
    const score = Number(card.dataset.cozinessScore);
    updateCardCoziness(card, Number.isInteger(score) ? score : null);
}

function clearCozinessAutoClose(card) {
    const timerId = cozyAutoCloseTimers.get(card);
    if (timerId) {
        clearTimeout(timerId);
        cozyAutoCloseTimers.delete(card);
    }
}

function scheduleCozinessAutoClose(card, delayMs = 550) {
    clearCozinessAutoClose(card);
    const timerId = setTimeout(() => {
        cozyAutoCloseTimers.delete(card);
        if (!card.isConnected) {
            return;
        }
        if (card.dataset.cozinessSaving === "1") {
            return;
        }
        closeCozinessPanel(card);
    }, delayMs);
    cozyAutoCloseTimers.set(card, timerId);
}

function closeStreamingPanel(card) {
    const dataBox = card.querySelector(".data-box");
    const streamBtn = card.querySelector('button[data-action="streaming"]');
    if (dataBox) {
        dataBox.classList.remove("visible");
    }
    if (streamBtn) {
        streamBtn.setAttribute("aria-expanded", "false");
        streamBtn.textContent = "Where to Watch";
    }
}

function openCozinessPanel(card) {
    results.querySelectorAll(".movie-card").forEach((candidate) => {
        if (candidate !== card) {
            closeCozinessPanel(candidate);
        }
        closeStreamingPanel(candidate);
    });

    const cozyBox = card.querySelector(".coziness-box");
    const cozyToggleBtn = card.querySelector(".cozy-btn");

    if (!cozyBox || !cozyToggleBtn) {
        return;
    }

    cozyBox.classList.add("visible");
    cozyToggleBtn.setAttribute("aria-expanded", "true");
    const score = Number(card.dataset.cozinessScore);
    updateCardCoziness(card, Number.isInteger(score) ? score : null);
    clearCozinessAutoClose(card);
    setCozinessFeedback(card, "");
}

function applySelectedCozinessChip(card, score, options = {}) {
    const isEditable = options.isEditable !== false;
    const chips = card.querySelectorAll(".cozy-chip");
    const selectedText = card.querySelector(".coziness-selected");
    const saveBtn = card.querySelector(".coziness-save-btn");

    chips.forEach((chip) => {
        const isSelected = Number(chip.dataset.score) === score;
        chip.classList.toggle("is-selected", isSelected);
        chip.setAttribute("aria-checked", isSelected ? "true" : "false");
    });

    if (Number.isInteger(score)) {
        clearCozinessAutoClose(card);
        if (isEditable) {
            card.dataset.pendingCozinessScore = String(score);
        } else {
            delete card.dataset.pendingCozinessScore;
        }
        if (selectedText) {
            selectedText.textContent = isEditable ? `Selected: ${score}/10` : `Current: ${score}/10`;
        }
        if (saveBtn) {
            saveBtn.disabled = !isEditable;
        }
    } else {
        delete card.dataset.pendingCozinessScore;
        if (selectedText) {
            selectedText.textContent = "Select a score";
        }
        if (saveBtn) {
            saveBtn.disabled = true;
        }
    }
}

function setCozinessFeedback(card, message = "", tone = "") {
    const feedback = card.querySelector(".coziness-feedback");
    if (!feedback) {
        return;
    }
    feedback.textContent = message;
    feedback.classList.remove("is-error", "is-success", "is-saving");
    if (tone) {
        feedback.classList.add(`is-${tone}`);
    }
}

function persistCozinessSelection(card) {
    const imdbId = String(card.dataset.imdbId || "").trim();
    const score = Number(card.dataset.pendingCozinessScore);
    if (!imdbId || !Number.isInteger(score) || score < 1 || score > 10) {
        return;
    }
    if (card.dataset.cozinessSaving === "1") {
        return;
    }
    const existingScore = Number(card.dataset.cozinessScore);
    const previousScore = Number.isInteger(existingScore) && existingScore >= 1 && existingScore <= 10
        ? existingScore
        : null;

    card.dataset.cozinessSaving = "1";
    setCozinessFeedback(card, "Saving...", "saving");
    const saveBtn = card.querySelector(".coziness-save-btn");
    if (saveBtn) {
        saveBtn.disabled = true;
    }

    saveCozinessRating(imdbId, score, getCardMovieMetadata(card))
        .then((payload) => {
            const savedScore = Number(payload?.data?.score);
            const nextScore = Number.isInteger(savedScore) && savedScore >= 1 && savedScore <= 10 ? savedScore : score;
            updateCardCoziness(card, nextScore);
            applySelectedCozinessChip(card, nextScore, { isEditable: false });
            setCozinessFeedback(card, "Saved", "success");
            scheduleCozinessAutoClose(card);

            trackEvent("coziness_saved", {
                movie_title: card.dataset.title || "",
                imdb_id: imdbId,
                score: nextScore
            });
        })
        .catch(() => {
            updateCardCoziness(card, previousScore);
            applySelectedCozinessChip(card, previousScore, { isEditable: false });
            setCozinessFeedback(card, "Could not save. Try again.", "error");
        })
        .finally(() => {
            delete card.dataset.cozinessSaving;
            if (saveBtn && saveBtn.isConnected) {
                const pending = Number(card.dataset.pendingCozinessScore);
                saveBtn.disabled = !Number.isInteger(pending);
            }
        });
}

function hydrateCozinessUiFromCard(card) {
    const score = Number(card.dataset.cozinessScore);
    if (Number.isInteger(score) && score >= 1 && score <= 10) {
        applySelectedCozinessChip(card, score, { isEditable: false });
    } else {
        applySelectedCozinessChip(card, null);
    }
    clearCozinessAutoClose(card);
    setCozinessFeedback(card, "");
}

function moveCozinessSelection(card, currentScore, delta) {
    if (!Number.isInteger(currentScore) || currentScore < 1 || currentScore > 10) {
        currentScore = 1;
    }
    const next = Math.max(1, Math.min(10, currentScore + delta));
    applySelectedCozinessChip(card, next);
    const nextChip = card.querySelector(`.cozy-chip[data-score="${next}"]`);
    if (nextChip) {
        nextChip.focus();
    }
}

function hydrateAllCardCoziness() {
    const cards = [...results.querySelectorAll(".movie-card[data-imdb-id]")];
    const imdbIds = cards
        .map((card) => String(card.dataset.imdbId || "").trim())
        .filter(Boolean);

    if (!imdbIds.length) {
        return;
    }

    getCozinessRatingsBatch([...new Set(imdbIds)])
        .then((payload) => {
            const data = payload?.data || {};
            cards.forEach((card) => {
                const imdbId = String(card.dataset.imdbId || "").trim();
                const score = Number(data?.[imdbId]?.score);
                if (Number.isInteger(score) && score >= 1 && score <= 10) {
                    updateCardCoziness(card, score);
                } else {
                    updateCardCoziness(card, null);
                }
                hydrateCozinessUiFromCard(card);
            });
        })
        .catch(() => {
            cards.forEach((card) => {
                hydrateCozinessUiFromCard(card);
            });
        });
}

async function handleSearch() {
    const query = searchInput.value.trim();

    if (!query) {
        setResultsHeadVisible(false);
        setResultsMeta("Add a title to start your search.");
        discoverServices.reset();
        renderStatus(results, "Enter a movie title to search.", "empty");
        return;
    }

    setResultsHeadVisible(true);
    setSearchPending(true);
    trackEvent("search", { search_query: query });
    setResultsMeta(`Searching for "${query}"...`);
    discoverServices.reset();
    renderLoadingSkeletons(results, 6);

    try {
        const payload = await searchMovies(query);
        const movies = payload?.data || [];

        if (!movies.length) {
            setResultsMeta("No matches found.");
            discoverServices.reset();
            renderStatus(results, "No movies found. Try another title.", "empty");
            return;
        }

        setResultsMeta(`${movies.length} result${movies.length === 1 ? "" : "s"} found.`);
        renderMovies(results, movies);
        hydrateAllCardCoziness();
        discoverServices.setResults(movies);
        discoverServices.hydrateStreaming(getStreamingInfo);
    } catch (error) {
        setResultsMeta("Search unavailable.");
        discoverServices.reset();
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

function setStreamingSummary(summary, providers) {
    if (!summary) {
        return;
    }

    const matchedLabels = getMatchingServiceLabels(providers, discoverServices.getSelectedServiceKeys());
    if (matchedLabels.length === 1) {
        summary.textContent = `Included with your services on ${matchedLabels[0]}`;
        return;
    }
    if (matchedLabels.length > 1) {
        summary.textContent = "Included with your services";
        return;
    }

    const normalized = providers.map((provider) => {
        if (typeof provider === "string") {
            return { name: provider, availabilityType: "stream" };
        }
        return provider;
    });

    const typeRank = { stream: 0, free: 0, subscription: 0, rent: 1, buy: 2 };
    const ranked = [...normalized].sort((a, b) => {
        const aType = String(a?.availabilityType || "").toLowerCase();
        const bType = String(b?.availabilityType || "").toLowerCase();
        const aRank = Object.hasOwn(typeRank, aType) ? typeRank[aType] : 3;
        const bRank = Object.hasOwn(typeRank, bType) ? typeRank[bType] : 3;
        return aRank - bRank;
    });
    const best = ranked[0];

    if (best?.name) {
        const type = String(best.availabilityType || "stream").toLowerCase();
        if (type === "stream" || type === "free" || type === "subscription") {
            summary.textContent = `Best value: ${best.name} (included)`;
        } else {
            summary.textContent = `Best option: ${best.name} (${type})`;
        }
    } else {
        summary.textContent = "No major subscription platforms right now";
    }
}

async function loadStreamingPanel(card, button) {
    const imdbId = card.dataset.imdbId || "";
    const title = card.dataset.title || "";
    const year = card.dataset.year || "";
    const dataBox = card.querySelector(".data-box");
    const summary = card.querySelector(".movie-streaming-summary");

    if (!dataBox || !button) {
        return;
    }

    const cachedProviders = discoverServices.getCachedProviders(imdbId);
    if (cachedProviders) {
        renderStreamingProviders(dataBox, cachedProviders, { selectedServiceKeys: discoverServices.getSelectedServiceKeys() });
        setStreamingSummary(summary, cachedProviders);
        dataBox.dataset.loaded = "1";
        dataBox.classList.add("visible");
        button.textContent = "Hide options";
        return;
    }

    button.disabled = true;
    button.textContent = "Loading...";
    renderStreamingStatus(dataBox, "Locating US streaming rights...");
    dataBox.classList.add("visible");

    try {
        const payload = await getStreamingInfo(imdbId, title, year);
        const providers = payload?.data?.providers || [];
        discoverServices.storeProviders(imdbId, providers);
        renderStreamingProviders(dataBox, providers, { selectedServiceKeys: discoverServices.getSelectedServiceKeys() });
        setStreamingSummary(summary, providers);
        dataBox.dataset.loaded = "1";
        button.textContent = "Hide options";
    } catch (error) {
        renderStreamingStatus(dataBox, "Unable to pull streaming data right now.");
        if (summary) {
            summary.textContent = "Availability check failed - try again";
        }
        button.textContent = "Retry";
    } finally {
        button.disabled = false;
    }
}

async function toggleStreamingPanel(card, button) {
    const dataBox = card.querySelector(".data-box");
    if (!dataBox || !button) {
        return;
    }

    const isOpen = dataBox.classList.contains("visible");
    if (isOpen) {
        closeStreamingPanel(card);
        return;
    }

    results.querySelectorAll(".movie-card").forEach((candidate) => {
        if (candidate !== card) {
            closeStreamingPanel(candidate);
        }
        closeCozinessPanel(candidate);
    });
    closeCozinessPanel(card);

    button.setAttribute("aria-expanded", "true");
    if (dataBox.dataset.loaded === "1") {
        dataBox.classList.add("visible");
        button.textContent = "Hide options";
        return;
    }
    await loadStreamingPanel(card, button);
}

searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSearch();
});

if (openQueueButton) {
    openQueueButton.addEventListener("click", () => {
        clearQueueFlash();
        setActiveView("queue");
    });
}

if (imdbImportInput) {
    imdbImportInput.addEventListener("change", handleImportFileSelection);
}

if (leaderboardSort) {
    leaderboardSort.addEventListener("change", () => {
        leaderboardState.sortOrder = leaderboardSort.value === "asc" ? "asc" : "desc";
        loadLeaderboard();
    });
}

if (leaderboardGenre) {
    leaderboardGenre.addEventListener("change", () => {
        leaderboardState.genre = String(leaderboardGenre.value || "all");
        loadLeaderboard();
    });
}

tabButtons.forEach((tab) => {
    tab.addEventListener("click", () => {
        const view = tab.dataset.tab === "leaderboard"
            ? "leaderboard"
            : tab.dataset.tab === "queue"
                ? "queue"
                : "discover";
        setActiveView(view);
    });
});

if (cozyQueueContent) {
    cozyQueueContent.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        const action = button.dataset.action;

        if (action === "queue-upload" || action === "queue-import-new") {
            clearQueueFlash();
            openImportPicker();
            return;
        }

        if (action === "queue-confirm-import") {
            if (!queueUiState.preview) {
                return;
            }
            replaceImportBatch(queueUiState.preview);
            queueUiState.preview = null;
            queueUiState.selectedScore = null;
            queueUiState.feedbackMessage = "";
            queueUiState.feedbackTone = "";
            queueUiState.reviewingSkipped = false;
            queueUiState.reviewTotal = 0;
            updateQueueLauncher();
            renderQueueView();
            return;
        }

        if (action === "queue-cancel-preview") {
            queueUiState.preview = null;
            queueUiState.selectedScore = null;
            clearQueueFlash();
            renderQueueView();
            return;
        }

        if (action === "queue-score-select") {
            const score = Number(button.dataset.score);
            if (!Number.isInteger(score) || score < 1 || score > 10 || queueUiState.isSaving) {
                return;
            }
            queueUiState.selectedScore = score;
            queueUiState.feedbackMessage = "";
            queueUiState.feedbackTone = "";
            clearQueueFlash();
            renderQueueView();
            return;
        }

        if (action === "queue-save") {
            persistQueueRating();
            return;
        }

        if (action === "queue-skip") {
            const movie = getCurrentQueueMovie();
            if (!movie || queueUiState.isSaving) {
                return;
            }
            markImportedMovieSkipped(movie.imdbId);
            queueUiState.selectedScore = null;
            queueUiState.feedbackMessage = "Skipped for now. You can review it later.";
            queueUiState.feedbackTone = "";
            updateQueueLauncher();
            renderQueueView();
            return;
        }

        if (action === "queue-exit") {
            setActiveView("discover");
            return;
        }

        if (action === "queue-review-skipped") {
            const summary = getQueueSummary();
            restoreSkippedMovies();
            queueUiState.reviewingSkipped = true;
            queueUiState.reviewTotal = summary.skippedCount || 0;
            queueUiState.selectedScore = null;
            clearQueueFlash();
            queueUiState.feedbackMessage = "Review skipped movies now, or leave them skipped for later.";
            queueUiState.feedbackTone = "";
            updateQueueLauncher();
            renderQueueView();
            return;
        }

        if (action === "queue-go-leaderboard") {
            setActiveView("leaderboard");
        }
    });
}

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
        trackEvent("watch_trailer_click", {
            movie_title: card.dataset.title || "",
            imdb_id: card.dataset.imdbId || ""
        });
        openTrailer(card.dataset.imdbId || "", card.dataset.title || "");
        return;
    }

    if (action === "streaming") {
        trackEvent("where_to_watch_click", {
            movie_title: card.dataset.title || "",
            imdb_id: card.dataset.imdbId || ""
        });
        toggleStreamingPanel(card, button);
        return;
    }

    if (action === "coziness-toggle") {
        const isOpen = button.getAttribute("aria-expanded") === "true";
        if (isOpen) {
            closeCozinessPanel(card);
        } else {
            openCozinessPanel(card);
            hydrateCozinessUiFromCard(card);
            trackEvent("coziness_panel_open", {
                movie_title: card.dataset.title || "",
                imdb_id: card.dataset.imdbId || ""
            });
        }
        return;
    }

    if (action === "coziness-select") {
        const score = Number(button.dataset.score);
        if (!Number.isInteger(score) || score < 1 || score > 10) {
            return;
        }
        applySelectedCozinessChip(card, score);
        return;
    }

    if (action === "coziness-save") {
        persistCozinessSelection(card);
    }
});

setActiveView("discover");
setResultsHeadVisible(false);
updateQueueLauncher();

results.addEventListener("keydown", (event) => {
    const chip = event.target.closest(".cozy-chip");
    if (!chip) {
        return;
    }
    const card = chip.closest(".movie-card");
    if (!card) {
        return;
    }
    const score = Number(chip.dataset.score);
    if (!Number.isInteger(score)) {
        return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        moveCozinessSelection(card, score, 1);
        return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        moveCozinessSelection(card, score, -1);
        return;
    }
    if (event.key === "Home") {
        event.preventDefault();
        applySelectedCozinessChip(card, 1);
        const firstChip = card.querySelector('.cozy-chip[data-score="1"]');
        if (firstChip) {
            firstChip.focus();
        }
        return;
    }
    if (event.key === "End") {
        event.preventDefault();
        applySelectedCozinessChip(card, 10);
        const lastChip = card.querySelector('.cozy-chip[data-score="10"]');
        if (lastChip) {
            lastChip.focus();
        }
    }
});

results.addEventListener("click", (event) => {
    const imdbLink = event.target.closest("a.imdb-btn");
    if (imdbLink) {
        const card = imdbLink.closest(".movie-card");
        trackEvent("imdb_click", {
            movie_title: card?.dataset.title || "",
            imdb_id: card?.dataset.imdbId || ""
        });
        return;
    }

    const providerLink = event.target.closest(".provider-item[href]");
    if (providerLink) {
        const card = providerLink.closest(".movie-card");
        const providerName = providerLink.querySelector(".provider-name")?.textContent?.trim() || "";
        const availabilityType = providerLink.querySelector(".provider-type")?.textContent?.trim() || "";
        trackEvent("provider_click", {
            movie_title: card?.dataset.title || "",
            imdb_id: card?.dataset.imdbId || "",
            provider_name: providerName,
            availability_type: availabilityType
        });
    }
});
