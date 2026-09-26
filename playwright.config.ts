import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

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
  webServer: {
    // Plain http on localhost, so session cookies can't be Secure here.
    command: process.env.CI
      ? `INSECURE_COOKIES=1 npx next start -p ${PORT}`
      : `npm run build && INSECURE_COOKIES=1 npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
