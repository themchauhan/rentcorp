import { expect, test, type Browser, type Page } from "@playwright/test";
import { chooseOwnPassword, login, randomMobile, readTempPassword, uniq, USERS } from "./helpers";

async function asUser(browser: Browser, mobile: string, password?: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, mobile, password);
  return page;
}

async function openBusiness(admin: Page, name: string) {
  await admin.goto("/admin");
  await admin.getByTestId("business-row").filter({ hasText: name }).click();
  await expect(admin.getByRole("heading", { name })).toBeVisible();
}

test("suspend → read-only with data intact → renew by payment → full access", async ({
  browser,
}) => {
  const business = `E2E Subs ${uniq()}`;
  const ownerMobile = randomMobile();

  // Super admin creates a business.
  const admin = await asUser(browser, USERS.superAdmin);
  await admin.getByText("New business", { exact: true }).click();
  await admin.getByLabel("Business name").fill(business);
  await admin.getByLabel("Owner name").fill("Subs Owner");
  await admin.getByLabel("Owner mobile number").fill(ownerMobile);
  await admin.getByRole("button", { name: "Create business" }).click();
  const temp = await readTempPassword(admin);

  // Owner sets up and adds an item.
  const owner = await asUser(browser, ownerMobile, temp);
  await chooseOwnPassword(owner, temp, "Owner@12345");
  await owner.goto("/items/new");
  await owner.getByLabel("Item name").fill("Subs chair");
  await owner.getByLabel("Category", { exact: true }).fill("Furniture");
  await owner.getByLabel("Quantity owned").fill("5");
  await owner.getByLabel("Price (₹)").fill("10");
  await owner.getByRole("button", { name: "Save item" }).click();
  await expect(owner.getByTestId("item-row").filter({ hasText: "Subs chair" })).toBeVisible();

  // Super admin suspends it.
  await openBusiness(admin, business);
  const form = admin.getByTestId("subscription-form");
  await form.getByLabel("Status").selectOption("SUSPENDED");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText("Saved.")).toBeVisible();
  await expect(admin.getByTestId("tenant-access")).toContainText("Read-only");

  // Owner: read-only, data still there, changes blocked.
  await owner.goto("/items");
  await expect(owner.getByTestId("read-only-banner")).toContainText("suspended");
  await expect(owner.getByTestId("item-row").filter({ hasText: "Subs chair" })).toBeVisible();
  await expect(owner.getByRole("link", { name: "Add item" })).toHaveCount(0);
  await owner.goto("/items/new");
  await expect(owner).toHaveURL(/\/$/);

  // Super admin records an offline payment that renews it.
  await openBusiness(admin, business);
  const pay = admin.getByTestId("subscription-payment-form");
  await pay.getByLabel("Amount ₹").fill("999");
  await pay.getByLabel("Reference").fill("UPI-E2E");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(pay.getByText(/Payment recorded\. Active until/)).toBeVisible();
  await expect(admin.getByTestId("subscription-payments")).toContainText("₹999");
  await expect(admin.getByTestId("subscription-payments")).toContainText("ref UPI-E2E");
  await expect(admin.getByTestId("tenant-access")).toContainText("Has access");

  // Owner has full access again; the item survived.
  await owner.goto("/items");
  await expect(owner.getByTestId("read-only-banner")).toHaveCount(0);
  await expect(owner.getByRole("link", { name: "Add item" })).toBeVisible();
  await expect(owner.getByTestId("item-row").filter({ hasText: "Subs chair" })).toBeVisible();

  // Quick extend also works.
  await openBusiness(admin, business);
  await admin.getByTestId("extend-form").getByRole("button", { name: "+1 year" }).click();
  await expect(admin.getByTestId("extend-form").getByText(/Active until/)).toBeVisible();

  await admin.context().close();
  await owner.context().close();
});

test("super admin dashboard shows counts and statuses", async ({ page }) => {
  await login(page, USERS.superAdmin);
  await expect(page.getByTestId("admin-counts")).toContainText("Businesses");
  expect(Number(await page.getByTestId("count-Suspended").textContent())).toBeGreaterThanOrEqual(1);
  await expect(
    page.getByTestId("business-row").filter({ hasText: "Demo Tent House C" }),
  ).toContainText("Suspended");
});

test("owners and staff can't reach the platform admin", async ({ page }) => {
  await login(page, USERS.adminA);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/no-access$/);
  await page.goto("/admin/tenants/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  await expect(page).toHaveURL(/\/no-access$/);
});
