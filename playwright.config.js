const { defineConfig } = require("@playwright/test");

const PORT = process.env.PORT || "3200";
const BASE_URL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
    testDir: "./test/e2e",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: "list",
    use: {
        baseURL: BASE_URL,
        headless: true,
        screenshot: "only-on-failure",
        trace: "retain-on-failure"
    },
    webServer: {
        command: "node test/e2e/mockServer.js",
        url: BASE_URL,
        reuseExistingServer: false,
        stdout: "pipe",
        stderr: "pipe",
        env: {
            ...process.env,
            PORT
        }
    }
});
