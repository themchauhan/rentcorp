import { expect, test, type Page } from "@playwright/test";
import { IDS, istDate, login, randomMobile, uniq, USERS } from "./helpers";

async function newBooking(
  page: Page,
  { start, end, items }: { start: string; end: string; items: [string, number][] },
) {
  const name = `E2E Bill ${uniq()}`;
  await page.goto("/bookings/new");
  await page.getByRole("button", { name: "New customer" }).click();
  await page.getByLabel("Customer name").fill(name);
  await page.getByLabel("Mobile number").fill(randomMobile());
  await page.getByLabel("Start date").fill(start);
  await page.getByLabel("Return date").fill(end);
  for (const [item, qty] of items) {
    await page.getByLabel("Search items").fill(item);
    await page.getByLabel(`Quantity of ${item}`).fill(String(qty));
  }
  await page.getByRole("button", { name: "Save booking" }).click();
  const saved = page.getByText("Booking saved.");
  const anyway = page.getByRole("button", { name: "Save anyway" });
  await expect(saved.or(anyway)).toBeVisible();
  if (await anyway.isVisible()) await anyway.click();
  await expect(saved).toBeVisible();
  return { name, url: page.url().replace("?created=1", "") };
}

async function open(page: Page, section: string) {
  const s = page.getByTestId(section);
  if (!(await s.evaluate((el) => (el as HTMLDetailsElement).open)))
    await s.locator("summary").click();
  return s;
}

async function pay(page: Page, amount: string, mode = "Cash") {
  const s = await open(page, "section-payment");
  await s.getByLabel("Amount received ₹").fill(amount);
  await s.getByRole("button", { name: mode, exact: true }).click();
  await s.getByRole("button", { name: "Record payment" }).click();
  await expect(s.getByText("Payment recorded.")).toBeVisible();
}

const due = (page: Page) => page.getByTestId("amount-due");

test("active → partial return → discount → full return → paid → closed, with a paper trail", async ({
  page,
}) => {
  await login(page, USERS.staffA);
  // Started 3 days ago, due back today: 10 chairs ₹10/day + 1 shamiana ₹1,500/event.
  const { name, url } = await newBooking(page, {
    start: istDate(-3),
    end: istDate(0),
    items: [
      ["Plastic chair", 10],
      ["Shamiana 20x20 ft", 1],
    ],
  });
  await expect(due(page)).toHaveText("₹1,900"); // 10 × ₹10 × 4 days + ₹1,500

  // 4 chairs came back 2 days ago (entered today).
  let s = await open(page, "section-return");
  await s.getByLabel("Returned Plastic chair").fill("4");
  await s.getByLabel("Returned on").fill(istDate(-2));
  await s.getByLabel("Condition notes").fill("one leg loose");
  await s.getByRole("button", { name: "Record return" }).click();
  await expect(page.getByText("Return recorded.")).toBeVisible();
  await expect(page.getByText("Partly returned")).toBeVisible();
  await expect(page.getByTestId("line-returned")).toHaveText("4 of 10 back");
  // 4 × ₹10 × 2 days + 6 × ₹10 × 4 days + ₹1,500 = ₹1,820 — returned chairs stopped accruing.
  await expect(due(page)).toHaveText("₹1,820");
  await expect(page.getByTestId("return-row").first()).toContainText("4 Plastic chair");
  await expect(page.getByTestId("return-row").first()).toContainText("one leg loose");

  await pay(page, "1000", "UPI");
  await expect(due(page)).toHaveText("₹820");

  // Discount at settlement: 10% of ₹1,820 = ₹182.
  s = await open(page, "section-discount");
  await s.getByRole("button", { name: "% off" }).click();
  await s.getByLabel("Discount percentage").fill("10");
  await s.getByLabel("Discount reason").fill("regular customer");
  await s.getByRole("button", { name: "Save discount" }).click();
  await expect(s.getByText("Discount updated.")).toBeVisible();
  await expect(due(page)).toHaveText("₹638");
  await expect(page.getByTestId("section-discount")).toContainText("Set by Demo Staff A");

  // The rest comes back today.
  s = await open(page, "section-return");
  await s.getByRole("button", { name: "Everything is back" }).click();
  await s.getByRole("button", { name: "Record return" }).click();
  await expect(s.getByText("All items are back.")).toBeVisible();
  await expect(page.getByText("Balance to collect")).toBeVisible();
  await expect(due(page)).toHaveText("₹638");

  // Final bill message is offered; not yet closable.
  const finalBill = page
    .getByTestId("send-panel-RETURN_CONFIRMATION")
    .getByTestId("message-preview");
  await expect(finalBill).toContainText("all items returned");
  await expect(finalBill).toContainText("Balance: ₹638");
  await expect(page.getByTestId("close-section")).toHaveCount(0);

  // Home lists it as payment pending.
  await page.goto("/");
  await expect(page.getByTestId("awaiting-payment-row").filter({ hasText: name })).toContainText(
    "₹638",
  );

  await page.goto(url);
  await pay(page, "638");
  await expect(due(page)).toHaveText("₹0");
  await page.getByTestId("close-section").getByRole("button", { name: "Close booking" }).click();
  await expect(page.getByTestId("closed-badge")).toBeVisible();
  await expect(page.getByText(/Closed by Demo Staff A/)).toBeVisible();
  await expect(page.getByTestId("section-payment")).toHaveCount(0);
  await expect(page.getByTestId("section-discount")).toHaveCount(0);
  await expect(page.getByTestId("payment-row")).toHaveCount(2);
});

