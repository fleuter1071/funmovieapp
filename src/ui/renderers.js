import { NO_POSTER_URL } from "../config.js";

const IMDB_LOGO_SRC = "/src/assets/IMDBlogos/IMDb_PrimaryLogo_Black.svg";

export function renderStatus(container, message, kind = "") {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.className = `message${kind ? ` is-${kind}` : ""}`;
    p.textContent = message;
    container.appendChild(p);
}

export function renderLoadingSkeletons(container, count = 6) {
    container.innerHTML = "";

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i += 1) {
        const card = document.createElement("div");
        card.className = "skeleton-card";

        const poster = document.createElement("div");
        poster.className = "skeleton-block skeleton-poster";

        const title = document.createElement("div");
        title.className = "skeleton-block skeleton-title";

        const line1 = document.createElement("div");
        line1.className = "skeleton-block skeleton-line";

        const line2 = document.createElement("div");
        line2.className = "skeleton-block skeleton-line";

        card.append(poster, title, line1, line2);
        fragment.appendChild(card);
    }

    container.appendChild(fragment);
}

export function renderMovies(container, movies) {
    container.innerHTML = "";

    const fragment = document.createDocumentFragment();

    movies.forEach((movie) => {
        const card = document.createElement("article");
        card.className = "movie-card";
        card.dataset.imdbId = String(movie.imdbId || "").trim();
        card.dataset.title = String(movie.title || "").trim();
        card.dataset.year = String(movie.year || "").trim();
        card.dataset.posterUrl = String(movie.posterUrl || "").trim();
        const genres = Array.isArray(movie.genres)
            ? movie.genres
            : movie.genre
                ? [movie.genre]
                : [];
        card.dataset.genres = JSON.stringify(genres);

        const posterWrap = document.createElement("div");
        posterWrap.className = "poster-wrap";

        const img = document.createElement("img");
        img.src = movie.posterUrl || NO_POSTER_URL;
        img.alt = `${movie.title} Poster`;

        const title = document.createElement("h3");
        title.className = "movie-title";
        title.textContent = movie.title;

        const year = document.createElement("p");
        year.className = "movie-year";
        year.textContent = movie.year || "Year not available";
        const imdbId = String(movie.imdbId || "").trim();

        const streamingSummary = document.createElement("p");
        streamingSummary.className = "movie-streaming-summary";
        streamingSummary.textContent = "";

        const actions = document.createElement("div");
        actions.className = "actions";

        const trailerBtn = document.createElement("button");
        trailerBtn.type = "button";
        trailerBtn.className = "action-btn btn-primary trailer-btn";
        trailerBtn.dataset.action = "trailer";
        trailerBtn.textContent = "Watch Trailer";

        const streamBtn = document.createElement("button");
        streamBtn.type = "button";
        streamBtn.className = "action-btn btn-secondary stream-btn";
        streamBtn.dataset.action = "streaming";
        streamBtn.setAttribute("aria-expanded", "false");
        streamBtn.textContent = "Where to Watch";

        const cozyToggleBtn = document.createElement("button");
        cozyToggleBtn.type = "button";
        cozyToggleBtn.className = "action-btn btn-tertiary cozy-btn";
        cozyToggleBtn.dataset.action = "coziness-toggle";
        cozyToggleBtn.setAttribute("aria-expanded", "false");
        cozyToggleBtn.textContent = imdbId ? "☕ Rate Coziness ▼" : "Cozy Rating N/A";
        cozyToggleBtn.disabled = !imdbId;
        if (!imdbId) {
            cozyToggleBtn.title = "IMDb ID required to save a coziness rating.";
            cozyToggleBtn.setAttribute("aria-label", "Coziness rating unavailable");
        }

        const imdbUrl = imdbId ? `https://www.imdb.com/title/${encodeURIComponent(imdbId)}/` : "";
        const imdbLogo = document.createElement("img");
        imdbLogo.src = IMDB_LOGO_SRC;
        imdbLogo.alt = "";
        imdbLogo.setAttribute("aria-hidden", "true");

        let imdbControl;

        if (imdbUrl) {
            const imdbLink = document.createElement("a");
            imdbLink.className = "action-btn btn-utility imdb-btn";
            imdbLink.href = imdbUrl;
            imdbLink.target = "_blank";
            imdbLink.rel = "noopener noreferrer";
            imdbLink.setAttribute("aria-label", `View ${movie.title} on IMDb (opens in a new tab)`);
            imdbLink.title = "Opens in a new tab";

            const imdbLabel = document.createElement("span");
            imdbLabel.className = "imdb-label";
            imdbLabel.textContent = "IMDb";

            imdbLink.append(imdbLogo, imdbLabel);
            imdbControl = imdbLink;
        } else {
            const imdbButton = document.createElement("button");
            imdbButton.type = "button";
            imdbButton.className = "action-btn btn-utility imdb-btn";
            imdbButton.disabled = true;
            imdbButton.setAttribute("aria-label", "IMDb link unavailable");
            imdbButton.title = "IMDb link unavailable";

            const imdbLabel = document.createElement("span");
            imdbLabel.className = "imdb-label";
            imdbLabel.textContent = "IMDb unavailable";

            imdbButton.append(imdbLogo, imdbLabel);
            imdbControl = imdbButton;
        }

        const dataBox = document.createElement("div");
        dataBox.className = "data-box";

        const cozinessBox = document.createElement("div");
        cozinessBox.className = "coziness-box";

        const cozinessHead = document.createElement("div");
        cozinessHead.className = "coziness-head";

        const cozinessLabel = document.createElement("p");
        cozinessLabel.className = "coziness-label";
        cozinessLabel.textContent = "Community Cozy Score";

        const cozinessCurrent = document.createElement("span");
        cozinessCurrent.className = "coziness-current";
        cozinessCurrent.textContent = "Not rated";

        cozinessHead.append(cozinessLabel, cozinessCurrent);

        const chipGrid = document.createElement("div");
        chipGrid.className = "cozy-chip-grid";
        chipGrid.setAttribute("role", "radiogroup");
        chipGrid.setAttribute("aria-label", `Select coziness score for ${movie.title}`);

        for (let score = 1; score <= 10; score += 1) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "cozy-chip";
            chip.dataset.action = "coziness-select";
            chip.dataset.score = String(score);
            chip.setAttribute("role", "radio");
            chip.setAttribute("aria-checked", "false");
            chip.textContent = String(score);
            chipGrid.appendChild(chip);
        }

        const selectedText = document.createElement("span");
        selectedText.className = "coziness-selected";
        selectedText.textContent = "Select a score";

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "coziness-save-btn";
        saveBtn.dataset.action = "coziness-save";
        saveBtn.disabled = true;
        saveBtn.textContent = "Save rating";

        const controls = document.createElement("div");
        controls.className = "coziness-controls";
        controls.append(selectedText, saveBtn);

        const feedbackText = document.createElement("span");
        feedbackText.className = "coziness-feedback";
        feedbackText.setAttribute("aria-live", "polite");
        feedbackText.textContent = "";

        cozinessBox.append(cozinessHead, chipGrid, controls, feedbackText);

        posterWrap.appendChild(img);
        actions.append(trailerBtn, streamBtn, cozyToggleBtn, imdbControl);
        if (imdbId) {
            card.append(posterWrap, title, year, streamingSummary, actions, cozinessBox, dataBox);
        } else {
            card.append(posterWrap, title, year, streamingSummary, actions, dataBox);
        }
        fragment.appendChild(card);
    });

    container.appendChild(fragment);
}

