import { expect, test } from "@playwright/test";
import { agreementEnd } from "../src/lib/pg-agreements";
import { formatDate } from "../src/lib/dates";
import {
  expectNotFound,
  IDS,
  istDate,
  login,
  tamperAndSubmit,
  uniq,
  USERS,
  waitForHydration,
} from "./helpers";
import { addRoom, moveIn } from "./pg-helpers";

// Phase 14: rent agreements & renewals.

const KABIR_AGREEMENT = "d8000000-0000-4000-8000-000000000002";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << >>\n%%EOF\n");
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test("move-in creates an 11-month agreement", async ({ page }) => {
  const room = `G${uniq()}`;
  await login(page, USERS.pgOwnerD);
  await addRoom(page, room, 1);
  await moveIn(page, room);
  const card = page.getByTestId("agreement");
  await expect(card.getByTestId("agreement-start")).toHaveText(formatDate(istDate(0)));
  await expect(card.getByTestId("agreement-end")).toHaveText(
    formatDate(agreementEnd(istDate(0), 11)),
  );
  await expect(card.getByTestId("agreement-state")).toHaveText("Current");
});

test("Home lists agreements ending soon and expired, with a renewal message", async ({ page }) => {
  await login(page, USERS.pgStaffD);
  const list = page.getByTestId("agreements-ending");
  const kabir = list.getByTestId("agreement-row").filter({ hasText: "Demo Resident Kabir" });
  await expect(kabir).toContainText("Ends in 20 days");
  await expect(
    list.getByTestId("agreement-row").filter({ hasText: "Demo Resident Meera" }),
  ).toContainText("Expired 5 days ago");
  await kabir.getByText("Send renewal message").click();
  const panel = kabir.getByTestId("send-panel-AGREEMENT_RENEWAL");
  await expect(panel.getByTestId("message-preview")).toContainText("ends on");
  await expect(panel.getByTestId("message-preview")).toContainText("New rent from renewal: ₹6,300");
  const [, logged] = await Promise.all([
    page.waitForEvent("popup"),
    page.waitForResponse("**/api/message-log"),
    panel.getByRole("link", { name: "Send on WhatsApp" }).click(),
  ]);
  expect(logged.status()).toBe(200);
});

test("owner renews with the suggested 5% rent from the next due date", async ({ page }) => {
  const room = `R${uniq()}`;
  await login(page, USERS.pgOwnerD);
  await addRoom(page, room, 1);
  // Joined 320 days ago on an 11-month agreement: it ends in about two weeks.
  const start = istDate(-320);
  await moveIn(page, room, { start });
  const card = page.getByTestId("agreement");
  await expect(card.getByTestId("agreement-state")).toContainText("Ends in");

  const renew = card.getByTestId("agreement-renew");
  await expect(renew.getByLabel("New rent per month (₹)")).toHaveValue("6300");
  await renew.getByRole("button", { name: "Renew" }).click();
  const newStart = agreementEnd(start, 11);
  await expect(card.getByTestId("agreement-start")).not.toHaveText(formatDate(start));
  await expect(card.getByTestId("agreement-end")).toHaveText(
    formatDate(
      agreementEnd(
        new Date(Date.parse(`${newStart}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10),
        11,
      ),
    ),
  );
  await expect(card.getByTestId("agreement-state")).toHaveText("Current");
  await expect(card).toContainText("Renewed:");
  await expect(page.getByTestId("dues-summary")).toContainText("rent ₹6,300");
});

test("signed agreement: upload, view, refuse fakes, other PG can't see it", async ({
  page,
}, testInfo) => {
  // One resident per project so parallel runs don't replace each other's file.
  const stay = testInfo.project.name === "mobile" ? IDS.stayD_aarav : IDS.stayD_kabir;
  await login(page, USERS.pgOwnerD);
  await page.goto(`/residents/${stay}`);
  await waitForHydration(page);
  const upload = page.getByTestId("agreement-upload");
  const input = upload.getByLabel("Agreement file");

  await input.setInputFiles({
    name: "big.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([PDF, Buffer.alloc(6 * 1024 * 1024)]),
  });
  await expect(upload.getByRole("alert")).toContainText("under 5 MB");
  await input.setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: PNG });
  await expect(upload.getByRole("alert")).toContainText("isn't a PDF");

  await input.setInputFiles({ name: "agreement.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(upload.getByText("Agreement saved.")).toBeVisible();
  const link = page.getByTestId("agreement-document");
  await expect(link).toHaveText("View PDF");
  const href = (await link.getAttribute("href"))!;
  const own = await page.request.get(href);
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toBe("application/pdf");
  expect(own.headers()["cache-control"]).toContain("no-store");

  const other = await page.context().browser()!.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, USERS.pgOwnerE);
  expect((await otherPage.request.get(href)).status()).toBe(404);
  await expectNotFound(otherPage, `/residents/${stay}`);
  await other.close();
});

test("notice during the lock-in shows a warning", async ({ page }) => {
  await login(page, USERS.pgStaffD);
  await page.goto(`/residents/${IDS.stayD_aarav}`);
  await expect(page.getByTestId("lock-in-warning")).toContainText("Lock-in runs until");
});

test("staff can't renew or attach; another PG can't use a forged agreement id", async ({
  page,
}) => {
  await login(page, USERS.pgStaffD);
  await page.goto(`/residents/${IDS.stayD_kabir}`);
  await expect(page.getByTestId("agreement")).toBeVisible();
  await expect(page.getByTestId("agreement-renew")).toHaveCount(0);
  await expect(page.getByTestId("agreement-upload")).toHaveCount(0);
  const post = await page.request.post(`/api/agreements/${KABIR_AGREEMENT}/document`, {
    multipart: { file: { name: "a.pdf", mimeType: "application/pdf", buffer: PDF } },
  });
  expect(post.status()).toBe(403);

  await page.context().clearCookies();
  await login(page, USERS.pgOwnerE);
  await page.goto(`/residents/${IDS.stayE_esha}`);
  await waitForHydration(page);
  const renew = page.getByTestId("agreement-renew");
  await renew.locator("summary").click();
  await tamperAndSubmit(
    renew.getByRole("button", { name: "Renew" }),
    "agreementId",
    KABIR_AGREEMENT,
  );
  await expect(renew.getByRole("alert")).toContainText("Agreement not found");
});

test("invalid agreement input is refused", async ({ page }) => {
  await login(page, USERS.pgOwnerD);
  // Rohan has no agreement yet.
  await page.goto("/residents/d5000000-0000-4000-8000-000000000004");
  const create = page.getByTestId("agreement-create");
  await create.getByLabel("Months", { exact: true }).fill("0");
  await create.getByRole("button", { name: "Add agreement" }).click();
  await expect(create.getByRole("alert")).toContainText("1 to 60 months");
  await create.getByLabel("Months", { exact: true }).fill("6");
  await create.getByLabel("Lock-in (months)").fill("9");
  await create.getByRole("button", { name: "Add agreement" }).click();
  await expect(create.getByRole("alert")).toContainText("Lock-in must be shorter");
});

test("Hostel setup saves the agreement defaults", async ({ page }) => {
  await login(page, USERS.pgOwnerD);
  await page.goto("/settings/hostel");
  const form = page.getByTestId("hostel-settings");
  await expect(form.getByLabel("Length (months)")).toHaveValue("11");
  await expect(form.getByLabel("Rent increase on renewal (%)")).toHaveValue("5");
  await form.getByLabel("Remind before end (days)").fill("30");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText(/Saved\./)).toBeVisible();
});
