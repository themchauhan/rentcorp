import { expect, test } from "@playwright/test";
import { IDS, istDate, login, randomMobile, uniq, USERS } from "./helpers";

test.beforeEach(async ({ context }) => {
  await context.route("https://wa.me/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>WhatsApp stub</p>" }),
  );
});

async function bookForNewCustomer(
  page: import("@playwright/test").Page,
  name: string,
  start: string,
  end: string,
) {
  await page.goto("/bookings/new");
  await page.getByRole("button", { name: "New customer" }).click();
  await page.getByLabel("Customer name").fill(name);
  await page.getByLabel("Mobile number").fill(randomMobile());
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("Return date").fill(end);
  await page.getByLabel("Search items").fill("Round table");
  await page.getByLabel("Quantity of Round table").fill("2");
  await page.getByRole("button", { name: "Save booking" }).click();
  // Repeated test runs can use up stock; the warning is expected then.
  const saved = page.getByText("Booking saved.");
  const saveAnyway = page.getByRole("button", { name: "Save anyway" });
  await expect(saved.or(saveAnyway)).toBeVisible();
  if (await saveAnyway.isVisible()) await saveAnyway.click();
  await expect(saved).toBeVisible();
}

test("home lists what's out now with today's amount due, only for this business", async ({
  page,
}) => {
  await login(page, USERS.staffA);
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  const row = page
    .getByTestId("home-row")
    .filter({ has: page.locator(`a[href="/bookings/${IDS.bookingA_seed}"]`) });
  await expect(row).toContainText("due today");
  await expect(row).toContainText("100 Plastic chair");
  await expect(page.getByText("Demo Customer Imran")).toHaveCount(0);

  await page.context().clearCookies();
  await login(page, USERS.adminB);
  await expect(
    page.getByTestId("home-row").filter({ hasText: "Demo Customer Imran" }),
  ).toBeVisible();
  await expect(page.getByText("Demo Customer Ravi")).toHaveCount(0);
});

test("overdue bookings come first and are marked", async ({ page }) => {
  const name = `E2E Late ${uniq()}`;
  await login(page, USERS.staffA);
  await bookForNewCustomer(page, name, istDate(-5), istDate(-2));
  await expect(page.getByText("2 days overdue")).toBeVisible(); // on the booking page

  await page.goto("/");
  const row = page.getByTestId("home-row").filter({ hasText: name });
  await expect(row.getByTestId("overdue-label")).toHaveText("2 days overdue");
  await expect(row).toContainText("Overdue");
  // The first row on Home is an overdue one.
  await expect(page.getByTestId("home-row").first().getByTestId("overdue-label")).toBeVisible();
  // Overdue is also shown in the bookings list.
  await page.goto(`/bookings?q=${encodeURIComponent(name)}`);
  await expect(page.getByTestId("booking-row").first()).toContainText("Overdue");
});

test("send amount due from home in two taps; row then shows messaged today", async ({ page }) => {
  const name = `E2E Remind ${uniq()}`;
  await login(page, USERS.staffA);
  await bookForNewCustomer(page, name, istDate(0), istDate(2));

  await page.goto("/");
  const row = page.getByTestId("home-row").filter({ hasText: name });
  await expect(row.getByTestId("last-messaged")).toHaveText("Not messaged yet");
  await row.getByText("Send amount due").click(); // tap 1
  const [popup, logged] = await Promise.all([
    page.waitForEvent("popup"),
    page.waitForResponse("**/api/message-log"),
    row.getByRole("link", { name: "Send on WhatsApp" }).click(), // tap 2
  ]);
  expect(popup.url()).toContain("https://wa.me/91");
  expect(logged.status()).toBe(200);

  await page.reload();
  await expect(
    page.getByTestId("home-row").filter({ hasText: name }).getByTestId("last-messaged"),
  ).toContainText("Messaged today");
});

test("bookings starting in the next few days are listed separately", async ({ page }) => {
  const name = `E2E Soon ${uniq()}`;
  await login(page, USERS.staffA);
  await bookForNewCustomer(page, name, istDate(1), istDate(2));
  await page.goto("/");
  await expect(page.getByTestId("upcoming-row").filter({ hasText: name })).toContainText("planned");
  await expect(page.getByTestId("home-row").filter({ hasText: name })).toHaveCount(0);
});

test("manifest offers a New booking shortcut", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toContain("/bookings/new");
  expect(manifest.lang).toBe("en-IN");
});