export function renderLeaderboard(container, payload = {}) {
    container.innerHTML = "";

    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (!items.length) {
        renderStatus(container, "No rated movies match this filter yet.", "empty");
        return;
    }

    const list = document.createElement("div");
    list.className = "leaderboard-list";

    items.forEach((item) => {
        const row = document.createElement("article");
        row.className = "leaderboard-row";

        const rank = document.createElement("span");
        rank.className = "leaderboard-rank";
        rank.textContent = String(item.rank || "");

        const poster = document.createElement("img");
        poster.className = "leaderboard-poster";
        poster.src = item.posterUrl || NO_POSTER_URL;
        poster.alt = item.title ? `${item.title} Poster` : "Movie poster";
        poster.loading = "lazy";
        poster.decoding = "async";

        const content = document.createElement("div");
        content.className = "leaderboard-content";

        const title = document.createElement("h3");
        title.className = "leaderboard-title";
        const year = item.year ? ` (${item.year})` : "";
        title.textContent = `${item.title || item.imdbId || "Untitled"}${year}`;

        const score = document.createElement("span");
        score.className = "leaderboard-score";
        score.textContent = `Cozy ${item.score}/10`;

        content.append(title, score);
        row.append(rank, poster, content);
        list.appendChild(row);
    });

    container.appendChild(list);
}

