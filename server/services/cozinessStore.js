const supabaseService = require("./cozinessService");
const sqliteService = require("./cozinessSqliteService");

function hasSupabaseConfig() {
    return Boolean(String(process.env.SUPABASE_URL || "").trim() && String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim());
}

function shouldUseSqlite() {
    const storeOverride = String(process.env.COZINESS_STORE || "").trim().toLowerCase();
    if (storeOverride === "sqlite") {
        return true;
    }
    if (storeOverride === "supabase") {
        return false;
    }
    return String(process.env.NODE_ENV || "").trim().toLowerCase() === "development";
}

function getStore() {
    if (shouldUseSqlite()) {
        return sqliteService;
    }
    if (hasSupabaseConfig()) {
        return supabaseService;
    }
    return sqliteService;
}

async function getCozinessRating(imdbId, ctx) {
    return getStore().getCozinessRating(imdbId, ctx);
}

async function getCozinessRatingsBatch(imdbIds, ctx) {
    return getStore().getCozinessRatingsBatch(imdbIds, ctx);
}

async function upsertCozinessRating(imdbId, score, ctx) {
    return getStore().upsertCozinessRating(imdbId, score, ctx);
}

module.exports = {
    getCozinessRating,
    getCozinessRatingsBatch,
    upsertCozinessRating
};
