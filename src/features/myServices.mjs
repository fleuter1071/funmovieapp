export const SELECTED_STREAMING_SERVICES_KEY = "selectedStreamingServices";
export const INCLUDED_ONLY_FILTER_ENABLED_KEY = "includedOnlyFilterEnabled";

export const CURATED_STREAMING_SERVICES = [
    { key: "netflix", label: "Netflix", aliases: ["netflix"] },
    { key: "max", label: "Max", aliases: ["max", "hbo max"] },
    { key: "hulu", label: "Hulu", aliases: ["hulu"] },
    { key: "prime-video", label: "Prime Video", aliases: ["prime video", "amazon video", "amazon prime video"] },
    { key: "disney-plus", label: "Disney+", aliases: ["disney plus", "disney+"] },
    { key: "paramount-plus", label: "Paramount+", aliases: ["paramount plus", "paramount+"] },
    { key: "peacock", label: "Peacock", aliases: ["peacock", "peacock premium"] },
    { key: "apple-tv-plus", label: "Apple TV+", aliases: ["apple tv+", "apple tv plus"] },
    { key: "starz", label: "Starz", aliases: ["starz"] },
    { key: "criterion-channel", label: "Criterion Channel", aliases: ["criterion channel", "the criterion channel"] },
    { key: "shudder", label: "Shudder", aliases: ["shudder", "shudder amazon channel"] },
    { key: "mubi", label: "Mubi", aliases: ["mubi"] }
];

const SERVICE_KEY_BY_ALIAS = new Map();
const SERVICE_LABEL_BY_KEY = new Map();

CURATED_STREAMING_SERVICES.forEach((service) => {
    SERVICE_LABEL_BY_KEY.set(service.key, service.label);
    SERVICE_KEY_BY_ALIAS.set(normalizeProviderName(service.label), service.key);
    service.aliases.forEach((alias) => {
        SERVICE_KEY_BY_ALIAS.set(normalizeProviderName(alias), service.key);
    });
});

export function normalizeProviderName(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/\+/g, " plus ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

export function normalizeServiceKey(value) {
    const normalized = normalizeProviderName(value);
    return SERVICE_KEY_BY_ALIAS.get(normalized) || "";
}

export function getServiceLabel(serviceKey) {
    return SERVICE_LABEL_BY_KEY.get(String(serviceKey || "").trim()) || "";
}

export function isIncludedAvailabilityType(value) {
    const type = String(value || "").toLowerCase();
    return type === "stream" || type === "subscription" || type === "free";
}

export function sanitizeSelectedServiceKeys(value) {
    const keys = Array.isArray(value) ? value : [];
    const next = [];
    const seen = new Set();

    keys.forEach((entry) => {
        const key = normalizeServiceKey(entry) || String(entry || "").trim();
        if (!SERVICE_LABEL_BY_KEY.has(key) || seen.has(key)) {
            return;
        }
        seen.add(key);
        next.push(key);
    });

    return next;
}

export function getMatchingServiceLabels(providers, selectedServiceKeys) {
    const normalizedSelected = new Set(sanitizeSelectedServiceKeys(selectedServiceKeys));
    if (!normalizedSelected.size) {
        return [];
    }

    const matches = [];
    const seen = new Set();
    const list = Array.isArray(providers) ? providers : [];

    list.forEach((provider) => {
        const providerName = typeof provider === "string" ? provider : provider?.name;
        const availabilityType = typeof provider === "string" ? "stream" : provider?.availabilityType;
        if (!isIncludedAvailabilityType(availabilityType)) {
            return;
        }

        const key = normalizeServiceKey(providerName);
        if (!key || !normalizedSelected.has(key) || seen.has(key)) {
            return;
        }

        seen.add(key);
        matches.push(getServiceLabel(key));
    });

    return matches;
}

export function hasIncludedServiceMatch(providers, selectedServiceKeys) {
    return getMatchingServiceLabels(providers, selectedServiceKeys).length > 0;
}

export function getMatchBadgeText(providers, selectedServiceKeys) {
    const matches = getMatchingServiceLabels(providers, selectedServiceKeys);
    if (!matches.length) {
        return "";
    }
    if (matches.length === 1) {
        return `On ${matches[0]}`;
    }
    if (matches.length === 2) {
        return `On ${matches[0]} + ${matches[1]}`;
    }
    return "Included with your services";
}
