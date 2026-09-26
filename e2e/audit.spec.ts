import { expect, test } from "@playwright/test";
import { adminDb } from "./db-client";
import { istDate, login, randomMobile, uniq, USERS } from "./helpers";

test("every money and message action leaves an audit entry", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "runs once");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page, USERS.staffA);

  // Booking (with a new customer and a discount).
  await page.goto("/bookings/new");
  await page.getByRole("button", { name: "New customer" }).click();
  await page.getByLabel("Customer name").fill(`E2E Audit ${uniq()}`);
  await page.getByLabel("Mobile number").fill(randomMobile());
  await page.getByLabel("Start date").fill(istDate(-1));
  await page.getByLabel("Search items").fill("Round table");
  await page.getByLabel("Quantity of Round table").fill("1");
  await page.getByRole("button", { name: "₹ off" }).click();
  await page.getByLabel("Discount amount in rupees").fill("5");
  await page.getByRole("button", { name: "Save booking" }).click();
  const anyway = page.getByRole("button", { name: "Save anyway" });
  await expect(page.getByText("Booking saved.").or(anyway)).toBeVisible();
  if (await anyway.isVisible()) await anyway.click();
  await expect(page.getByText("Booking saved.")).toBeVisible();
  const orderId = /bookings\/([0-9a-f-]+)/.exec(page.url())![1];

  // Message copy, payment, discount change, return.
  const [logged] = await Promise.all([
    page.waitForResponse("**/api/message-log"),
    page
      .getByTestId("send-panel-BOOKING_CONFIRMATION")
      .getByRole("button", { name: "Copy" })
      .click(),
  ]);
  expect(logged.status()).toBe(200);
  await page.getByTestId("section-payment").locator("summary").click();
  await page.getByLabel("Amount received ₹").fill("100");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Payment recorded.")).toBeVisible();
  await page.getByTestId("section-discount").locator("summary").click();
  await page.getByLabel("Discount amount in rupees").fill("10");
  await page.getByRole("button", { name: "Save discount" }).click();
  await expect(page.getByText("Discount updated.")).toBeVisible();
  await page.getByTestId("section-return").locator("summary").click();
  await page.getByRole("button", { name: "Everything is back" }).click();
  await page.getByRole("button", { name: "Record return" }).click();
  await expect(page.getByText("All items are back.")).toBeVisible();

  const { data: rows, error } = await adminDb()
    .from("audit_logs")
    .select("action, user_id, tenant_id, target_id, metadata")
    .or(`target_id.eq.${orderId},metadata->>rental_order_id.eq.${orderId}`);
  expect(error).toBeNull();
  const actions = new Set(rows!.map((r) => r.action));
  for (const a of [
    "booking.created",
    "message.opened",
    "payment.recorded",
    "booking.discount_changed",
    "booking.returned",
  ]) {
    expect(actions, a).toContain(a);
  }
  // Every entry is attributed to the staff member and tenant A.
  for (const r of rows!) {
    expect(r.user_id).toBe("a0000000-0000-4000-8000-000000000002");
    expect(r.tenant_id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  }
  const discount = rows!.find((r) => r.action === "booking.discount_changed")!;
  expect(discount.metadata).toMatchObject({
    from: { type: "FLAT", value: 500 },
    to: { type: "FLAT", value: 1000 },
  });
});
