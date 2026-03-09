import test from "node:test";
import assert from "node:assert/strict";
import {
    getMatchBadgeText,
    getMatchingServiceLabels,
    isIncludedAvailabilityType,
    normalizeServiceKey,
    sanitizeSelectedServiceKeys
} from "../src/features/myServices.mjs";

test("normalizeServiceKey maps common provider aliases to curated keys", () => {
    assert.equal(normalizeServiceKey("Disney Plus"), "disney-plus");
    assert.equal(normalizeServiceKey("Paramount Plus"), "paramount-plus");
    assert.equal(normalizeServiceKey("Amazon Video"), "prime-video");
    assert.equal(normalizeServiceKey("Peacock Premium"), "peacock");
});

test("sanitizeSelectedServiceKeys removes duplicates and unknown values", () => {
    assert.deepEqual(
        sanitizeSelectedServiceKeys(["Netflix", "netflix", "unknown-service", "Max"]),
        ["netflix", "max"]
    );
});

test("isIncludedAvailabilityType excludes rent and buy", () => {
    assert.equal(isIncludedAvailabilityType("stream"), true);
    assert.equal(isIncludedAvailabilityType("subscription"), true);
    assert.equal(isIncludedAvailabilityType("free"), true);
    assert.equal(isIncludedAvailabilityType("rent"), false);
    assert.equal(isIncludedAvailabilityType("buy"), false);
});

test("matching only counts included providers on selected services", () => {
    const providers = [
        { name: "Netflix", availabilityType: "stream" },
        { name: "Prime Video", availabilityType: "rent" },
        { name: "Max", availabilityType: "subscription" }
    ];

    assert.deepEqual(getMatchingServiceLabels(providers, ["netflix", "prime-video", "max"]), ["Netflix", "Max"]);
    assert.equal(getMatchBadgeText(providers, ["netflix", "prime-video", "max"]), "On Netflix + Max");
});