export function updateCardCoziness(card, score) {
    const cozyToggleBtn = card.querySelector(".cozy-btn");
    if (!cozyToggleBtn) {
        return;
    }
    const imdbId = String(card.dataset.imdbId || "").trim();
    if (!imdbId) {
        cozyToggleBtn.disabled = true;
        cozyToggleBtn.textContent = "Cozy Rating N/A";
        delete card.dataset.cozinessScore;
        return;
    }
    cozyToggleBtn.disabled = false;
    const isExpanded = cozyToggleBtn.getAttribute("aria-expanded") === "true";
    const arrow = isExpanded ? "▲" : "▼";

    if (Number.isInteger(score) && score >= 1 && score <= 10) {
        card.dataset.cozinessScore = String(score);
        cozyToggleBtn.textContent = `☕ Cozy Rating: ${score}/10 ${arrow}`;
    } else {
        delete card.dataset.cozinessScore;
        cozyToggleBtn.textContent = `☕ Rate Coziness ${arrow}`;
    }
    const cozyCurrent = card.querySelector(".coziness-current");
    if (cozyCurrent) {
        cozyCurrent.textContent = Number.isInteger(score) && score >= 1 && score <= 10
            ? `Current ${score}/10`
            : "Not rated";
    }
}

export function renderStreamingStatus(dataBox, message) {
    dataBox.classList.add("visible");
    dataBox.textContent = message;
}

