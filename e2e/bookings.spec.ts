import { expect, test, type Page } from "@playwright/test";
import {
  expectNotFound,
  formAlert,
  IDS,
  istDate,
  login,
  randomMobile,
  uniq,
  USERS,
  waitForHydration,
} from "./helpers";

async function createItem(page: Page, name: string, price: string, perEvent = false) {
  await page.goto("/items/new");
  await page.getByLabel("Item name").fill(name);
  await page.getByLabel("Category", { exact: true }).fill("E2E");
  await page.getByLabel("Quantity owned").fill("50");
  await page.getByLabel("Price (₹)").fill(price);
  if (perEvent) await page.getByText("per event", { exact: true }).click();
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page).toHaveURL(/\/items$/);
}

async function pickCustomer(page: Page, name: string) {
  await page.getByLabel("Find customer").fill(name);
  await page
    .getByRole("button", { name: new RegExp(name) })
    .first()
    .click();
  await expect(page.getByTestId("selected-customer")).toHaveText(name);
}

async function setQty(page: Page, item: string, qty: number) {
  await page.getByLabel("Search items").fill(item);
  await page.getByLabel(`Quantity of ${item}`).fill(String(qty));
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save booking" }).click();
}

test("create a booking; its rates never change when the catalog does", async ({ page }) => {
  const perDay = `E2E Chair ${uniq()}`;
  const perEvent = `E2E Lights ${uniq()}`;
  await login(page, USERS.adminA);
  await createItem(page, perDay, "10");
  await createItem(page, perEvent, "250", true);

  await page.goto("/bookings/new");
  await pickCustomer(page, "Demo Customer Ravi");
  await page.getByLabel("Start date").fill(istDate(1));
  await page.getByLabel("Return date").fill(istDate(3));
  await expect(page.getByTestId("day-count")).toContainText("3 days");

  await setQty(page, perDay, 10);
  await page.getByLabel("Search items").fill(perEvent);
  await page.getByRole("button", { name: `More ${perEvent}` }).click();
  await page.getByRole("button", { name: "% off" }).click();
  await page.getByLabel("Discount percentage").fill("10");
  await page.getByLabel("Discount reason").fill("E2E regular");

  // 10 × ₹10 × 3 days = ₹300; ₹250 per event; subtotal ₹550; 10% off = ₹495.
  await expect(page.getByTestId("estimated-total")).toHaveText("₹495");
  await save(page);

  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+\?created=1(&wa=\w+)?$/);
  await expect(page.getByText("Booking saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Booking #\d+/ })).toBeVisible();
  await expect(page.getByTestId("booking-total")).toHaveText("₹495");
  await expect(page.getByText("Discount (10%) · E2E regular")).toBeVisible();
  const bookingUrl = page.url().replace(/\?.*$/, "");

  // Change the catalog price afterwards.
  await page.goto("/items");
  await page.getByTestId("item-row").filter({ hasText: perDay }).click();
  await page.getByLabel("Price (₹)").fill("99");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("item-row").filter({ hasText: perDay })).toContainText("₹99");

  // The booking still uses the rate it was made with.
  await page.goto(bookingUrl);
  await expect(page.getByTestId("booking-line").filter({ hasText: perDay })).toContainText("₹10");
  await expect(page.getByTestId("booking-total")).toHaveText("₹495");
});

test("new customer inside the booking, with the duplicate warning", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto("/bookings/new");
  await page.getByRole("button", { name: "New customer" }).click();
  await page.getByLabel("Customer name").fill("Ravi again");
  await page.getByLabel("Mobile number").fill("9111111101"); // Demo Customer Ravi's number
  await setQty(page, "Plastic chair", 2);
  await save(page);

  const warning = page.getByRole("alert").filter({ hasText: "already exists" });
  await expect(warning).toContainText("Demo Customer Ravi");
  await warning.getByRole("button", { name: "Use Demo Customer Ravi" }).click();
  await expect(page.getByTestId("selected-customer")).toHaveText("Demo Customer Ravi");
  await save(page);
  await expect(page.getByText("Booking saved.")).toBeVisible();

  // A genuinely new customer is created along with the booking.
  const name = `E2E Guest ${uniq()}`;
  await page.goto("/bookings/new");
  await page.getByRole("button", { name: "New customer" }).click();
  await page.getByLabel("Customer name").fill(name);
  await page.getByLabel("Mobile number").fill(randomMobile());
  await page.getByLabel("Not on WhatsApp").check();
  await setQty(page, "Plastic chair", 1);
  await save(page);
  await expect(page.getByText("Booking saved.")).toBeVisible();
  await expect(page.getByText("Messages by SMS")).toBeVisible();
  await page.goto(`/customers?q=${encodeURIComponent(name)}`);
  await expect(page.getByTestId("customer-row").filter({ hasText: name })).toContainText(
    "SMS only",
  );
});

