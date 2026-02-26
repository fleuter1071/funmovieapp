import { NO_POSTER_URL } from "../config.js";

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

        const actions = document.createElement("div");
        actions.className = "actions";

        const trailerBtn = document.createElement("button");
        trailerBtn.type = "button";
        trailerBtn.className = "action-btn";
        trailerBtn.dataset.action = "trailer";
        trailerBtn.textContent = "Watch Trailer";

        const streamBtn = document.createElement("button");
        streamBtn.type = "button";
        streamBtn.className = "action-btn stream-btn";
        streamBtn.dataset.action = "streaming";
        streamBtn.textContent = "Where to Watch";

        const dataBox = document.createElement("div");
        dataBox.className = "data-box";

        posterWrap.appendChild(img);
        actions.append(trailerBtn, streamBtn);
        card.append(posterWrap, title, year, actions, dataBox);
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

    const heading = document.createElement("strong");
    heading.textContent = "Streaming On:";

    const badgesWrap = document.createElement("div");
    badgesWrap.className = "badges";

    providers.forEach((provider) => {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = provider;
        badgesWrap.appendChild(badge);
    });

    dataBox.append(heading, badgesWrap);
}
