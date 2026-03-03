const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DEFAULT_SQLITE_PATH = path.resolve(__dirname, "../../movie_fun_dev.sqlite");
const SQLITE_DB_PATH = String(process.env.SQLITE_DB_PATH || DEFAULT_SQLITE_PATH).trim() || DEFAULT_SQLITE_PATH;

let dbInstance = null;

function ensureDb() {
    if (dbInstance) {
        return dbInstance;
    }

    const dir = path.dirname(SQLITE_DB_PATH);
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (error) {
            if (error?.code !== "EEXIST") {
                throw error;
            }
        }
    }

    const db = new DatabaseSync(SQLITE_DB_PATH);
    db.exec(`
        create table if not exists movie_coziness_ratings (
            imdb_id text primary key,
            coziness_score integer not null check (coziness_score between 1 and 10),
            updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
    `);
    db.exec(`
        create table if not exists movie_catalog (
            imdb_id text primary key,
            title text,
            release_year integer,
            poster_url text,
            primary_genre text,
            genres_json text,
            updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
    `);
    dbInstance = db;
    return dbInstance;
}

function normalizeRow(row) {
    if (!row) {
        return null;
    }
    return {
        imdbId: row.imdb_id,
        score: Number(row.coziness_score),
        updatedAt: row.updated_at || null
    };
}

async function getCozinessRating(imdbId) {
    const db = ensureDb();
    const row = db
        .prepare(`
            select imdb_id, coziness_score, updated_at
            from movie_coziness_ratings
            where imdb_id = ?
            limit 1
        `)
        .get(imdbId);

    return normalizeRow(row);
}

async function getCozinessRatingsBatch(imdbIds) {
    const db = ensureDb();
    if (!Array.isArray(imdbIds) || !imdbIds.length) {
        return {};
    }

    const placeholders = imdbIds.map(() => "?").join(", ");
    const rows = db
        .prepare(`
            select imdb_id, coziness_score, updated_at
            from movie_coziness_ratings
            where imdb_id in (${placeholders})
        `)
        .all(...imdbIds);

    const map = {};
    for (const row of rows) {
        const normalized = normalizeRow(row);
        if (normalized?.imdbId) {
            map[normalized.imdbId] = normalized;
        }
    }
    return map;
}

async function upsertCozinessRating(imdbId, score) {
    const db = ensureDb();
    db.prepare(`
        insert into movie_coziness_ratings (imdb_id, coziness_score, updated_at)
        values (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        on conflict(imdb_id) do update set
            coziness_score = excluded.coziness_score,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(imdbId, score);

    return getCozinessRating(imdbId);
}

function normalizeGenreList(genres) {
    if (!Array.isArray(genres)) {
        return [];
    }
    return genres
        .map((genre) => String(genre || "").trim())
        .filter(Boolean)
        .slice(0, 8);
}

function toNullableNumber(value) {
    const numeric = Number(value);
    return Number.isInteger(numeric) ? numeric : null;
}

function getPrimaryGenre(movie) {
    const fromArray = normalizeGenreList(movie?.genres)[0];
    if (fromArray) {
        return fromArray;
    }
    const single = String(movie?.genre || "").trim();
    return single || "Uncategorized";
}

function upsertMovieMetadata(movie) {
    const imdbId = String(movie?.imdbId || "").trim();
    if (!imdbId) {
        return;
    }

    const db = ensureDb();
    const title = String(movie?.title || "").trim() || null;
    const releaseYear = toNullableNumber(movie?.year);
    const posterUrl = String(movie?.posterUrl || "").trim() || null;
    const genres = normalizeGenreList(movie?.genres);
    const primaryGenre = getPrimaryGenre(movie);

    db.prepare(`
        insert into movie_catalog (
            imdb_id, title, release_year, poster_url, primary_genre, genres_json, updated_at
        )
        values (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        on conflict(imdb_id) do update set
            title = coalesce(excluded.title, movie_catalog.title),
            release_year = coalesce(excluded.release_year, movie_catalog.release_year),
            poster_url = coalesce(excluded.poster_url, movie_catalog.poster_url),
            primary_genre = coalesce(excluded.primary_genre, movie_catalog.primary_genre),
            genres_json = case
                when excluded.genres_json is not null and excluded.genres_json != '[]' then excluded.genres_json
                else movie_catalog.genres_json
            end,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(
        imdbId,
        title,
        releaseYear,
        posterUrl,
        primaryGenre,
        genres.length ? JSON.stringify(genres) : null
    );
}

async function getLeaderboard(options = {}) {
    const db = ensureDb();
    const genre = String(options?.genre || "all").trim();
    const sortOrder = String(options?.sortOrder || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc";
    const applyGenreFilter = genre && genre.toLowerCase() !== "all";

    const rows = db.prepare(`
        select
            r.imdb_id as imdb_id,
            r.coziness_score as coziness_score,
            r.updated_at as updated_at,
            m.title as title,
            m.release_year as release_year,
            m.poster_url as poster_url,
            m.primary_genre as genre
        from movie_coziness_ratings r
        left join movie_catalog m on m.imdb_id = r.imdb_id
        ${applyGenreFilter ? "where lower(coalesce(m.primary_genre, '')) = lower(?)" : ""}
        order by
            r.coziness_score ${sortOrder === "asc" ? "asc" : "desc"},
            coalesce(m.title, r.imdb_id) asc
    `).all(...(applyGenreFilter ? [genre] : []));

    const rankedItems = rows.map((row, index) => ({
        rank: index + 1,
        imdbId: row.imdb_id,
        title: row.title || row.imdb_id,
        year: row.release_year || null,
        posterUrl: row.poster_url || "",
        genre: row.genre || null,
        score: Number(row.coziness_score),
        updatedAt: row.updated_at || null
    }));

    const genreRows = db.prepare(`
        select distinct m.primary_genre as genre
        from movie_coziness_ratings r
        left join movie_catalog m on m.imdb_id = r.imdb_id
        where m.primary_genre is not null and trim(m.primary_genre) != ''
        order by m.primary_genre asc
    `).all();

    const availableGenres = genreRows.map((row) => String(row.genre || "").trim()).filter(Boolean);

    return {
        items: rankedItems,
        availableGenres
    };
}

module.exports = {
    getCozinessRating,
    getCozinessRatingsBatch,
    upsertCozinessRating,
    upsertMovieMetadata,
    getLeaderboard
};
