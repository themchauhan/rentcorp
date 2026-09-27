import { expect, test } from "@playwright/test";
import { login, USERS } from "./helpers";

test("signed-in home page renders inside the app shell", async ({ page }) => {
  await login(page, USERS.staffA);
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
});

test("navigating to Bookings highlights it in the nav", async ({ page }) => {
  await login(page, USERS.staffA);
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Bookings" }).click();
  await expect(page).toHaveURL(/\/bookings$/);
  await expect(page.getByRole("heading", { level: 1, name: "Bookings" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Bookings" })).toHaveAttribute("aria-current", "page");
});

test("unknown routes show the 404 page", async ({ page }) => {
  await login(page, USERS.staffA);
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("web app manifest is served for Add to Home Screen", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
});

test("pages never scroll sideways", async ({ page }) => {
  for (const path of ["/login"]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await login(page, USERS.adminA);
  for (const path of [
    "/",
    "/more",
    "/settings",
    "/bookings",
    "/bookings/new",
    "/items",
    "/customers",
  ]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("pages opened from More keep More highlighted and have a back link", async ({ page }) => {
  await login(page, USERS.adminA);
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const path of ["/reports", "/team", "/settings", "/more/password"]) {
    await page.goto(path);
    await expect(nav.getByRole("link", { name: "More" }), path).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.getByRole("main").getByRole("link", { name: "← More" }).click();
    await expect(page).toHaveURL(/\/more$/);
  }
});

test("login mobile field shows a plain hint, not a fake number", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Mobile number")).toHaveAttribute(
    "placeholder",
    "Enter your mobile number",
  );
});
