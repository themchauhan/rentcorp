import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  chooseOwnPassword,
  istDate,
  login,
  randomMobile,
  readTempPassword,
  uniq,
  USERS,
} from "./helpers";
import { E2E_WHATSAPP } from "./whatsapp-env";

type Recorded = {
  phoneNumberId?: string;
  auth?: string;
  body?: { to?: string; template?: { name: string } };
};
const mockRequests = async (request: APIRequestContext): Promise<Recorded[]> =>
  (await request.get(`${E2E_WHATSAPP.mockUrl}/__requests`)).json();
const runCron = (request: APIRequestContext, auth?: string) =>
  request.get("/api/cron/evening-reminders", auth ? { headers: { authorization: auth } } : {});

/** Super admin switches a business's WhatsApp add-on on or off. */
async function setAddon(admin: Page, business: string, on: boolean) {
  await admin.goto("/admin");
  await admin.getByTestId("business-row").filter({ hasText: business }).click();
  const form = admin.getByTestId("whatsapp-addon-form");
  await form
    .getByRole("button", { name: `Switch WhatsApp automation ${on ? "on" : "off"}` })
    .click();
  await expect(form.getByText(`WhatsApp automation switched ${on ? "on" : "off"}`)).toBeVisible();
  await expect(admin.getByTestId("whatsapp-addon-status")).toContainText(
    on ? "Add-on: On" : "Add-on: Off",
  );
}

async function book(
  page: Page,
  opts: { mobile: string; consent: boolean; start: string; end: string; item: string; qty: number },
) {
  await page.goto("/bookings/new");
  await page.getByRole("button", { name: "New customer" }).click();
  await page.getByLabel("Customer name").fill(`E2E Auto ${uniq()}`);
  await page.getByLabel("Mobile number").fill(opts.mobile);
  if (opts.consent) await page.getByLabel(/Agreed to receive WhatsApp messages/).check();
  await page.getByLabel("Start date").fill(opts.start);
  await page.getByLabel("Return date").fill(opts.end);
  await page.getByLabel("Search items").fill(opts.item);
  await page.getByLabel(`Quantity of ${opts.item}`).fill(String(opts.qty));
  await page.getByRole("button", { name: "Save booking" }).click();
  const saved = page.getByText("Booking saved.");
  const anyway = page.getByRole("button", { name: /Save anyway|Create new anyway/ });
  await expect(saved.or(anyway)).toBeVisible();
  if (await anyway.isVisible()) await anyway.click();
  await expect(saved).toBeVisible();
  return page.url().replace(/\?.*$/, "");
}