export function renderStreamingProviders(dataBox, providers) {
    dataBox.classList.add("visible");
    dataBox.innerHTML = "";

    if (!providers.length) {
        const em = document.createElement("em");
        em.textContent = "Not currently on major streaming platforms. Check VOD to rent or buy.";
        dataBox.appendChild(em);
        return;
    }

    const normalizedProviders = providers.map((rawProvider) => {
        if (typeof rawProvider === "string") {
            return {
                name: rawProvider,
                logoUrl: "",
                movieUrl: "",
                availabilityType: "stream",
                isClickable: false
            };
        }
        return rawProvider;
    });

    const bucketOrder = ["included", "rent", "buy", "other"];
    const buckets = new Map(bucketOrder.map((key) => [key, []]));
    const classifyProvider = (provider) => {
        const type = String(provider.availabilityType || "").toLowerCase();
        if (type === "stream" || type === "free" || type === "subscription") return "included";
        if (type === "rent") return "rent";
        if (type === "buy") return "buy";
        return "other";
    };

    normalizedProviders.forEach((provider) => {
        buckets.get(classifyProvider(provider)).push(provider);
    });

    const rankedProviders = bucketOrder.flatMap((bucket) => buckets.get(bucket));
    const featuredProviders = [];
    const featuredNames = new Set();
    const pushFeatured = (provider) => {
        if (!provider) return;
        const key = String(provider.name || "").toLowerCase();
        if (featuredNames.has(key)) return;
        featuredProviders.push(provider);
        featuredNames.add(key);
    };

    pushFeatured(buckets.get("included")[0]);
    pushFeatured(buckets.get("rent")[0]);
    pushFeatured(buckets.get("buy")[0]);
    pushFeatured(buckets.get("other")[0]);
    if (!featuredProviders.length) {
        pushFeatured(rankedProviders[0]);
    }
    while (featuredProviders.length < 2) {
        const candidate = rankedProviders.find((provider) => !featuredNames.has(String(provider.name || "").toLowerCase()));
        if (!candidate) break;
        pushFeatured(candidate);
    }

    const remainingProviders = rankedProviders.filter((provider) => !featuredNames.has(String(provider.name || "").toLowerCase()));

    const heading = document.createElement("strong");
    heading.textContent = "Smart Watch Options:";

    const hint = document.createElement("p");
    hint.className = "streaming-hint";
    hint.textContent = remainingProviders.length
        ? "Best options first. Tap More options for all platforms."
        : "Best options first. Tap a platform to open this movie (new tab).";

    const featuredGrid = document.createElement("div");
    featuredGrid.className = "provider-grid provider-grid-featured";

    const renderProvider = (provider, container, isFeatured = false) => {
        const isLink = Boolean(provider.isClickable && provider.movieUrl);
        const item = document.createElement(isLink ? "a" : "div");
        item.className = `provider-item${isFeatured ? " provider-item-featured" : ""}${isLink ? "" : " is-disabled"}`;

        if (isLink) {
            item.href = provider.movieUrl;
            item.target = "_blank";
            item.rel = "noopener noreferrer";
            item.setAttribute("aria-label", `Open ${provider.name} for this movie (new tab)`);
        } else {
            item.setAttribute("aria-label", `${provider.name} link unavailable`);
            item.title = "Direct movie link unavailable";
        }

        if (provider.logoUrl) {
            const logo = document.createElement("img");
            logo.className = "provider-logo";
            logo.src = provider.logoUrl;
            logo.alt = `${provider.name} logo`;
            logo.loading = "lazy";
            logo.decoding = "async";
            logo.addEventListener("error", () => {
                logo.remove();
                item.classList.add("no-logo");
            });
            item.appendChild(logo);
        }

        const name = document.createElement("span");
        name.className = "provider-name";
        name.textContent = provider.name;

        const type = document.createElement("span");
        type.className = "provider-type";
        type.textContent = provider.availabilityType || "stream";

        item.append(name, type);
        container.appendChild(item);
    };

    featuredProviders.forEach((provider) => renderProvider(provider, featuredGrid, true));

    dataBox.append(heading, hint, featuredGrid);

    if (!remainingProviders.length) {
        return;
    }

    const moreButton = document.createElement("button");
    moreButton.type = "button";
    moreButton.className = "streaming-more-btn";
    moreButton.textContent = `More options (${remainingProviders.length})`;
    moreButton.setAttribute("aria-expanded", "false");

    const remainingWrap = document.createElement("div");
    remainingWrap.className = "streaming-more-wrap";
    remainingWrap.hidden = true;

    const providerGrid = document.createElement("div");
    providerGrid.className = "provider-grid";
    remainingProviders.forEach((provider) => renderProvider(provider, providerGrid, false));
    remainingWrap.appendChild(providerGrid);

    moreButton.addEventListener("click", () => {
        const isOpen = !remainingWrap.hidden;
        remainingWrap.hidden = isOpen;
        moreButton.setAttribute("aria-expanded", isOpen ? "false" : "true");
        moreButton.textContent = isOpen
            ? `More options (${remainingProviders.length})`
            : "Hide extra options";
    });

    dataBox.append(moreButton, remainingWrap);
}
