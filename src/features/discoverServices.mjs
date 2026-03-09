import {
    CURATED_STREAMING_SERVICES,
    getMatchBadgeText,
    getMatchingServiceLabels,
    INCLUDED_ONLY_FILTER_ENABLED_KEY,
    sanitizeSelectedServiceKeys,
    SELECTED_STREAMING_SERVICES_KEY
} from "./myServices.mjs";
import { updateMovieServiceBadge } from "../ui/renderers.js";

export function createDiscoverServicesController(options) {
    const state = {
        movies: [],
        selectedServiceKeys: loadSelectedServiceKeys(),
        includedOnlyEnabled: loadIncludedOnlyEnabled(),
        streamingByImdbId: new Map(),
        requestToken: 0
    };

    if (!state.selectedServiceKeys.length) {
        state.includedOnlyEnabled = false;
    }

    function readLocalStorage(key) {
        try { return window.localStorage.getItem(key); } catch { return null; }
    }

    function writeLocalStorage(key, value) {
        try { window.localStorage.setItem(key, value); } catch {}
    }

    function removeLocalStorage(key) {
        try { window.localStorage.removeItem(key); } catch {}
    }

    function loadSelectedServiceKeys() {
        try {
            return sanitizeSelectedServiceKeys(JSON.parse(readLocalStorage(SELECTED_STREAMING_SERVICES_KEY) || "[]"));
        } catch {
            return [];
        }
    }

    function loadIncludedOnlyEnabled() {
        try {
            return JSON.parse(readLocalStorage(INCLUDED_ONLY_FILTER_ENABLED_KEY) || "false") === true;
        } catch {
            return false;
        }
    }

    function persist() {
        if (state.selectedServiceKeys.length) {
            writeLocalStorage(SELECTED_STREAMING_SERVICES_KEY, JSON.stringify(state.selectedServiceKeys));
        } else {
            removeLocalStorage(SELECTED_STREAMING_SERVICES_KEY);
        }
        writeLocalStorage(INCLUDED_ONLY_FILTER_ENABLED_KEY, JSON.stringify(Boolean(state.includedOnlyEnabled)));
    }

    function renderControls() {
        const count = state.selectedServiceKeys.length;
        if (options.myServicesButton) {
            options.myServicesButton.textContent = count ? `My Services: ${count} selected` : "My Services";
        }
        if (options.includedOnlyWrap) {
            options.includedOnlyWrap.hidden = !count;
            options.includedOnlyWrap.classList.toggle("is-disabled", !count);
        }
        if (options.includedOnlyInput) {
            options.includedOnlyInput.disabled = !count;
            options.includedOnlyInput.checked = count > 0 && state.includedOnlyEnabled;
        }
    }

    function renderServiceOptions() {
        if (!options.servicesOptions) return;
        options.servicesOptions.innerHTML = "";
        const selected = new Set(state.selectedServiceKeys);
        CURATED_STREAMING_SERVICES.forEach((service) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `service-option${selected.has(service.key) ? " is-selected" : ""}`;
            button.dataset.serviceKey = service.key;
            button.setAttribute("aria-pressed", selected.has(service.key) ? "true" : "false");
            button.innerHTML = `<span class="service-option-label">${service.label}</span><span class="service-option-status">${selected.has(service.key) ? "Selected" : "Tap to add"}</span>`;
            options.servicesOptions.appendChild(button);
        });
    }

    function setFilterState(message = "", kind = "") {
        if (!options.filterState) return;
        options.filterState.hidden = !message;
        options.filterState.className = `discover-filter-state${kind ? ` is-${kind}` : ""}`;
        options.filterState.textContent = message;
    }

    function refreshMeta() {
        if (typeof options.setResultsMeta !== "function") return;
        const total = state.movies.length;
        if (!total) return;
        const cards = [...options.results.querySelectorAll(".movie-card")];
        const visible = cards.filter((card) => !card.hidden).length;
        if (state.includedOnlyEnabled && state.selectedServiceKeys.length) {
            const pending = state.movies.filter((movie) => movie.imdbId && !state.streamingByImdbId.has(movie.imdbId)).length;
            if (pending) {
                options.setResultsMeta(`Checking your services across ${total} result${total === 1 ? "" : "s"}...`);
            } else {
                options.setResultsMeta(`${visible} included match${visible === 1 ? "" : "es"} from ${total} result${total === 1 ? "" : "s"}.`);
            }
            return;
        }
        const matched = state.movies.filter((movie) => {
            const entry = state.streamingByImdbId.get(movie.imdbId);
            return entry && getMatchingServiceLabels(entry.providers, state.selectedServiceKeys).length > 0;
        }).length;
        options.setResultsMeta(matched ? `${total} results found. ${matched} included with your services.` : `${total} result${total === 1 ? "" : "s"} found.`);
    }

    function applyToCards() {
        const cards = [...options.results.querySelectorAll(".movie-card")];
        let visible = 0;
        let pending = 0;
        cards.forEach((card) => {
            const imdbId = String(card.dataset.imdbId || "").trim();
            const providers = state.streamingByImdbId.get(imdbId)?.providers || [];
            const matches = getMatchingServiceLabels(providers, state.selectedServiceKeys);
            updateMovieServiceBadge(card, state.selectedServiceKeys.length ? getMatchBadgeText(providers, state.selectedServiceKeys) : "");
            if (state.includedOnlyEnabled && state.selectedServiceKeys.length) {
                if (imdbId && !state.streamingByImdbId.has(imdbId)) pending += 1;
                card.hidden = matches.length === 0;
            } else {
                card.hidden = false;
            }
            if (!card.hidden) visible += 1;
        });
        if (state.includedOnlyEnabled && state.selectedServiceKeys.length && visible === 0) {
            setFilterState(pending ? "Checking your services..." : "No movies in these results are included with your services. Turn off Included only to see everything.", pending ? "loading" : "empty");
        } else {
            setFilterState();
        }
        refreshMeta();
    }

    function openSheet() {
        if (!options.sheet || !options.backdrop) return;
        renderServiceOptions();
        options.sheet.hidden = false;
        options.backdrop.hidden = false;
        document.body.classList.add("services-sheet-open");
    }

    function closeSheet() {
        if (!options.sheet || !options.backdrop) return;
        options.sheet.hidden = true;
        options.backdrop.hidden = true;
        document.body.classList.remove("services-sheet-open");
    }

    function toggleService(serviceKey) {
        const next = new Set(state.selectedServiceKeys);
        if (next.has(serviceKey)) next.delete(serviceKey); else next.add(serviceKey);
        state.selectedServiceKeys = sanitizeSelectedServiceKeys([...next]);
        if (!state.selectedServiceKeys.length) state.includedOnlyEnabled = false;
        persist();
        renderControls();
        renderServiceOptions();
        applyToCards();
    }

    function clearServices() {
        state.selectedServiceKeys = [];
        state.includedOnlyEnabled = false;
        persist();
        renderControls();
        renderServiceOptions();
        applyToCards();
    }

    options.myServicesButton?.addEventListener("click", openSheet);
    options.backdrop?.addEventListener("click", closeSheet);
    options.closeButton?.addEventListener("click", closeSheet);
    options.doneButton?.addEventListener("click", closeSheet);
    options.clearButton?.addEventListener("click", clearServices);
    options.includedOnlyInput?.addEventListener("change", () => {
        state.includedOnlyEnabled = options.includedOnlyInput.checked && state.selectedServiceKeys.length > 0;
        persist();
        applyToCards();
    });
    options.servicesOptions?.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-service-key]");
        if (button) toggleService(button.dataset.serviceKey || "");
    });
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && options.sheet && !options.sheet.hidden) closeSheet();
    });

    renderControls();
    renderServiceOptions();

    return {
        setResults(movies) { state.movies = Array.isArray(movies) ? movies : []; applyToCards(); },
        reset() { state.movies = []; state.streamingByImdbId = new Map(); state.requestToken += 1; setFilterState(); renderControls(); },
        getSelectedServiceKeys() { return [...state.selectedServiceKeys]; },
        getCachedProviders(imdbId) { return state.streamingByImdbId.get(String(imdbId || "").trim())?.providers || null; },
        storeProviders(imdbId, providers) { if (imdbId) { state.streamingByImdbId.set(imdbId, { providers: Array.isArray(providers) ? providers : [] }); applyToCards(); } },
        hydrateStreaming(getStreamingInfo) {
            const queue = state.movies.filter((movie) => movie?.imdbId);
            if (!queue.length) return;
            const token = ++state.requestToken;
            let index = 0;
            const worker = async () => {
                while (index < queue.length && token === state.requestToken) {
                    const movie = queue[index++];
                    if (!movie?.imdbId || state.streamingByImdbId.has(movie.imdbId)) continue;
                    try {
                        const payload = await getStreamingInfo(movie.imdbId, movie.title || "", movie.year || "");
                        state.streamingByImdbId.set(movie.imdbId, { providers: Array.isArray(payload?.data?.providers) ? payload.data.providers : [] });
                    } catch {
                        state.streamingByImdbId.set(movie.imdbId, { providers: [], error: true });
                    }
                    applyToCards();
                }
            };
            Array.from({ length: Math.min(4, queue.length) }, () => worker());
        },
        closeSheet,
        applyToCards
    };
}