test("booking details go out automatically when a booking is saved", async ({ page, request }) => {
  const mobile = randomMobile();
  await login(page, USERS.staffA);
  await book(page, {
    mobile,
    consent: true,
    start: istDate(1),
    end: istDate(2),
    item: "Plastic chair",
    qty: 3,
  });
  await expect(page.getByText("Booking details sent automatically on WhatsApp.")).toBeVisible();
  const sent = (await mockRequests(request)).filter(
    (r) => r.body?.to === `91${mobile}` && r.body?.template?.name === "rentcorp_booking_details",
  );
  expect(sent).toHaveLength(1);

  // Without consent: nothing automatic, the one-tap buttons are still there.
  const other = randomMobile();
  await book(page, {
    mobile: other,
    consent: false,
    start: istDate(1),
    end: istDate(2),
    item: "Plastic chair",
    qty: 1,
  });
  await expect(page.getByText("Booking details sent automatically on WhatsApp.")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Send on WhatsApp" }).first()).toBeVisible();
  expect((await mockRequests(request)).filter((r) => r.body?.to === `91${other}`)).toHaveLength(0);
});

test("the 9 PM job refuses calls without the secret", async ({ request }) => {
  expect((await runCron(request)).status()).toBe(401);
  expect((await runCron(request, "Bearer wrong")).status()).toBe(401);
});

test("staff can't open WhatsApp settings", async ({ page }) => {
  await login(page, USERS.staffA);
  await page.goto("/settings/whatsapp");
  await expect(page).toHaveURL(/\/no-access$/);
});

test("owner connects their own number; 9 PM reminders go to everyone with money due, once a day", async ({
  browser,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "end-to-end business journey runs once");
  test.setTimeout(240_000);
  const business = `TEST Auto ${uniq()}`;
  const ownerMobile = randomMobile();
  const phoneId = `4${Date.now()}`;
  const token = `owner-token-${uniq()}-00000000000`;

  // Super admin creates the business.
  const admin = await (await browser.newContext()).newPage();
  await login(admin, USERS.superAdmin);
  await admin.getByText("New business", { exact: true }).click();
  await admin.getByLabel("Business name").fill(business);
  await admin.getByLabel("Owner name").fill("Auto Owner");
  await admin.getByLabel("Owner mobile number").fill(ownerMobile);
  await admin.getByLabel(/Test business/).check();
  await admin.getByRole("button", { name: "Create business" }).click();
  const temp = await readTempPassword(admin);

  // Without the add-on the owner sees only the simple one-tap app.
  const owner = await (await browser.newContext()).newPage();
  await login(owner, ownerMobile, temp);
  await chooseOwnPassword(owner, temp, "Owner@12345");
  await owner.goto("/settings");
  await expect(owner.getByRole("heading", { name: "Business settings" })).toBeVisible();
  await expect(owner.getByTestId("settings-whatsapp")).toHaveCount(0);
  await owner.goto("/settings/whatsapp");
  await expect(owner.getByTestId("whatsapp-addon-off")).toBeVisible();
  await expect(owner.getByTestId("whatsapp-connection")).toHaveCount(0);
  await owner.goto("/customers/new");
  await expect(owner.getByLabel("Mobile number")).toBeVisible();
  await expect(owner.getByLabel(/Agreed to receive WhatsApp messages/)).toHaveCount(0);
  await expect(admin.getByTestId("whatsapp-connection")).toHaveCount(0);

  // Super admin switches the add-on on; owner connects from Settings → WhatsApp.
  await setAddon(admin, business, true);
  await owner.goto("/settings");
  await owner.getByTestId("settings-whatsapp").click();
  await expect(owner.getByTestId("signup-unavailable")).toBeVisible();
  const box = owner.getByTestId("whatsapp-connection");
  await box.getByLabel("WhatsApp Business Account ID").fill("500000000000001");
  await box.getByLabel("Phone number ID").fill(phoneId);
  await box.getByLabel("WhatsApp number customers see").fill("+91 90000 05555");
  await box.getByLabel(/Access token/).fill(token);
  // A forged tenant id in the form must be ignored.
  await box
    .locator("form")
    .first()
    .evaluate((form) => {
      const i = document.createElement("input");
      i.type = "hidden";
      i.name = "tenantId";
      i.value = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      form.appendChild(i);
    });
  await box.getByRole("button", { name: "Connect WhatsApp" }).click();
  await expect(box.getByText("WhatsApp connected.")).toBeVisible();
  await owner.reload();
  await expect(owner.getByTestId("whatsapp-status")).toHaveText("Connected: +91 90000 05555");
  expect(await owner.content()).not.toContain(token);

  // Tenant A's own connection is untouched.
  const staffA = await (await browser.newContext()).newPage();
  await login(staffA, USERS.adminA);
  await staffA.goto("/settings");
  await expect(staffA.getByTestId("settings-whatsapp")).toContainText("+91 90000 00100");

  // Items and bookings in every state.
  await owner.goto("/items/new");
  await owner.getByLabel("Item name").fill("Auto chair");
  await owner.getByLabel("Category", { exact: true }).fill("Furniture");
  await owner.getByLabel("Quantity owned").fill("500");
  await owner.getByLabel("Price (₹)").fill("10");
  await owner.getByRole("button", { name: "Save item" }).click();
  await expect(owner.getByTestId("item-row").filter({ hasText: "Auto chair" })).toBeVisible();

  const m = {
    active: randomMobile(),
    overdue: randomMobile(),
    returned: randomMobile(),
    paid: randomMobile(),
    noConsent: randomMobile(),
  };
  await book(owner, {
    mobile: m.active,
    consent: true,
    start: istDate(-1),
    end: istDate(2),
    item: "Auto chair",
    qty: 5,
  });
  await book(owner, {
    mobile: m.overdue,
    consent: true,
    start: istDate(-4),
    end: istDate(-1),
    item: "Auto chair",
    qty: 5,
  });
  const returnedUrl = await book(owner, {
    mobile: m.returned,
    consent: true,
    start: istDate(-2),
    end: istDate(0),
    item: "Auto chair",
    qty: 5,
  });
  await owner.goto(returnedUrl);
  await owner.getByTestId("section-return").locator("summary").click();
  await owner.getByRole("button", { name: "Everything is back" }).click();
  await owner.getByRole("button", { name: "Record return" }).click();
  await expect(owner.getByText("All items are back.")).toBeVisible();
  const paidUrl = await book(owner, {
    mobile: m.paid,
    consent: true,
    start: istDate(-1),
    end: istDate(1),
    item: "Auto chair",
    qty: 5,
  });
  await owner.goto(paidUrl);
  await owner.getByTestId("section-payment").locator("summary").click();
  await owner.getByLabel("Amount received ₹").fill("5000"); // more than due → credit
  await owner.getByRole("button", { name: "Record payment" }).click();
  await expect(owner.getByText("Payment recorded.")).toBeVisible();
  await book(owner, {
    mobile: m.noConsent,
    consent: false,
    start: istDate(-1),
    end: istDate(1),
    item: "Auto chair",
    qty: 5,
  });

  // Booking details went out on save for the consenting customers only.
  const afterBooking = (await mockRequests(request)).filter((r) => r.phoneNumberId === phoneId);
  const detailsTo = afterBooking
    .filter((r) => r.body?.template?.name === "rentcorp_booking_details")
    .map((r) => r.body?.to);
  expect(detailsTo.sort()).toEqual(
    [m.active, m.overdue, m.returned, m.paid].map((x) => `91${x}`).sort(),
  );
  expect(afterBooking.every((r) => r.auth === `Bearer ${token}`)).toBe(true);

  // Switch automatic booking details off → no send on save.
  await owner.goto("/settings/whatsapp");
  await owner.getByLabel(/Send booking details when a booking is saved/).uncheck();
  await owner.getByTestId("automation-form").getByRole("button", { name: "Save" }).click();
  await expect(owner.getByTestId("automation-form").getByText("Saved.")).toBeVisible();
  const offMobile = randomMobile();
  await book(owner, {
    mobile: offMobile,
    consent: true,
    start: istDate(1),
    end: istDate(2),
    item: "Auto chair",
    qty: 1,
  });
  await expect(owner.getByText("Booking details sent automatically on WhatsApp.")).toHaveCount(0);
  expect((await mockRequests(request)).filter((r) => r.body?.to === `91${offMobile}`)).toHaveLength(
    0,
  );

  // Add-on switched off: the 9 PM job skips this business, connection kept.
  await setAddon(admin, business, false);
  const beforeOff = (await mockRequests(request)).length;
  expect((await runCron(request, `Bearer ${E2E_WHATSAPP.cronSecret}`)).status()).toBe(200);
  expect(
    (await mockRequests(request)).slice(beforeOff).filter((r) => r.phoneNumberId === phoneId),
  ).toHaveLength(0);
  await owner.goto(returnedUrl);
  await expect(owner.getByTestId("auto-send")).toHaveCount(0);
  await expect(owner.getByTestId("auto-send-blocked")).toHaveCount(0);
  await setAddon(admin, business, true);

  // The 9 PM run.
  const before = (await mockRequests(request)).length;
  const res = await runCron(request, `Bearer ${E2E_WHATSAPP.cronSecret}`);
  expect(res.status()).toBe(200);
  const evening = (await mockRequests(request))
    .slice(before)
    .filter((r) => r.phoneNumberId === phoneId);
  const byTo = Object.fromEntries(evening.map((r) => [r.body?.to, r.body?.template?.name]));
  expect(byTo).toEqual({
    [`91${m.active}`]: "rentcorp_amount_due",
    [`91${m.overdue}`]: "rentcorp_amount_due",
    [`91${m.returned}`]: "rentcorp_final_bill",
  });

  // Running again the same day sends nothing new to this business.
  const before2 = (await mockRequests(request)).length;
  expect((await runCron(request, `Bearer ${E2E_WHATSAPP.cronSecret}`)).status()).toBe(200);
  expect(
    (await mockRequests(request)).slice(before2).filter((r) => r.phoneNumberId === phoneId),
  ).toHaveLength(0);

  // Owner sees the activity; super admin sees the run.
  await owner.goto("/settings/whatsapp");
  await expect(owner.getByTestId("whatsapp-activity")).toContainText("Amount due · 9 PM");
  await admin.goto("/admin");
  await expect(admin.getByTestId("last-evening-run")).toContainText("sent");
});