test("warns when stock is short, then saves on confirmation", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto("/bookings/new");
  await pickCustomer(page, "Demo Customer Sunita");
  await setQty(page, "Generator 15 kVA", 5); // only 2 owned
  await save(page);

  const warning = page.getByRole("alert").filter({ hasText: "Not enough stock" });
  await expect(warning).toContainText("Generator 15 kVA: 5 wanted, only");
  await expect(warning).toContainText("of 2 free");
  await warning.getByRole("button", { name: "Save anyway" }).click();
  await expect(page.getByText("Booking saved.")).toBeVisible();
});

test("booking form validates input", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto("/bookings/new");
  await save(page);
  await expect(page.getByText("Choose a customer")).toBeVisible();
  await expect(page.getByText("Add at least one item")).toBeVisible();

  await pickCustomer(page, "Demo Customer Ravi");
  await setQty(page, "Plastic chair", 1);
  await page.getByLabel("Start date").fill(istDate(5));
  await page.getByLabel("Return date").fill(istDate(2));
  await page.getByRole("button", { name: "₹ off" }).click();
  await page.getByLabel("Discount amount in rupees").fill("abc");
  await save(page);
  await expect(page.getByText("Return date can't be before the start date")).toBeVisible();
  await expect(page.getByText("Enter an amount like 500")).toBeVisible();
});

test("another business's bookings and customers are invisible", async ({ page }) => {
  await login(page, USERS.adminB);
  await page.goto("/bookings");
  await expect(page.getByText("Demo Customer Ravi")).toHaveCount(0);

  await expectNotFound(page, `/bookings/${IDS.bookingA_seed}`);
  await expectNotFound(page, `/customers/${IDS.customerA_ravi}`);
  await page.goto("/customers");
  await expect(
    page.getByTestId("customer-row").filter({ hasText: "Demo Customer Ravi" }),
  ).toHaveCount(0);
});

test("forged customer or item ids from another business are rejected", async ({ page }) => {
  await login(page, USERS.adminB);

  // Forged customer.
  await page.goto("/bookings/new");
  await pickCustomer(page, "Demo Customer Imran");
  await setQty(page, "Folding chair", 1);
  await waitForHydration(page);
  await page.locator('input[name="customerId"]').evaluate((el, id) => {
    (el as HTMLInputElement).value = id;
  }, IDS.customerA_ravi);
  await save(page);
  await expect(formAlert(page)).toContainText("wasn't found");

  // Forged item.
  await page.goto("/bookings/new");
  await pickCustomer(page, "Demo Customer Imran");
  await setQty(page, "Folding chair", 1);
  await waitForHydration(page);
  await page.locator('input[name="lines"]').evaluate((el, id) => {
    (el as HTMLInputElement).value = JSON.stringify([{ itemId: id, quantity: 1 }]);
  }, IDS.itemA_plasticChair);
  await save(page);
  await expect(page.getByText("Some items aren't available any more")).toBeVisible();
});

test("customers: add, duplicate warning, edit", async ({ page }) => {
  const mobile = randomMobile();
  const name = `E2E Customer ${uniq()}`;
  await login(page, USERS.staffA);
  await page.goto("/customers/new");
  await page.getByLabel("Customer name").fill(name);
  await page.getByLabel("Mobile number").fill(mobile);
  await page.getByLabel("Address (optional)").fill("Demo Street 1");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Same mobile again → warning, then save anyway.
  await page.goto("/customers/new");
  await page.getByLabel("Customer name").fill(`${name} twin`);
  await page.getByLabel("Mobile number").fill(mobile);
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already exists" })).toContainText(name);
  await page.getByRole("button", { name: "Save anyway" }).click();
  await expect(page.getByRole("heading", { name: `${name} twin` })).toBeVisible();

  // Edit.
  await page.getByLabel("Customer name").fill(`${name} renamed`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto(`/customers?q=${encodeURIComponent(`${name} renamed`)}`);
  await expect(page.getByTestId("customer-row")).toHaveCount(1);

  await page.goto("/customers/new");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByText("Enter the customer's name")).toBeVisible();
  await expect(page.getByText("Enter a valid 10-digit mobile number")).toBeVisible();
});
