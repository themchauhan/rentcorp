import { expect, test, type Page } from "@playwright/test";
import {
  chooseOwnPassword,
  expectNotFound,
  formAlert,
  IDS,
  istDate,
  login,
  randomMobile,
  readTempPassword,
  tamperAndSubmit,
  uniq,
  USERS,
  waitForHydration,
} from "./helpers";

// 1×1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

async function addRoom(page: Page, name: string, beds = 2, rent = "6000") {
  await page.goto("/rooms/new");
  await page.getByLabel("Room name or number").fill(name);
  await page.getByLabel("Floor (optional)").fill("E2E floor");
  await page.getByLabel(/Rent per bed, per month/).fill(rent);
  await page.getByLabel("Beds in this room").fill(String(beds));
  await page.getByRole("button", { name: "Save room" }).click();
  await expect(page).toHaveURL(/\/rooms$/);
  await expect(page.getByTestId("room-card").filter({ hasText: `Room ${name}` })).toBeVisible();
}

/** Moves a new resident into `Room <room> · Bed A`; returns the resident page URL. */
async function moveIn(
  page: Page,
  room: string,
  opts: { name?: string; mobile?: string; start?: string; meal?: string; deposit?: string } = {},
) {
  const name = opts.name ?? `E2E Resident ${uniq()}`;
  await page.goto("/residents/new");
  const place = page.getByLabel("Bed or room");
  const value = await place
    .locator("option", { hasText: `Room ${room} · Bed A` })
    .getAttribute("value");
  await place.selectOption(value!);
  await page.getByLabel("Resident name").fill(name);
  await page.getByLabel("Mobile number").fill(opts.mobile ?? randomMobile());
  if (opts.start) await page.getByLabel(/Joining date/).fill(opts.start);
  if (opts.meal) {
    const meal = page.getByLabel("Meal plan");
    const v = await meal.locator("option", { hasText: opts.meal }).getAttribute("value");
    await meal.selectOption(v!);
  }
  await page.getByLabel("Security deposit agreed (₹)").fill(opts.deposit ?? "5000");
  await page.getByRole("button", { name: "Save move-in" }).click();
  await expect(page.getByText("Moved in.")).toBeVisible();
  return { name, url: page.url().replace(/\?.*$/, "") };
}

