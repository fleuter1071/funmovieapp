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
        card.dataset.imdbId = movie.imdbId;
        card.dataset.title = movie.title;

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

        const streamingSummary = document.createElement("p");
        streamingSummary.className = "movie-streaming-summary";
        streamingSummary.textContent = "Tap Where to Watch for availability";

        const actions = document.createElement("div");
        actions.className = "actions";

        const trailerBtn = document.createElement("button");
        trailerBtn.type = "button";
        trailerBtn.className = "action-btn trailer-btn";
        trailerBtn.dataset.action = "trailer";
        trailerBtn.textContent = "Watch Trailer";

        const streamBtn = document.createElement("button");
        streamBtn.type = "button";
        streamBtn.className = "action-btn stream-btn";
        streamBtn.dataset.action = "streaming";
        streamBtn.textContent = "Where to Watch";

        const imdbId = String(movie.imdbId || "").trim();
        const imdbUrl = imdbId ? `https://www.imdb.com/title/${encodeURIComponent(imdbId)}/` : "";
        const imdbLogo = document.createElement("img");
        imdbLogo.src = IMDB_LOGO_SRC;
        imdbLogo.alt = "";
        imdbLogo.setAttribute("aria-hidden", "true");

        let imdbControl;

        if (imdbUrl) {
            const imdbLink = document.createElement("a");
            imdbLink.className = "action-btn imdb-btn";
            imdbLink.href = imdbUrl;
            imdbLink.target = "_blank";
            imdbLink.rel = "noopener noreferrer";
            imdbLink.setAttribute("aria-label", `View ${movie.title} on IMDb (opens in a new tab)`);
            imdbLink.title = "Opens in a new tab";

            const imdbLabel = document.createElement("span");
            imdbLabel.className = "imdb-label";
            imdbLabel.textContent = "View on IMDb";

            const imdbMeta = document.createElement("span");
            imdbMeta.className = "imdb-meta";
            imdbMeta.textContent = "(new tab)";

            imdbLink.append(imdbLogo, imdbLabel, imdbMeta);
            imdbControl = imdbLink;
        } else {
            const imdbButton = document.createElement("button");
            imdbButton.type = "button";
            imdbButton.className = "action-btn imdb-btn";
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

        posterWrap.appendChild(img);
        actions.append(trailerBtn, streamBtn, imdbControl);
        card.append(posterWrap, title, year, streamingSummary, actions, dataBox);
        fragment.appendChild(card);
    });

    container.appendChild(fragment);
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