test("an advance payment shows as customer credit", async ({ page }) => {
  await login(page, USERS.staffA);
  await newBooking(page, { start: istDate(2), end: istDate(3), items: [["Round table", 1]] });
  await pay(page, "200");
  await expect(page.getByTestId("credit")).toHaveText("₹200");
  await expect(due(page)).toHaveText("₹0");
});

test("owner reverses a payment; staff can't", async ({ page }) => {
  await login(page, USERS.staffA);
  const { url } = await newBooking(page, {
    start: istDate(0),
    end: istDate(0),
    items: [["Round table", 2]],
  });
  await pay(page, "300");
  await expect(page.getByText("Reverse…")).toHaveCount(0); // staff

  await page.context().clearCookies();
  await login(page, USERS.adminA);
  await page.goto(url);
  await page.getByText("Reverse…").click();
  await page.getByLabel("Reason for reversal").fill("entered twice");
  await page.getByRole("button", { name: "Reverse this payment" }).click();
  await expect(page.getByTestId("paid")).toHaveText("₹0");
  await expect(page.getByTestId("payment-row").filter({ hasText: "reversal" })).toContainText(
    "entered twice",
  );
  await expect(page.getByText("Reverse…")).toHaveCount(0);
});

test("owner cancels a booking made by mistake; staff can't", async ({ page }) => {
  await login(page, USERS.staffA);
  const { url } = await newBooking(page, {
    start: istDate(1),
    end: istDate(1),
    items: [["Round table", 1]],
  });
  await expect(page.getByTestId("section-cancel")).toHaveCount(0);

  await page.context().clearCookies();
  await login(page, USERS.adminA);
  await page.goto(url);
  const s = await open(page, "section-cancel");
  await s.getByRole("button", { name: "Cancel booking" }).click();
  await expect(s.getByText("Give a reason for cancelling.")).toBeVisible();
  await s.getByLabel("Reason for cancelling").fill("Duplicate entry");
  await s.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByTestId("cancelled-banner")).toContainText("Duplicate entry");
  await expect(page.getByTestId("section-payment")).toHaveCount(0);
});

test("returns and payments validate input", async ({ page }) => {
  await login(page, USERS.staffA);
  await newBooking(page, { start: istDate(-1), end: istDate(1), items: [["Round table", 3]] });

  let s = await open(page, "section-payment");
  await s.getByLabel("Amount received ₹").fill("abc");
  await s.getByRole("button", { name: "Record payment" }).click();
  await expect(s.getByText("Enter the amount received, like 1500.")).toBeVisible();

  s = await open(page, "section-return");
  await s.getByRole("button", { name: "Record return" }).click();
  await expect(s.getByText("Enter a quantity to return.")).toBeVisible();

  // A tampered quantity beyond what's out is refused by the database.
  await s.locator('input[name="items"]').evaluate((el) => {
    const input = el as HTMLInputElement;
    const items = JSON.parse(input.value) as { lineId: string; quantity: number }[];
    input.value = JSON.stringify(items.map((i) => ({ ...i, quantity: 99 })));
  });
  await s.getByRole("button", { name: "Record return" }).click();
  await expect(s.getByText(/Only 3 of "Round table" still out/)).toBeVisible();
});

test("another business can't record payments or returns on your bookings", async ({ page }) => {
  await login(page, USERS.adminB);
  await page.goto("/bookings/b3000000-0000-4000-8000-000000000001");

  const payment = await open(page, "section-payment");
  await payment.getByLabel("Amount received ₹").fill("1");
  await payment.locator('input[name="orderId"]').evaluate((el, id) => {
    (el as HTMLInputElement).value = id;
  }, IDS.bookingA_seed);
  await payment.getByRole("button", { name: "Record payment" }).click();
  await expect(payment.getByText("Booking not found.")).toBeVisible();

  const ret = await open(page, "section-return");
  // Fill first (this re-renders the form), then tamper, then submit.
  await ret.getByRole("button", { name: "Everything is back" }).click();
  await ret.locator('input[name="orderId"]').evaluate((el, id) => {
    (el as HTMLInputElement).value = id;
  }, IDS.bookingA_seed);
  await ret.getByRole("button", { name: "Record return" }).click();
  await expect(ret.getByText("Booking not found.")).toBeVisible();

  // Tenant B's own booking wasn't changed by the tampered forms either.
  await page.reload();
  await expect(page.getByTestId("return-row")).toHaveCount(0);
  await expect(page.getByTestId("payment-row")).toHaveCount(0);

  // Tenant A's booking is untouched.
  await page.context().clearCookies();
  await login(page, USERS.staffA);
  await page.goto(`/bookings/${IDS.bookingA_seed}`);
  await expect(page.getByTestId("paid")).toHaveText("₹0");
  await expect(page.getByTestId("return-row")).toHaveCount(0);
});
