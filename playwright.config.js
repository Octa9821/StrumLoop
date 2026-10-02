const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  timeout: 20000,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", testIgnore: ["**/accent-mobile.spec.js", "**/accent-webkit.spec.js"] },
    { name: "mobile-390", testMatch: "**/accent-mobile.spec.js", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "mobile-412", testMatch: "**/accent-mobile.spec.js", use: { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } },
    { name: "mobile-webkit", testMatch: "**/accent-webkit.spec.js", use: { browserName: "webkit", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "node tests/server.js",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
