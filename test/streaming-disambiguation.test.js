const test = require("node:test");
const assert = require("node:assert/strict");
const { buildStreamingCacheKey, buildStreamingQuery, pickBestDescription } = require("../server/services/imdbService");

test("buildStreamingCacheKey separates same-title movies by year and imdbId", () => {
    assert.equal(
        buildStreamingCacheKey({ imdbId: "tt0758746", title: "Friday the 13th", year: "2009" }),
        "tt0758746|friday the 13th|2009"
    );
    assert.equal(
        buildStreamingCacheKey({ imdbId: "tt0080761", title: "Friday the 13th", year: "1980" }),
        "tt0080761|friday the 13th|1980"
    );
});

test("buildStreamingQuery includes year for ambiguous same-title searches", () => {
    assert.equal(
        buildStreamingQuery({ imdbId: "tt0758746", title: "Friday the 13th", year: "2009" }),
        "Friday the 13th 2009"
    );
});

test("pickBestDescription prefers exact year when imdbId is unavailable in upstream rows", () => {
    const rows = [
        { title: "Friday the 13th", year: "1980", offers: [{ name: "Paramount+", url: "https://example.com/1980", type: "SUBSCRIPTION" }] },
        { title: "Friday the 13th", year: "2009", offers: [{ name: "Peacock Premium", url: "https://example.com/2009", type: "SUBSCRIPTION" }] }
    ];

    const selected = pickBestDescription(rows, "", "Friday the 13th", "2009");
    assert.equal(selected.year, "2009");
    assert.equal(selected.offers[0].name, "Peacock Premium");
});
