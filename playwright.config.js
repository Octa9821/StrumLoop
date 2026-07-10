const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  timeout: 20000,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "node tests/server.js",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
