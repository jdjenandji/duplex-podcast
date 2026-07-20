import { defineConfig } from "@playwright/test";
import chromium from "@sparticuz/chromium";
import { mkdirSync } from "node:fs";

// The packaged browser can reuse the sandbox's writable font directory.
mkdirSync("/tmp/fonts", { recursive: true });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 4,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true,
    launchOptions: {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
    },
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
