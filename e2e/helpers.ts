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

// Seed profile ids (supabase/seed.sql), for tamper tests.
export const IDS = {
  tenantB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  staffA: "a0000000-0000-4000-8000-000000000002",
} as const;

/** A random, valid mobile that won't collide with seeds or earlier runs. */
export function randomMobile(): string {
  return `7${Math.floor(Math.random() * 1e9)
    .toString()
    .padStart(9, "0")}`;
}

export async function logout(page: Page) {
  const visible = page.getByRole("button", { name: "Log out" }).filter({ visible: true });
  // On phones, Log out lives on the More page (the sidebar is hidden).
  if ((await visible.count()) === 0) await page.goto("/more");
  await visible.first().click();
  await expect(page).toHaveURL(/\/login$/);
}

/** Completes the forced first-login password change. */
export async function chooseOwnPassword(page: Page, temporary: string, next: string) {
  await expect(page).toHaveURL(/\/change-password$/);
  await page.getByLabel("Temporary password").fill(temporary);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Confirm new password").fill(next);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Reads the temporary password from the most recent login-details notice. */
export async function readTempPassword(page: Page): Promise<string> {
  const el = page.getByTestId("temp-password").last();
  await expect(el).toBeVisible();
  return (await el.textContent())!.trim();
}
