import { expect, test, type Page } from "@playwright/test";
import { istDate, login, randomMobile, uniq, USERS } from "./helpers";

const paise = async (page: Page, testId: string) => {
  const text = (await page.getByTestId(testId).textContent()) ?? "";
  const m = /₹([\d,]+(?:\.\d{2})?)/.exec(text);
  return m ? Math.round(Number(m[1].replace(/,/g, "")) * 100) : 0;
};

test("owner sees overdue bookings and today's collections by mode and staff", async ({
  page,
}, testInfo) => {
  // Exact before/after totals on Tenant B: run once.
  test.skip(testInfo.project.name !== "desktop", "runs once, in the desktop project");
  await login(page, USERS.adminB);
  await page.goto("/reports");
  const before = {
    today: await paise(page, "collected-today"),
    range: await paise(page, "range-total"),
    discounts: await paise(page, "discount-total"),
  };

  // Overdue by 1 day: 2 folding chairs × ₹12 × 4 days = ₹96.
  const name = `E2E Report ${uniq()}`;
  await page.goto("/bookings/new");
  await page.getByRole("button", { name: "New customer" }).click();
  await page.getByLabel("Customer name").fill(name);
  await page.getByLabel("Mobile number").fill(randomMobile());
  await page.getByLabel("Start date").fill(istDate(-3));
  await page.getByLabel("Return date").fill(istDate(-1));
  await page.getByLabel("Search items").fill("Folding chair");
  await page.getByLabel("Quantity of Folding chair").fill("2");
  await page.getByRole("button", { name: "Save booking" }).click();
  await expect(page.getByText("Booking saved.")).toBeVisible();

  await page.getByTestId("section-payment").locator("summary").click();
  await page.getByLabel("Amount received ₹").fill("50");
  await page.getByRole("button", { name: "UPI", exact: true }).click();
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Payment recorded.")).toBeVisible();

  await page.getByTestId("section-discount").locator("summary").click();
  await page.getByRole("button", { name: "₹ off" }).click();
  await page.getByLabel("Discount amount in rupees").fill("10");
  await page.getByRole("button", { name: "Save discount" }).click();
  await expect(page.getByText("Discount updated.")).toBeVisible();

  await page.goto("/reports");
  expect(await paise(page, "collected-today")).toBe(before.today + 5000);
  expect(await paise(page, "range-total")).toBe(before.range + 5000);
  expect(await paise(page, "discount-total")).toBe(before.discounts + 1000);
  await expect(page.getByTestId("today-by-mode")).toContainText("UPI");
  await expect(page.getByTestId("today-by-staff")).toContainText("Demo Owner B");
  await expect(page.getByTestId("discounts-by-staff")).toContainText("Demo Owner B");

  // ₹96 − ₹10 discount − ₹50 paid = ₹36, listed as overdue.
  const row = page.getByTestId("report-overdue").getByRole("link").filter({ hasText: name });
  await expect(row).toContainText("1 day overdue");
  await expect(row).toContainText("₹36");
});

test("reports only ever show your own business", async ({ page }) => {
  await login(page, USERS.adminA);
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByTestId("report-open")).toContainText("Demo Customer Ravi");
  await expect(page.getByText("Demo Customer Imran")).toHaveCount(0);
  await expect(page.getByText("Demo Owner B")).toHaveCount(0);

  await page.context().clearCookies();
  await login(page, USERS.adminB);
  await page.goto("/reports");
  await expect(page.getByRole("main")).toContainText("Demo Customer Imran");
  await expect(page.getByText("Demo Customer Ravi")).toHaveCount(0);
});

test("date range can be changed", async ({ page }) => {
  await login(page, USERS.adminA);
  await page.goto(`/reports?from=${istDate(-7)}&to=${istDate(0)}`);
  await expect(page.getByLabel("From")).toHaveValue(istDate(-7));
  await expect(page.getByTestId("range-total")).toBeVisible();
});

test("staff cannot open reports", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/no-access$/);
});
