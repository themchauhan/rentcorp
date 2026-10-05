import { defineConfig, devices } from "@playwright/test";
import { E2E_WHATSAPP, MOCK_GRAPH_PORT } from "./e2e/whatsapp-env";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
const MOCK_PORT = MOCK_GRAPH_PORT;
// Test-only WhatsApp settings (the app reads them at runtime).
const E2E_ENV = [
  "INSECURE_COOKIES=1",
  `WHATSAPP_API_BASE_URL=${E2E_WHATSAPP.mockUrl}`,
  `WHATSAPP_APP_SECRET=${E2E_WHATSAPP.appSecret}`,
  `WHATSAPP_WEBHOOK_VERIFY_TOKEN=${E2E_WHATSAPP.verifyToken}`,
  `CRON_SECRET=${E2E_WHATSAPP.cronSecret}`,
].join(" ");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Local Supabase in Docker can be slow on first requests.
  expect: { timeout: 15_000 },
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "on-first-retry" },
  // Phone first (rule 10), then desktop. Both run on Chromium so CI only
  // needs one browser download.
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  // Runs against a production build, which is what users get. CI has
  // already built in an earlier step, so it only starts the server.
  // A mock of Meta's Graph API stands in for WhatsApp.
  webServer: [
    {
      command: `MOCK_GRAPH_PORT=${MOCK_PORT} node e2e/mock-graph.mjs`,
      url: `http://localhost:${MOCK_PORT}/__health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Plain http on localhost, so session cookies can't be Secure here.
      command: `${process.env.CI ? "" : "npm run build && "}${E2E_ENV} npx next start -p ${PORT}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
