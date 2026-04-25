const STORAGE_KEYS = {
    batch: "moviefun.import.batch",
    movies: "moviefun.import.movies",
    state: "moviefun.import.state"
};

function getStorage(storage) {
    if (storage) {
        return storage;
    }
    if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage;
    }
    return null;
}

function safeReadJson(storage, key, fallback) {
    try {
        const value = storage?.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        return fallback;
    }
}

function safeWriteJson(storage, key, value) {
    if (!storage) {
        return;
    }
    storage.setItem(key, JSON.stringify(value));
}

function ensureMovieRecord(record) {
    return {
        id: record.id,
        batchId: record.batchId,
        imdbId: record.imdbId,
        title: record.title,
        originalTitle: record.originalTitle || record.title,
        year: record.year || null,
        titleType: record.titleType || "Movie",
        genres: Array.isArray(record.genres) ? record.genres : [],
        posterUrl: record.posterUrl || "",
        imdbUserRating: record.imdbUserRating ?? null,
        dateRated: record.dateRated || "",
        imdbRating: record.imdbRating || "",
        runtimeMins: record.runtimeMins ?? null,
        releaseDate: record.releaseDate || "",
        directors: record.directors || "",
        cozyScore: Number.isInteger(record.cozyScore) ? record.cozyScore : null,
        cozyRatingStatus: record.cozyRatingStatus || "unrated",
        skippedAt: record.skippedAt || null,
        ratedAt: record.ratedAt || null,
        createdAt: record.createdAt || new Date().toISOString(),
        updatedAt: record.updatedAt || new Date().toISOString()
    };
}

export function replaceImportBatch(parsedImport, options = {}) {
    const storage = getStorage(options.storage);
    const now = new Date().toISOString();
    const batchId = `imdb_${Date.now()}`;
    const records = parsedImport.records.map((record) => ensureMovieRecord({
        ...record,
        batchId,
        cozyScore: null,
        cozyRatingStatus: "unrated",
        createdAt: now,
        updatedAt: now
    }));

    const batch = {
        id: batchId,
        source: "imdb",
        createdAt: now,
        originalFileName: parsedImport.sourceName || "IMDb ratings.csv",
        totalRows: parsedImport.summary.totalRows,
        importableMovies: parsedImport.summary.importableMovies,
        skippedNonMovie: parsedImport.summary.skippedNonMovie,
        skippedMissingId: parsedImport.summary.skippedMissingId,
        skippedInvalid: parsedImport.summary.skippedInvalid,
        ratedCount: 0,
        skippedCount: 0,
        status: "active"
    };

    const state = {
        activeBatchId: batchId,
        currentMovieId: records[0]?.id || null,
        queueMode: "unrated",
        lastVisitedAt: now
    };

    safeWriteJson(storage, STORAGE_KEYS.batch, batch);
    safeWriteJson(storage, STORAGE_KEYS.movies, records);
    safeWriteJson(storage, STORAGE_KEYS.state, state);

    return { batch, records, state };
}

export function getImportBatch(options = {}) {
    const storage = getStorage(options.storage);
    return safeReadJson(storage, STORAGE_KEYS.batch, null);
}

export function getImportedMovies(options = {}) {
    const storage = getStorage(options.storage);
    const movies = safeReadJson(storage, STORAGE_KEYS.movies, []);
    return Array.isArray(movies) ? movies.map(ensureMovieRecord) : [];
}

export function getImportState(options = {}) {
    const storage = getStorage(options.storage);
    return safeReadJson(storage, STORAGE_KEYS.state, {
        activeBatchId: null,
        currentMovieId: null,
        queueMode: "unrated",
        lastVisitedAt: null
    });
}

export function getQueueSummary(options = {}) {
    const batch = getImportBatch(options);
    const movies = getImportedMovies(options);
    const ratedCount = movies.filter((movie) => movie.cozyRatingStatus === "rated").length;
    const skippedCount = movies.filter((movie) => movie.cozyRatingStatus === "skipped").length;
    const remainingCount = movies.filter((movie) => movie.cozyRatingStatus === "unrated").length;

    if (!batch) {
        return {
            batch: null,
            movies: [],
            ratedCount: 0,
            skippedCount: 0,
            remainingCount: 0,
            totalCount: 0
        };
    }

    return {
        batch: {
            ...batch,
            ratedCount,
            skippedCount
        },
        movies,
        ratedCount,
        skippedCount,
        remainingCount,
        totalCount: movies.length
    };
}

