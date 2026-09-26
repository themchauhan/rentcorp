import { expect, test } from "@playwright/test";
import { IDS, login, USERS } from "./helpers";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

test("a running booking shows today's amount due", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto(`/bookings/${IDS.bookingA_seed}`);

  // Seed booking: 100 chairs at ₹10/day + 1 shamiana at ₹1,500/event,
  // starting on the day the database was seeded.
  const daysText = await page.getByTestId("days-so-far").textContent();
  const day = Number(/Day (\d+)/.exec(daysText ?? "")?.[1]);
  expect(day).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("amount-due")).toHaveText(rupees(1000 * day + 1500));
  await expect(page.getByText("Charges so far")).toBeVisible();

  // The list shows the same figure.
  await page.goto("/bookings?q=1");
  await expect(page.getByTestId("booking-row").first()).toContainText(rupees(1000 * day + 1500));
  await expect(page.getByTestId("booking-row").first()).toContainText("due today");
});

test("a booking that hasn't started owes nothing yet", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto("/bookings/new");
  await page.getByLabel("Find customer").fill("Demo Customer Sunita");
  await page
    .getByRole("button", { name: /Demo Customer Sunita/ })
    .first()
    .click();
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(Date.now() + 86_400_000),
  );
  await page.getByLabel("Start date").fill(tomorrow);
  await page.getByLabel("Search items").fill("Plastic chair");
  await page.getByLabel("Quantity of Plastic chair").fill("1");
  await page.getByRole("button", { name: "Save booking" }).click();
  await expect(page.getByText("Booking saved.")).toBeVisible();

  await expect(page.getByTestId("amount-due")).toHaveText("₹0");
  await expect(page.getByText("Nothing is due yet.")).toBeVisible();
  await expect(page.getByTestId("booking-total")).toHaveText("₹10");
});
