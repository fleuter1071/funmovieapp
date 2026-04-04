const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page, request, baseURL }) => {
    await request.post(`${baseURL}/__e2e/reset`);
    await page.route("https://www.googletagmanager.com/**", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/javascript",
            body: ""
        });
    });
});

async function runSearch(page, query = "Scream") {
    await page.goto("/");
    await page.getByLabel("Movie title").fill(query);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator(".movie-card")).toHaveCount(2);
    await expect(page.locator("#resultsMeta")).toContainText("2 results found");
}

test("search renders cards, trailer opens, streaming expands, and cozy score saves", async ({ page }) => {
    await runSearch(page);

    const screamCard = page.locator(".movie-card").filter({ has: page.getByText("Scream") });
    await expect(screamCard.getByText("IMDb 7.4")).toBeVisible();
    await expect(screamCard.getByText("79%")).toBeVisible();

    const popupPromise = page.waitForEvent("popup");
    await screamCard.getByRole("button", { name: "Watch Trailer" }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await expect(popup).toHaveURL(/\/__e2e\/trailer\/tt0117571$/);

    await screamCard.getByRole("button", { name: "Where to Watch" }).click();
    await expect(screamCard.getByText("Smart Watch Options:")).toBeVisible();
    await expect(screamCard.locator(".provider-item", { hasText: "Netflix" })).toBeVisible();
    await expect(screamCard.locator(".provider-item", { hasText: "Apple TV Store" })).toBeVisible();

    await screamCard.getByRole("button", { name: /Cozy/i }).click();
    await screamCard.locator('.cozy-chip[data-score="9"]').click();
    await screamCard.getByRole("button", { name: "Save rating" }).click();
    await expect(screamCard.getByText("Saved")).toBeVisible();
    await expect(screamCard.getByRole("button", { name: /Cozy Rating: 9\/10/i })).toBeVisible();
});

test("My Services filters results down to included matches", async ({ page }) => {
    await runSearch(page);

    await page.getByRole("button", { name: "My Services" }).click();
    await page.locator('button[data-service-key="netflix"]').click();
    await page.getByRole("button", { name: "Done" }).click();

    await expect(page.locator("#includedOnlyWrap")).toBeVisible();
    await page.locator("#includedOnlyInput").check();

    const visibleCards = page.locator(".movie-card:visible");
    await expect(visibleCards).toHaveCount(1);
    await expect(visibleCards.getByText("Scream")).toBeVisible();
    await expect(page.getByText("On Netflix")).toBeVisible();
    await expect(page.locator("#resultsMeta")).toContainText("1 included match");
});

test("leaderboard loads, filters by genre, and re-sorts", async ({ page }) => {
    await runSearch(page);

    const screamCard = page.locator(".movie-card").filter({ has: page.getByText("Scream") });
    await screamCard.getByRole("button", { name: /Cozy/i }).click();
    await screamCard.locator('.cozy-chip[data-score="9"]').click();
    await screamCard.getByRole("button", { name: "Save rating" }).click();
    await expect(screamCard.getByText("Saved")).toBeVisible();

    await page.getByRole("button", { name: "Leaderboard" }).click();
    await expect(page.locator(".leaderboard-row")).toHaveCount(2);
    await expect(page.locator(".leaderboard-row").first()).toContainText("Scream");
    await expect(page.locator(".leaderboard-row").first()).toContainText("Cozy 9/10");

    await page.locator("#leaderboardGenre").selectOption("Comedy");
    await expect(page.locator(".leaderboard-row")).toHaveCount(1);
    await expect(page.locator(".leaderboard-row").first()).toContainText("Groundhog Day");

    await page.locator("#leaderboardGenre").selectOption("all");
    await page.locator("#leaderboardSort").selectOption("asc");
    await expect(page.locator(".leaderboard-row")).toHaveCount(2);
    await expect(page.locator(".leaderboard-row").first()).toContainText("Groundhog Day");
});