export function getCurrentQueueMovie(options = {}) {
    const movies = getImportedMovies(options);
    const state = getImportState(options);
    const summary = getQueueSummary(options);

    const byId = new Map(movies.map((movie) => [movie.id, movie]));
    const preferred = state.currentMovieId ? byId.get(state.currentMovieId) : null;
    if (preferred && preferred.cozyRatingStatus === "unrated") {
        return preferred;
    }

    const fallback = movies.find((movie) => movie.cozyRatingStatus === "unrated") || null;
    if (!fallback) {
        return null;
    }

    updateImportState({
        ...state,
        currentMovieId: fallback.id,
        activeBatchId: summary.batch?.id || null
    }, options);

    return fallback;
}

export function updateImportState(nextState, options = {}) {
    const storage = getStorage(options.storage);
    safeWriteJson(storage, STORAGE_KEYS.state, {
        activeBatchId: nextState.activeBatchId || null,
        currentMovieId: nextState.currentMovieId || null,
        queueMode: nextState.queueMode || "unrated",
        lastVisitedAt: new Date().toISOString()
    });
}

function updateMovieRecord(imdbId, updater, options = {}) {
    const storage = getStorage(options.storage);
    const movies = getImportedMovies(options);
    const nextMovies = movies.map((movie) => {
        if (movie.imdbId !== imdbId) {
            return movie;
        }
        return ensureMovieRecord(updater(movie));
    });
    safeWriteJson(storage, STORAGE_KEYS.movies, nextMovies);
    return nextMovies;
}

export function markImportedMovieRated(imdbId, cozyScore, options = {}) {
    const nextMovies = updateMovieRecord(imdbId, (movie) => ({
        ...movie,
        cozyScore,
        cozyRatingStatus: "rated",
        ratedAt: new Date().toISOString(),
        skippedAt: null,
        updatedAt: new Date().toISOString()
    }), options);
    const nextMovie = nextMovies.find((movie) => movie.cozyRatingStatus === "unrated") || null;
    const state = getImportState(options);
    updateImportState({
        ...state,
        currentMovieId: nextMovie?.id || null
    }, options);
    return nextMovies;
}

export function markImportedMovieSkipped(imdbId, options = {}) {
    const nextMovies = updateMovieRecord(imdbId, (movie) => ({
        ...movie,
        cozyRatingStatus: "skipped",
        skippedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }), options);
    const nextMovie = nextMovies.find((movie) => movie.cozyRatingStatus === "unrated") || null;
    const state = getImportState(options);
    updateImportState({
        ...state,
        currentMovieId: nextMovie?.id || null
    }, options);
    return nextMovies;
}

export function updateImportedMovieMetadata(imdbId, metadata = {}, options = {}) {
    const nextMovies = updateMovieRecord(imdbId, (movie) => ({
        ...movie,
        title: String(metadata.title || movie.title || "").trim() || movie.title,
        year: metadata.year ?? movie.year ?? null,
        genres: Array.isArray(metadata.genres) && metadata.genres.length ? metadata.genres : movie.genres,
        posterUrl: String(metadata.posterUrl || movie.posterUrl || "").trim(),
        runtimeMins: metadata.runtimeMins ?? movie.runtimeMins ?? null,
        updatedAt: new Date().toISOString()
    }), options);
    return nextMovies.find((movie) => movie.imdbId === imdbId) || null;
}

export function restoreSkippedMovies(options = {}) {
    const storage = getStorage(options.storage);
    const movies = getImportedMovies(options);
    const nextMovies = movies.map((movie) => ensureMovieRecord(movie.cozyRatingStatus === "skipped"
        ? {
            ...movie,
            cozyRatingStatus: "unrated",
            skippedAt: null,
            updatedAt: new Date().toISOString()
        }
        : movie));
    safeWriteJson(storage, STORAGE_KEYS.movies, nextMovies);
    const nextMovie = nextMovies.find((movie) => movie.cozyRatingStatus === "unrated") || null;
    const state = getImportState(options);
    updateImportState({
        ...state,
        currentMovieId: nextMovie?.id || null
    }, options);
    return nextMovies;
}

export function clearImportBatch(options = {}) {
    const storage = getStorage(options.storage);
    if (!storage) {
        return;
    }
    storage.removeItem(STORAGE_KEYS.batch);
    storage.removeItem(STORAGE_KEYS.movies);
    storage.removeItem(STORAGE_KEYS.state);
}
