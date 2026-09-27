import { expect, test, type Page } from "@playwright/test";
import {
  chooseOwnPassword,
  fillLogin,
  formAlert,
  IDS,
  login,
  logout,
  PASSWORD,
  randomMobile,
  readTempPassword,
  USERS,
  waitForHydration,
} from "./helpers";

async function addStaff(page: Page, name: string, mobile: string) {
  await page.goto("/team");
  await page.getByLabel("Staff name").fill(name);
  await page.getByLabel("Mobile number").fill(mobile);
  await page.getByRole("button", { name: "Add staff" }).click();
  return readTempPassword(page);
}

const staffRow = (page: Page, mobile: string) =>
  page.getByTestId("staff-row").filter({ hasText: mobile });

test("onboarding: super admin → new business owner → staff", async ({ page }) => {
  const business = `E2E Tents ${Date.now()}`;
  const ownerMobile = randomMobile();
  const staffMobile = randomMobile();

  // Super admin creates the business and its owner.
  await login(page, USERS.superAdmin);
  await page.getByText("New business", { exact: true }).click();
  await page.getByLabel("Business name").fill(business);
  await page.getByLabel("Owner name").fill("E2E Owner");
  await page.getByLabel("Owner mobile number").fill(ownerMobile);
  await page.getByRole("button", { name: "Create business" }).click();
  const ownerTemp = await readTempPassword(page);
  await expect(page.getByTestId("business-row").filter({ hasText: business })).toContainText(
    "Trial",
  );
  await logout(page);

  // Owner logs in with the temporary password and must choose their own.
  await login(page, ownerMobile, ownerTemp);
  await chooseOwnPassword(page, ownerTemp, "Owner@12345");
  await expect(page.getByText(business).filter({ visible: true }).first()).toBeVisible();

  // Owner adds a staff member.
  const staffTemp = await addStaff(page, "E2E Staff", staffMobile);
  await expect(staffRow(page, staffMobile)).toContainText("Active");
  await logout(page);

  // Staff logs in, changes the temporary password, lands in the owner's business.
  await login(page, staffMobile, staffTemp);
  await chooseOwnPassword(page, staffTemp, "Staff@12345");
  await expect(page.getByText(business).filter({ visible: true }).first()).toBeVisible();

  // The new password works from now on; no more forced change.
  await logout(page);
  await login(page, staffMobile, "Staff@12345");
  await expect(page).toHaveURL(/\/$/);
});

test("a temporary password can't skip the forced change", async ({ page }) => {
  const mobile = randomMobile();
  await login(page, USERS.adminA);
  const temp = await addStaff(page, "E2E Skipper", mobile);
  await logout(page);

  await login(page, mobile, temp);
  for (const path of ["/", "/bookings", "/more", "/more/password"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/change-password$/);
  }
});

test("owner deactivates and reactivates staff", async ({ page }) => {
  const mobile = randomMobile();
  await login(page, USERS.adminA);
  const temp = await addStaff(page, "E2E Toggle", mobile);

  await staffRow(page, mobile).getByRole("button", { name: "Deactivate" }).click();
  await expect(staffRow(page, mobile)).toContainText("Deactivated");
  await logout(page);

  await fillLogin(page, mobile, temp);
  await expect(formAlert(page)).toContainText("deactivated");

  await login(page, USERS.adminA);
  await page.goto("/team");
  await staffRow(page, mobile).getByRole("button", { name: "Reactivate" }).click();
  await expect(staffRow(page, mobile)).toContainText("Active");
  await logout(page);

  await login(page, mobile, temp);
  await expect(page).toHaveURL(/\/change-password$/);
});

test("owner resets a staff password", async ({ page }) => {
  const mobile = randomMobile();
  await login(page, USERS.adminA);
  const firstTemp = await addStaff(page, "E2E Reset", mobile);

  const row = staffRow(page, mobile);
  await row.getByRole("button", { name: "Reset password" }).click();
  await expect(row.getByTestId("temp-password")).toBeVisible();
  const newTemp = (await row.getByTestId("temp-password").textContent())!.trim();
  expect(newTemp).not.toBe(firstTemp);
  await logout(page);

  await fillLogin(page, mobile, firstTemp);
  await expect(formAlert(page)).toHaveText("Wrong mobile number or password.");
  await login(page, mobile, newTemp);
  await expect(page).toHaveURL(/\/change-password$/);
});

test("a forged tenant_id in the add-staff form is ignored", async ({ page }) => {
  const mobile = randomMobile();
  await login(page, USERS.adminA);
  await page.goto("/team");
  // Inject a tenant_id field pointing at Tenant B.
  await page.evaluate((tenantB) => {
    const form = document.querySelector('input[name="mobile"]')!.closest("form")!;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "tenant_id";
    input.value = tenantB;
    form.appendChild(input);
  }, IDS.tenantB);
  await page.getByLabel("Staff name").fill("E2E Forged");
  await page.getByLabel("Mobile number").fill(mobile);
  await page.getByRole("button", { name: "Add staff" }).click();
  await readTempPassword(page);

  // Landed in Tenant A...
  await expect(staffRow(page, mobile)).toBeVisible();
  await logout(page);
  // ...and not in Tenant B.
  await login(page, USERS.adminB);
  await page.goto("/team");
  await expect(page.getByRole("heading", { name: /^Staff \(/ })).toBeVisible();
  await expect(staffRow(page, mobile)).toHaveCount(0);
});

test("an owner cannot deactivate or reset another business's staff", async ({ page }) => {
  await login(page, USERS.adminB);
  await page.goto("/team");
  const row = staffRow(page, "9000000202");

  // Point both of Tenant B's staff forms at Tenant A's staff member.
  await waitForHydration(page);
  await row.locator('input[name="profileId"]').evaluateAll((inputs, id) => {
    for (const input of inputs as HTMLInputElement[]) input.value = id;
  }, IDS.staffA);

  await row.getByRole("button", { name: "Deactivate" }).click();
  await expect(row.getByRole("alert")).toHaveText("Staff member not found.");
  await row.getByRole("button", { name: "Reset password" }).click();
  await expect(row.getByRole("alert")).toHaveText("Staff member not found.");
  await expect(row.getByTestId("temp-password")).toHaveCount(0);
  await logout(page);

  // Staff A is still active with the original password.
  await login(page, USERS.staffA, PASSWORD);
  await expect(page).toHaveURL(/\/$/);
});

test("staff cannot open the team page", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto("/team");
  await expect(page).toHaveURL(/\/no-access$/);
});

test("add-staff validates input", async ({ page }) => {
  await login(page, USERS.adminA);
  await page.goto("/team");
  await page.getByLabel("Mobile number").fill("12345");
  await page.getByRole("button", { name: "Add staff" }).click();
  await expect(page.getByText("Enter a name")).toBeVisible();
  await expect(page.getByText("Enter a valid 10-digit mobile number")).toBeVisible();

  await page.getByLabel("Staff name").fill("Duplicate");
  await page.getByLabel("Mobile number").fill(USERS.staffA);
  await page.getByRole("button", { name: "Add staff" }).click();
  await expect(page.getByText("This mobile number already has an account")).toBeVisible();
});
