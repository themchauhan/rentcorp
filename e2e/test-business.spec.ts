import { expect, test, type Page } from "@playwright/test";
import {
  chooseOwnPassword,
  fillLogin,
  formAlert,
  login,
  randomMobile,
  readTempPassword,
  uniq,
  USERS,
} from "./helpers";

async function createBusiness(admin: Page, name: string, ownerMobile: string, isTest: boolean) {
  await admin.goto("/admin");
  await admin.getByText("New business", { exact: true }).click();
  await admin.getByLabel("Business name").fill(name);
  await admin.getByLabel("Owner name").fill("Test Owner");
  await admin.getByLabel("Owner mobile number").fill(ownerMobile);
  if (isTest) await admin.getByLabel(/Test business/).check();
  await admin.getByRole("button", { name: "Create business" }).click();
  return readTempPassword(admin);
}

test("super admin deletes a test business completely; its mobile can be reused", async ({
  browser,
}) => {
  const name = `TEST E2E ${uniq()}`;
  const ownerMobile = randomMobile();

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, USERS.superAdmin);
  const temp = await createBusiness(admin, name, ownerMobile, true);
  await expect(admin.getByTestId("business-row").filter({ hasText: name })).toContainText("TEST");

  // The owner uses it a bit.
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await login(owner, ownerMobile, temp);
  await chooseOwnPassword(owner, temp, "Owner@12345");
  await owner.goto("/items/new");
  await owner.getByLabel("Item name").fill("Test chair");
  await owner.getByLabel("Category", { exact: true }).fill("Furniture");
  await owner.getByLabel("Quantity owned").fill("5");
  await owner.getByLabel("Price (₹)").fill("10");
  await owner.getByRole("button", { name: "Save item" }).click();
  await expect(owner.getByTestId("item-row").filter({ hasText: "Test chair" })).toBeVisible();

  // Delete: disabled until the exact name is typed.
  await admin.getByTestId("business-row").filter({ hasText: name }).click();
  const form = admin.getByTestId("delete-test-form");
  const button = form.getByRole("button", { name: "Delete test business permanently" });
  await expect(button).toBeDisabled();
  await form.getByLabel(/to confirm/).fill(name.toLowerCase());
  await expect(button).toBeDisabled();
  await form.getByLabel(/to confirm/).fill(name);
  await button.click();
  await expect(admin).toHaveURL(/\/admin\?deleted=/);
  await expect(admin.getByText(`Deleted test business “${name}”.`)).toBeVisible();
  await expect(admin.getByTestId("business-row").filter({ hasText: name })).toHaveCount(0);

  // The owner's login is gone.
  await ownerCtx.clearCookies();
  await fillLogin(owner, ownerMobile, "Owner@12345");
  await expect(formAlert(owner)).toHaveText("Wrong mobile number or password.");

  // The mobile number is free again.
  await createBusiness(admin, `TEST E2E reuse ${uniq()}`, ownerMobile, true);

  await adminCtx.close();
  await ownerCtx.close();
});

test("real businesses can't be deleted from the app", async ({ page }) => {
  await login(page, USERS.superAdmin);
  await page.getByTestId("business-row").filter({ hasText: "Demo Tent House A" }).click();
  await expect(page.getByRole("heading", { name: "Demo Tent House A" })).toBeVisible();
  await expect(page.getByTestId("delete-test-form")).toHaveCount(0);
  await expect(page.getByTestId("test-flag-form")).toContainText("Mark as test business");
});
