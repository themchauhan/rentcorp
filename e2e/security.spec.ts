import { expect, test } from "@playwright/test";
import { userDb } from "./db-client";
import { IDS, login, PASSWORD, USERS } from "./helpers";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("session cookies are httpOnly and SameSite=Lax", async ({ page }) => {
  await login(page, USERS.staffA);
  const auth = (await page.context().cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(auth.length).toBeGreaterThan(0);
  for (const c of auth) {
    expect(c.httpOnly, c.name).toBe(true);
    expect(c.sameSite, c.name).toBe("Lax");
  }
  // Page scripts can't read them.
  expect(await page.evaluate(() => document.cookie)).not.toContain("sb-");
});

test("security headers are sent", async ({ request }) => {
  const res = await request.get("/login");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("every tenant-A page is not found for tenant B", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "route sweep runs once");
  await login(page, USERS.adminB);
  for (const path of [
    `/items/${IDS.itemA_plasticChair}`,
    `/bookings/${IDS.bookingA_seed}`,
    `/customers/${IDS.customerA_ravi}`,
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
  }
  await page.goto(`/admin/tenants/${TENANT_A}`);
  await expect(page).toHaveURL(/\/no-access$/);
});

test("signed-out visitors reach nothing", async ({ request }) => {
  for (const path of [
    "/",
    "/bookings",
    "/items",
    "/customers",
    "/reports",
    "/team",
    "/admin",
    "/settings",
  ]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(307);
    expect(res.headers()["location"], path).toMatch(/\/login$/);
  }
});

test("bypassing the app: a real tenant-B token can't read or write tenant A", async () => {
  const db = await userDb(USERS.adminB, PASSWORD);
  const { data: tenantRows } = await db.from("tenants").select("id").eq("id", TENANT_A);
  expect(tenantRows).toEqual([]);
  for (const table of [
    "profiles",
    "rental_items",
    "rental_customers",
    "rental_orders",
    "rental_order_items",
    "rental_returns",
    "rental_payments",
    "message_log",
    "message_templates",
    "audit_logs",
  ]) {
    const { data, error } = await db.from(table).select("tenant_id").eq("tenant_id", TENANT_A);
    expect(error, table).toBeNull();
    expect(data, table).toEqual([]);
  }
  const { data: subs } = await db.from("subscription_payments").select("id");
  expect(subs).toEqual([]);

  // Writes aimed at tenant A fail or land in B (never A).
  const pay = await db
    .from("rental_payments")
    .insert({ rental_order_id: IDS.bookingA_seed, amount_paise: 100, mode: "CASH" });
  expect(pay.error).not.toBeNull();
  const upd = await db
    .from("rental_items")
    .update({ rate_paise: 1 })
    .eq("id", IDS.itemA_plasticChair)
    .select("id");
  expect(upd.data ?? []).toEqual([]);
  const tenant = await db
    .from("tenants")
    .update({ status: "ACTIVE" })
    .eq("id", TENANT_A)
    .select("id");
  expect(tenant.data ?? []).toEqual([]);
  const rpc = await db.rpc("close_booking", { p_order_id: IDS.bookingA_seed });
  expect(rpc.error).not.toBeNull();
});
