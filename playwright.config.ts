import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.test", override: true, quiet: true });
process.env.EVIDENTIA_TEST_SERVER = "1";
process.env.OPENAI_API_KEY = "";
process.env.BETTER_AUTH_URL = "http://localhost:3100";
process.env.APP_BASE_URL = "http://localhost:3100";
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: join(tmpdir(), "evidentia-playwright"),
  workers: 1,
  expect: { timeout: 25000 },
  timeout: 180_000,
  use: { baseURL: "http://localhost:3100", headless: true },
  webServer: {
    command: "node scripts/test-server.mjs",
    url: "http://localhost:3100/api/health",
    timeout: 180_000,
  },
});
