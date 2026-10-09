import { devices, expect, test } from "@playwright/test";
import { waitForHydration } from "./helpers";

// Install-to-home-screen card and the minimal service worker.

test("the service worker and offline page load without signing in", async ({ request }) => {
  const sw = await request.get("/sw.js", { maxRedirects: 0 });
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toContain("javascript");
  expect(sw.headers()["cache-control"]).toContain("no-cache");
  expect(await sw.text()).toContain("rentcorp-offline");
  const offline = await request.get("/offline.html", { maxRedirects: 0 });
  expect(offline.status()).toBe(200);
  expect(await offline.text()).toContain("You’re offline");
});

test("Chrome: the install card opens the browser's install dialog", async ({ page }) => {
  await page.goto("/login");
  await waitForHydration(page);
  // Stand in for Chrome's own event (headless browsers never fire it).
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    e.prompt = async () => {
      (window as unknown as { prompted: boolean }).prompted = true;
    };
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
  const card = page.getByTestId("install-prompt");
  await expect(card).toContainText("Install RentCorp");
  await card.getByRole("button", { name: "Install" }).click();
  await expect(card).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(
    true,
  );
});

test("Chrome: closed means no card and no Chrome bar for 24 hours", async ({ page }) => {
  const fire = () =>
    page.evaluate(() => {
      const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string }>;
      };
      e.prompt = async () => {};
      e.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(e);
      return e.defaultPrevented; // true = Chrome's own bar is suppressed
    });
  await page.goto("/login");
  await waitForHydration(page);
  await fire();
  const card = page.getByTestId("install-prompt");
  await card.getByRole("button", { name: "Not now" }).click();
  await expect(card).toHaveCount(0);

  await page.reload();
  await waitForHydration(page);
  expect(await fire()).toBe(true);
  await page.waitForTimeout(2500);
  await expect(card).toHaveCount(0);

  // 24 hours later it may show again.
  await page.evaluate(() =>
    localStorage.setItem("install-prompt-dismissed-until", String(Date.now() - 1)),
  );
  await page.reload();
  await waitForHydration(page);
  await fire();
  await expect(card).toBeVisible();
});

test("iPhone: the card explains Add to Home Screen and stays closed once closed", async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "phone only");
  // Chromium with an iPhone screen and user agent (WebKit isn't installed).
  const iphone = devices["iPhone 13"];
  const context = await browser.newContext({
    userAgent: iphone.userAgent,
    viewport: iphone.viewport,
    deviceScaleFactor: iphone.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/login");
  const card = page.getByTestId("install-prompt");
  await expect(card).toContainText("Add to Home Screen");
  await expect(card.getByRole("button", { name: "Install" })).toHaveCount(0);
  await card.getByRole("button", { name: "Not now" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await waitForHydration(page);
  await page.waitForTimeout(2500);
  await expect(card).toHaveCount(0);
  await context.close();
});
