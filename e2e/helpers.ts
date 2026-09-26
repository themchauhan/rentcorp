import { expect, type Locator, type Page } from "@playwright/test";

// Seed logins (supabase/seed.sql). Local dummy accounts only.
export const PASSWORD = "Demo@1234";
export const USERS = {
  superAdmin: "9000000001",
  adminA: "9000000101",
  staffA: "9000000102",
  inactiveA: "9000000103",
  passwordChangeA: "9000000104",
  adminB: "9000000201",
  adminSuspendedC: "9000000301",
} as const;

export async function fillLogin(page: Page, mobile: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Mobile number").fill(mobile);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

/** Log in and wait until we've left the login page. */
export async function login(page: Page, mobile: string, password = PASSWORD) {
  await fillLogin(page, mobile, password);
  await expect(page).not.toHaveURL(/\/login/);
}

/** The form's own error message (Next also renders a hidden role="alert" route announcer). */
export function formAlert(page: Page): Locator {
  return page.locator("form").getByRole("alert");
}
