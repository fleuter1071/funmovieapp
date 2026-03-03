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

module.exports = {
    getCozinessRating,
    getCozinessRatingsBatch,
    upsertCozinessRating
};
