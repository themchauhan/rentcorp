import { expect, type Page } from "@playwright/test";
import { randomMobile, uniq } from "./helpers";

// Shared hostel / PG steps for the e2e specs.

export async function addRoom(page: Page, name: string, beds = 2, rent = "6000") {
  await page.goto("/rooms/new");
  await page.getByLabel("Room name or number").fill(name);
  await page.getByLabel("Floor (optional)").fill("E2E floor");
  await page.getByLabel(/Rent per bed, per month/).fill(rent);
  await page.getByLabel("Beds in this room").fill(String(beds));
  await page.getByRole("button", { name: "Save room" }).click();
  await expect(page).toHaveURL(/\/rooms$/);
  await expect(page.getByTestId("room-card").filter({ hasText: `Room ${name}` })).toBeVisible();
}

/** Moves a new resident into `Room <room> · Bed A`; returns the resident page URL. */
export async function moveIn(
  page: Page,
  room: string,
  opts: { name?: string; mobile?: string; start?: string; meal?: string; deposit?: string } = {},
) {
  const name = opts.name ?? `E2E Resident ${uniq()}`;
  await page.goto("/residents/new");
  const place = page.getByLabel("Bed or room");
  const value = await place
    .locator("option", { hasText: `Room ${room} · Bed A` })
    .getAttribute("value");
  await place.selectOption(value!);
  await page.getByLabel("Resident name").fill(name);
  await page.getByLabel("Mobile number").fill(opts.mobile ?? randomMobile());
  if (opts.start) await page.getByLabel(/Joining date/).fill(opts.start);
  if (opts.meal) {
    const meal = page.getByLabel("Meal plan");
    const v = await meal.locator("option", { hasText: opts.meal }).getAttribute("value");
    await meal.selectOption(v!);
  }
  await page.getByLabel("Security deposit agreed (₹)").fill(opts.deposit ?? "5000");
  await page.getByRole("button", { name: "Save move-in" }).click();
  await expect(page.getByText("Moved in.")).toBeVisible();
  return { name, url: page.url().replace(/\?.*$/, "") };
}