test("each kind of business sees only its own screens", async ({ page }) => {
  await login(page, USERS.pgStaffD);
  await expect(page.getByRole("link", { name: "Rooms" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Bookings" })).toHaveCount(0);
  await expectNotFound(page, "/bookings");
  await expectNotFound(page, "/items");
  await expectNotFound(page, "/customers");

  await page.context().clearCookies();
  await login(page, USERS.staffA);
  await expect(page.getByRole("link", { name: "Bookings" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Rooms" })).toHaveCount(0);
  await expectNotFound(page, "/rooms");
  await expectNotFound(page, "/residents");
  await expectNotFound(page, "/complaints");
});

test("PG home shows rent due, overdue, leaving and complaints", async ({ page }) => {
  await login(page, USERS.pgOwnerD);
  await expect(page.getByTestId("pg-stats")).toContainText("occupied");
  await expect(page.getByTestId("overdue")).toContainText("Demo Resident Kabir");
  await expect(page.getByTestId("due-today")).toContainText("Demo Resident Meera");
  await expect(page.getByTestId("open-complaints")).toContainText("Wi-Fi");
});

test("owner sets up a room and meal plan; staff move a resident in, collect rent, send a receipt", async ({
  page,
}) => {
  const room = `E${uniq()}`;
  const plan = `E2E plan ${uniq()}`;
  await login(page, USERS.pgOwnerD);
  await addRoom(page, room);
  await page.goto("/settings/hostel");
  const plans = page.getByTestId("meal-plans");
  await plans.getByLabel("New plan name").fill(plan);
  await plans.getByLabel("Price per month (₹)").fill("2000");
  await plans.getByRole("button", { name: "Add meal plan" }).click();
  await expect(plans.getByText(`${plan} added.`)).toBeVisible();

  await page.context().clearCookies();
  await login(page, USERS.pgStaffD);
  const resident = await moveIn(page, room, { meal: plan });
  // Joining today: first month due now = rent 6,000 + meals 2,000 + electricity 500.
  await expect(page.getByTestId("amount-due")).toHaveText("₹8,500");
  await expect(page.getByTestId("months")).toContainText("Due");

  const pay = page.getByTestId("pg-payment-form");
  await expect(pay.getByLabel("Amount received ₹")).toHaveValue("8500");
  await pay.getByRole("button", { name: "UPI" }).click();
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(pay.getByText("₹8,500 recorded.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("amount-due")).toHaveText("₹0");
  await expect(page.getByTestId("month-row").first()).toContainText("Paid");

  const panel = page.getByTestId("send-panel-PAYMENT_RECEIPT");
  await expect(panel.getByTestId("message-preview")).toContainText("Received ₹8,500");
  const [popup, logged] = await Promise.all([
    page.waitForEvent("popup"),
    page.waitForResponse("**/api/message-log"),
    panel.getByRole("link", { name: "Send on WhatsApp" }).click(),
  ]);
  expect(logged.status()).toBe(200);
  expect(new URL(popup.url()).searchParams.get("text")).toContain(resident.name);
  await page.reload();
  await expect(page.getByTestId("message-log")).toContainText(
    "Payment receipt · opened in WhatsApp",
  );

  // The bed now shows as occupied on the rooms grid.
  await page.goto("/rooms");
  await expect(page.getByTestId("room-card").filter({ hasText: `Room ${room}` })).toContainText(
    resident.name,
  );
});

test("notice, move-out with a deduction, refund, and the bed is vacant again", async ({ page }) => {
  const room = `M${uniq()}`;
  await login(page, USERS.pgOwnerD);
  await addRoom(page, room, 1);
  // Joined 40 days ago: two months charged (2 × ₹6,500 with electricity).
  const { url } = await moveIn(page, room, { start: istDate(-40), deposit: "10000" });
  await expect(page.getByTestId("amount-due")).toHaveText("₹13,000");

  const pay = page.getByTestId("pg-payment-form");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(pay.getByText("₹13,000 recorded.")).toBeVisible();
  await page.reload();
  // Nothing due now, so the payment section starts closed.
  await page.getByTestId("section-payment").locator("summary").click();
  await page.getByTestId("pg-payment-form").getByRole("button", { name: "Deposit" }).click();
  await expect(page.getByTestId("pg-payment-form").getByLabel("Amount received ₹")).toHaveValue(
    "10000",
  );
  await page.getByTestId("pg-payment-form").getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("₹10,000 recorded.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("deposit")).toContainText("₹10,000 held");

  const moveout = page.getByTestId("section-moveout");
  await moveout.getByRole("button", { name: "Record notice" }).click();
  // The page refreshes into the "on notice" state.
  await expect(page.getByTestId("stay-status")).toHaveText("On notice");

  page.once("dialog", (d) => d.accept());
  const settle = page.getByTestId("settle-form");
  await settle.getByRole("button", { name: "+ Add a deduction from the deposit" }).click();
  await settle.getByLabel("Deduction ₹").fill("1500");
  await settle.getByLabel("Reason").fill("Broken chair");
  await settle.getByRole("button", { name: "Record move-out" }).click();
  await expect(page.getByTestId("settlement")).toHaveText("Refund due: ₹8,500");
  await expect(page.getByTestId("stay-status")).toHaveText("Moved out");

  const refund = page.getByTestId("pg-payment-form");
  await expect(refund.getByLabel("Amount refunded ₹")).toHaveValue("8500");
  await refund.getByRole("button", { name: "Record refund" }).click();
  await expect(refund.getByText("Refund of ₹8,500 recorded.")).toBeVisible();
  await page.goto(url);
  await expect(page.getByTestId("settlement")).toHaveText("Settled");

  await page.goto("/rooms?show=vacant");
  await expect(page.getByTestId("room-card").filter({ hasText: `Room ${room}` })).toContainText(
    "Vacant",
  );
});

test("ID photos: upload, view, other businesses can't, owner deletes permanently", async ({
  page,
  request,
}, testInfo) => {
  // One resident per project so parallel runs don't touch each other's photos.
  const stay = testInfo.project.name === "mobile" ? IDS.stayD_aarav : IDS.stayD_kabir;
  await login(page, USERS.pgOwnerD);
  await page.goto(`/residents/${stay}`);
  const upload = page.getByTestId("id-upload");
  await upload.getByLabel("ID photo").setInputFiles({
    name: "too-big.png",
    mimeType: "image/png",
    buffer: Buffer.concat([PNG.subarray(0, 8), Buffer.alloc(6 * 1024 * 1024)]),
  });
  await expect(upload.getByRole("alert")).toContainText("under 5 MB");

  await upload
    .getByLabel("ID photo")
    .setInputFiles({ name: "id.png", mimeType: "image/png", buffer: PNG });
  await expect(upload.getByText("Photo saved.")).toBeVisible();
  const photo = page
    .getByTestId("id-photo")
    .filter({ has: page.locator("img") })
    .first();
  await expect(photo).toBeVisible();
  const src = (await photo.locator("img").getAttribute("src"))!;
  const own = await page.request.get(src);
  expect(own.status()).toBe(200);
  expect(own.headers()["cache-control"]).toContain("no-store");

  // Signed out, or another PG: nothing.
  expect((await request.get(src, { maxRedirects: 0 })).status()).not.toBe(200);
  const other = await page.context().browser()!.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, USERS.pgOwnerE);
  expect((await otherPage.request.get(src)).status()).toBe(404);
  await other.close();

  page.once("dialog", (d) => d.accept());
  await photo.getByRole("button", { name: "Delete this photo permanently" }).click();
  await expect(page.locator(`img[src="${src}"]`)).toHaveCount(0);
  expect((await page.request.get(src)).status()).toBe(404);
});

test("staff log a complaint and resolve it", async ({ page }) => {
  const text = `Fan not working ${uniq()}`;
  await login(page, USERS.pgStaffD);
  await page.goto("/complaints/new");
  await page.getByRole("button", { name: "Save complaint" }).click();
  await expect(formAlert(page)).toContainText("Choose what the problem is about.");
  await page.getByLabel("What is it about?").selectOption("ELECTRICAL");
  const where = page.getByLabel("Resident or room (optional)");
  const v = await where.locator("option", { hasText: "Demo Resident Kabir" }).getAttribute("value");
  await where.selectOption(v!);
  await page.getByLabel("Problem").fill(text);
  await page.getByLabel("Urgent").check();
  await page.getByRole("button", { name: "Save complaint" }).click();
  await expect(page.getByText("Complaint saved.")).toBeVisible();
  await expect(page.getByTestId("complaint-status")).toHaveText("Open");
  await page.getByRole("button", { name: "Mark resolved" }).click();
  await expect(page.getByText("Marked resolved.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("complaint-status")).toHaveText("Resolved");
  await expect(page.getByText("Resolved")).toBeTruthy();
});

test("invalid input is refused", async ({ page }) => {
  await login(page, USERS.pgOwnerD);
  await page.goto("/residents/new");
  await page.getByRole("button", { name: "Save move-in" }).click();
  await expect(formAlert(page).first()).toContainText("Check the highlighted details.");
  await expect(page.getByText("Choose a vacant bed or room")).toBeVisible();

  await page.goto(`/residents/${IDS.stayD_kabir}`);
  const pay = page.getByTestId("pg-payment-form");
  await pay.getByLabel("Amount received ₹").fill("abc");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(pay.getByRole("alert")).toContainText("Enter the amount");

  await page.goto("/rooms/new");
  await page.getByRole("button", { name: "Save room" }).click();
  await expect(page.getByText("Enter the room name or number")).toBeVisible();
});

test("another PG can't see or change this PG's residents, rooms or complaints", async ({
  page,
}) => {
  await login(page, USERS.pgOwnerE);
  await expectNotFound(page, `/residents/${IDS.stayD_kabir}`);
  await expectNotFound(page, `/rooms/${IDS.roomD_101}`);
  await expectNotFound(page, `/complaints/${IDS.complaintD_wifi}`);
  await expect(page.getByText("Demo Resident Kabir")).toHaveCount(0);

  // Forged stay id on E's own payment form.
  await page.goto(`/residents/${IDS.stayE_esha}`);
  await waitForHydration(page);
  const pay = page.getByTestId("pg-payment-form");
  await pay.getByLabel("Amount received ₹").fill("1.23");
  await tamperAndSubmit(
    pay.getByRole("button", { name: "Record payment" }),
    "stayId",
    IDS.stayD_kabir,
  );
  await expect(pay.getByRole("alert")).toBeVisible();

  await page.context().clearCookies();
  await login(page, USERS.pgOwnerD);
  await page.goto(`/residents/${IDS.stayD_kabir}`);
  await expect(page.getByTestId("payments")).not.toContainText("₹1.23");
});

test("staff can't reach owner-only PG screens", async ({ page }) => {
  await login(page, USERS.pgStaffD);
  await page.goto("/rooms/new");
  await expect(page).toHaveURL(/\/no-access$/);
  await page.goto("/settings/hostel");
  await expect(page).toHaveURL(/\/no-access$/);
  await page.goto(`/residents/${IDS.stayD_kabir}`);
  await expect(page.getByTestId("section-rates")).toHaveCount(0);
  await expect(page.getByTestId("settle-form")).toHaveCount(0);
});

test("super admin creates a hostel/PG business", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "creates a business: runs once");
  const name = `TEST PG ${uniq()}`;
  const mobile = randomMobile();
  const admin = await (await browser.newContext()).newPage();
  await login(admin, USERS.superAdmin);
  await admin.getByText("New business", { exact: true }).click();
  await admin.getByLabel("Business name").fill(name);
  await admin.getByLabel("Owner name").fill("PG Owner");
  await admin.getByLabel("Owner mobile number").fill(mobile);
  await admin.getByLabel("Hostel / PG").check();
  await admin.getByLabel(/Test business/).check();
  await admin.getByRole("button", { name: "Create business" }).click();
  const temp = await readTempPassword(admin);
  await admin.goto("/admin");
  await expect(admin.getByTestId("business-row").filter({ hasText: name })).toContainText("PG");
  await admin.getByTestId("business-row").filter({ hasText: name }).click();
  await expect(admin.getByTestId("business-type")).toHaveText("Hostel / PG");
  await expect(admin.getByTestId("whatsapp-addon-form")).toHaveCount(0);

  const owner = await (await browser.newContext()).newPage();
  await login(owner, mobile, temp);
  await chooseOwnPassword(owner, temp, "Owner@12345");
  await expect(owner.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await owner.goto("/rooms");
  await expect(owner.getByText("No rooms yet.")).toBeVisible();
});
