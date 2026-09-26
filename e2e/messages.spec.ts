import { expect, test, type Page } from "@playwright/test";
import { IDS, login, USERS } from "./helpers";

const BOOKING_B_SEED = "b3000000-0000-4000-8000-000000000001";

// Stop the sms: link from navigating in the test browser; the app's own
// click handler (which logs the tap) still runs.
async function neutraliseSmsLinks(page: Page) {
  await page.evaluate(() => {
    document.addEventListener(
      "click",
      (e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (a?.href.startsWith("sms:")) e.preventDefault();
      },
      true,
    );
  });
}

test.beforeEach(async ({ context }) => {
  // Never actually load WhatsApp.
  await context.route("https://wa.me/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>WhatsApp stub</p>" }),
  );
});

test("send amount due on WhatsApp opens a pre-filled chat and is logged", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto(`/bookings/${IDS.bookingA_seed}`);
  const panel = page.getByTestId("send-panel-AMOUNT_DUE");
  const amount = (await page.getByTestId("amount-due").textContent())!.trim();
  await expect(panel.getByTestId("message-preview")).toContainText(amount);
  await expect(panel.getByTestId("message-preview")).toContainText("Booking #1");

  const [popup, logged] = await Promise.all([
    page.waitForEvent("popup"),
    page.waitForResponse("**/api/message-log"),
    panel.getByRole("link", { name: "Send on WhatsApp" }).click(),
  ]);
  expect(logged.status()).toBe(200);
  const url = new URL(popup.url());
  expect(url.origin + url.pathname).toBe("https://wa.me/919111111101");
  expect(url.searchParams.get("text")).toContain(amount);
  await expect(panel.getByRole("status")).toContainText("Opened in WhatsApp");
  await expect(panel.getByRole("status")).not.toContainText("Delivered");

  await page.reload();
  await expect(page.getByTestId("message-log")).toContainText("Amount due · opened in WhatsApp");
  await expect(page.getByTestId("message-log")).toContainText("Demo Staff A");
});

test("SMS link uses Rs., the right format for the phone, and is logged", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto(`/bookings/${IDS.bookingA_seed}`);
  await neutraliseSmsLinks(page);
  const panel = page.getByTestId("send-panel-AMOUNT_DUE");
  const sms = panel.getByRole("link", { name: "Send SMS" });
  const href = (await sms.getAttribute("href"))!;
  // Test browsers are Android/desktop Chrome: `?body=`.
  expect(href).toMatch(/^sms:\+919111111101\?body=/);
  const body = decodeURIComponent(href.split("body=")[1]);
  expect(body).toContain("Rs.");
  expect(body).not.toContain("₹");

  const [logged] = await Promise.all([page.waitForResponse("**/api/message-log"), sms.click()]);
  expect(logged.status()).toBe(200);
  await expect(panel.getByRole("status")).toContainText("Opened in SMS");
  await page.reload();
  await expect(page.getByTestId("message-log")).toContainText("Amount due · opened in SMS");
});

test("copy puts the exact text on the clipboard and logs it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page, USERS.staffA);
  await page.goto(`/bookings/${IDS.bookingA_seed}`);
  const panel = page.getByTestId("send-panel-AMOUNT_DUE");
  const preview = (await panel.getByTestId("message-preview").textContent())!;
  const [logged] = await Promise.all([
    page.waitForResponse("**/api/message-log"),
    panel.getByRole("button", { name: "Copy" }).click(),
  ]);
  expect(logged.status()).toBe(200);
  await expect(panel.getByRole("status")).toContainText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(preview);
  await page.reload();
  await expect(page.getByTestId("message-log")).toContainText("Amount due · copied");
});

test("a new booking offers its itemized confirmation; SMS-only customers get no WhatsApp", async ({
  page,
}) => {
  await login(page, USERS.staffA);
  await page.goto("/bookings/new");
  await page.getByLabel("Find customer").fill("Demo Customer Sunita");
  await page
    .getByRole("button", { name: /Demo Customer Sunita/ })
    .first()
    .click();
  await page.getByLabel("Search items").fill("Round table");
  await page.getByLabel("Quantity of Round table").fill("4");
  await page.getByRole("button", { name: "Save booking" }).click();
  await expect(page.getByText("Booking saved.")).toBeVisible();

  const panel = page.getByTestId("send-panel-BOOKING_CONFIRMATION");
  await expect(panel).toBeVisible();
  // Sunita isn't on WhatsApp, so the SMS text is shown and WhatsApp is off.
  await expect(panel.getByRole("link", { name: "Send on WhatsApp" })).toHaveCount(0);
  await expect(panel.getByText("Not on WhatsApp")).toBeVisible();
  await expect(panel.getByTestId("message-preview")).toContainText(
    "- Round table: 4 x Rs.150/piece per day x 1 day = Rs.600",
  );
  await expect(panel.getByTestId("message-preview")).toContainText("Total: Rs.600");
});

test("cannot log a message for another business's booking", async ({ page, request }) => {
  await login(page, USERS.adminB);
  const res = await page.request.post("/api/message-log", {
    data: { orderId: IDS.bookingA_seed, type: "AMOUNT_DUE", channel: "COPY", body: "forged" },
  });
  expect(res.status()).toBe(404);

  // Signed out (the `request` fixture has no cookies): refused, not logged.
  const anon = await request.post("/api/message-log", {
    data: { orderId: IDS.bookingA_seed, type: "AMOUNT_DUE", channel: "COPY", body: "anon" },
    maxRedirects: 0,
  });
  expect([401, 403, 307]).toContain(anon.status());
});

test("owner edits message wording; it's used in the send panel", async ({ page }, testInfo) => {
  // Mutates Tenant B's shared wording: run once.
  test.skip(testInfo.project.name !== "desktop", "runs once, in the desktop project");
  await login(page, USERS.adminB);
  await page.goto("/settings");
  await page.getByRole("link", { name: /Message wording/ }).click();
  const editor = page.getByTestId("template-AMOUNT_DUE");
  await editor
    .getByRole("textbox")
    .fill("Namaste {customer}, please pay {amount_due}. - {business}");
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor.getByText("Saved.")).toBeVisible();

  try {
    await page.goto(`/bookings/${BOOKING_B_SEED}`);
    await expect(
      page.getByTestId("send-panel-AMOUNT_DUE").getByTestId("message-preview"),
    ).toHaveText(/^Namaste Demo Customer Imran, please pay ₹[\d,]+\. - Demo Tent House B$/);
  } finally {
    await page.goto("/settings/messages");
    await page
      .getByTestId("template-AMOUNT_DUE")
      .getByRole("button", { name: "Reset to default" })
      .click();
    await expect(
      page.getByTestId("template-AMOUNT_DUE").getByText("Back to the default wording."),
    ).toBeVisible();
  }
});

test("staff cannot change message wording", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto("/settings/messages");
  await expect(page).toHaveURL(/\/no-access$/);
});
