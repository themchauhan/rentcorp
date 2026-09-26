import { expect, test } from "@playwright/test";
import { fillLogin, formAlert, login, PASSWORD, USERS } from "./helpers";

test.describe("signed out", () => {
  test("protected pages redirect to login", async ({ page }) => {
    for (const path of ["/", "/bookings", "/settings", "/admin"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login$/);
    }
  });

  test("wrong password shows a generic error", async ({ page }) => {
    await fillLogin(page, USERS.staffA, "not-the-password");
    await expect(formAlert(page)).toHaveText("Wrong mobile number or password.");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("unknown mobile shows the same generic error", async ({ page }) => {
    await fillLogin(page, "9999999990");
    await expect(formAlert(page)).toHaveText("Wrong mobile number or password.");
  });

  test("invalid mobile is rejected before contacting auth", async ({ page }) => {
    await fillLogin(page, "12345");
    await expect(page.getByText("Enter a valid 10-digit mobile number")).toBeVisible();
  });

  test("mobile number formats like +91 with spaces are accepted", async ({ page }) => {
    await login(page, "+91 90000 00102");
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  });
});

test.describe("roles reach their own routes", () => {
  test("STAFF: tenant screens yes, owner settings and platform admin no", async ({ page }) => {
    await login(page, USERS.staffA);
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByText("Demo Tent House A").filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Demo Tent House B")).toHaveCount(0);

    await page.goto("/more");
    await expect(page.getByRole("link", { name: "Business settings" })).toHaveCount(0);

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/no-access$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/no-access$/);
  });

  test("ADMIN: owner settings yes, platform admin no", async ({ page }) => {
    await login(page, USERS.adminA);
    await page.goto("/more");
    await page.getByRole("link", { name: "Business settings" }).click();
    await expect(page.getByRole("heading", { name: "Business settings" })).toBeVisible();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/no-access$/);
  });

  test("ADMIN of tenant B sees only tenant B", async ({ page }) => {
    await login(page, USERS.adminB);
    await expect(
      page.getByText("Demo Tent House B").filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Demo Tent House A")).toHaveCount(0);
  });

  test("SUPER_ADMIN lands on the platform dashboard and not tenant screens", async ({ page }) => {
    await login(page, USERS.superAdmin);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Platform dashboard" })).toBeVisible();

    await page.goto("/bookings");
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test.describe("blocked accounts", () => {
  test("a deactivated user cannot log in", async ({ page }) => {
    await fillLogin(page, USERS.inactiveA);
    await expect(formAlert(page)).toContainText("deactivated");
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a suspended business sees the account-inactive page, not its data", async ({ page }) => {
    await login(page, USERS.adminSuspendedC);
    await page.goto("/bookings");
    await expect(page).toHaveURL(/\/account-inactive$/);
    await expect(page.getByText("account is suspended")).toBeVisible();
  });
});

test("logout ends the session", async ({ page }) => {
  await login(page, USERS.adminA);
  await page.goto("/more");
  await page.getByRole("main").getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("change password: new one works, old one stops working", async ({ page }, testInfo) => {
  // Mutates a shared seed user, so run it in one project only.
  test.skip(testInfo.project.name !== "desktop", "runs once, in the desktop project");
  const NEW_PASSWORD = "Changed@5678";

  const change = async (current: string, next: string) => {
    await page.goto("/more/password");
    await page.getByLabel("Current password").fill(current);
    await page.getByLabel("New password", { exact: true }).fill(next);
    await page.getByLabel("Confirm new password").fill(next);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByRole("status")).toHaveText("Password changed.");
  };

  await login(page, USERS.passwordChangeA);
  await change(PASSWORD, NEW_PASSWORD);

  try {
    await page.context().clearCookies();
    await fillLogin(page, USERS.passwordChangeA, PASSWORD);
    await expect(formAlert(page)).toHaveText("Wrong mobile number or password.");

    await login(page, USERS.passwordChangeA, NEW_PASSWORD);
  } finally {
    // Restore the seed password so the test can be re-run.
    await page.context().clearCookies();
    await login(page, USERS.passwordChangeA, NEW_PASSWORD);
    await change(NEW_PASSWORD, PASSWORD);
  }
});

test("change password rejects a wrong current password", async ({ page }) => {
  await login(page, USERS.adminA);
  await page.goto("/more/password");
  await page.getByLabel("Current password").fill("wrong-current");
  await page.getByLabel("New password", { exact: true }).fill("Whatever@123");
  await page.getByLabel("Confirm new password").fill("Whatever@123");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Current password is wrong")).toBeVisible();
});
