import { createHmac } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { IDS, login, randomMobile, uniq, USERS } from "./helpers";
import { E2E_WHATSAPP } from "./whatsapp-env";

const TENANT_A_PHONE_ID = "200000000000001"; // seeded connection
type Recorded = {
  phoneNumberId: string;
  auth: string;
  messageId: string | null;
  body: {
    to?: string;
    template?: { name: string; components?: { parameters: { text: string }[] }[] };
  };
};

async function mockRequests(request: APIRequestContext): Promise<Recorded[]> {
  return (await request.get(`${E2E_WHATSAPP.mockUrl}/__requests`)).json();
}

function webhookBody(phoneNumberId: string, value: Record<string, unknown>) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba",
        changes: [
          { field: "messages", value: { metadata: { phone_number_id: phoneNumberId }, ...value } },
        ],
      },
    ],
  });
}

async function postWebhook(
  request: APIRequestContext,
  body: string,
  secret = E2E_WHATSAPP.appSecret,
) {
  const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  return request.post("/api/whatsapp/webhook", {
    data: body,
    headers: { "content-type": "application/json", "x-hub-signature-256": sig },
  });
}

async function sendAuto(page: Page, panelType: string) {
  const panel = page.getByTestId(`send-panel-${panelType}`);
  await panel.getByRole("button", { name: "Send automatically on WhatsApp" }).click();
  await expect(panel.getByText(/Sent automatically\.|WhatsApp didn't accept it/)).toBeVisible();
  return panel;
}

async function bookingForNewCustomer(page: Page, mobile: string, consent: boolean) {
  const name = `E2E WA ${uniq()}`;
  await page.goto("/bookings/new");
  await page.getByRole("button", { name: "New customer" }).click();
  await page.getByLabel("Customer name").fill(name);
  await page.getByLabel("Mobile number").fill(mobile);
  if (consent) await page.getByLabel(/Agreed to receive WhatsApp messages/).check();
  await page.getByLabel("Search items").fill("Plastic chair");
  await page.getByLabel("Quantity of Plastic chair").fill("2");
  await page.getByRole("button", { name: "Save booking" }).click();
  const saved = page.getByText("Booking saved.");
  const dup = page.getByRole("button", { name: "Create new anyway" });
  await expect(saved.or(dup)).toBeVisible();
  if (await dup.isVisible()) await dup.click();
  await expect(saved).toBeVisible();
  return { name, url: page.url().replace(/\?.*$/, "") };
}

test("staff sends the amount due automatically through the business's own WhatsApp", async ({
  page,
  request,
}) => {
  await login(page, USERS.staffA);
  await page.goto(`/bookings/${IDS.bookingA_seed}`);
  const before = (await mockRequests(request)).length;
  const panel = await sendAuto(page, "AMOUNT_DUE");
  await expect(
    panel.getByText("Sent automatically. Delivery updates appear under Messages."),
  ).toBeVisible();

  const sent = (await mockRequests(request))
    .slice(before)
    .find((r) => r.body.template?.name === "rentcorp_amount_due");
  expect(sent).toBeDefined();
  expect(sent!.phoneNumberId).toBe(TENANT_A_PHONE_ID);
  expect(sent!.auth).toBe("Bearer dummy-local-access-token-not-real-0001");
  expect(sent!.body.to).toBe("919111111101");
  const params = sent!.body.template!.components![0].parameters.map(
    (p: { text: string }) => p.text,
  );
  expect(params.slice(0, 3)).toEqual(["Demo Customer Ravi", "Demo Tent House A", "1"]);
  expect(params[4]).toMatch(/^₹[\d,]+$/);

  // Delivery status from Meta's webhook.
  await page.reload();
  const row = page
    .getByTestId("message-log")
    .getByRole("listitem")
    .filter({ hasText: "sent automatically on WhatsApp" })
    .first();
  await expect(row.getByTestId("delivery-status")).toHaveText("Sent");
  const res = await postWebhook(
    request,
    webhookBody(TENANT_A_PHONE_ID, { statuses: [{ id: sent!.messageId, status: "delivered" }] }),
  );
  expect(res.status()).toBe(200);
  await page.reload();
  await expect(
    page
      .getByTestId("message-log")
      .getByTestId("delivery-status")
      .filter({ hasText: "Delivered" })
      .first(),
  ).toBeVisible();
});

test("webhook rejects bad signatures and verifies Meta's handshake", async ({ request }) => {
  const body = webhookBody(TENANT_A_PHONE_ID, { statuses: [{ id: "wamid.x", status: "read" }] });
  expect((await postWebhook(request, body, "wrong-secret")).status()).toBe(401);
  expect(
    (
      await request.post("/api/whatsapp/webhook", {
        data: body,
        headers: { "content-type": "application/json" },
      })
    ).status(),
  ).toBe(401);

  const ok = await request.get(
    `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${E2E_WHATSAPP.verifyToken}&hub.challenge=12345`,
  );
  expect(ok.status()).toBe(200);
  expect(await ok.text()).toBe("12345");
  const bad = await request.get(
    `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1`,
  );
  expect(bad.status()).toBe(403);
});

test("a STOP reply opts the customer out; no consent means no automatic send", async ({
  page,
  request,
}) => {
  const mobile = randomMobile();
  await login(page, USERS.staffA);
  const { url } = await bookingForNewCustomer(page, mobile, true);
  await expect(
    page.getByTestId("send-panel-BOOKING_CONFIRMATION").getByTestId("auto-send"),
  ).toBeVisible();

  const res = await postWebhook(
    request,
    webhookBody(TENANT_A_PHONE_ID, {
      messages: [{ from: `91${mobile}`, type: "text", text: { body: "STOP" } }],
    }),
  );
  expect(res.status()).toBe(200);
  await page.goto(url);
  await expect(
    page.getByTestId("send-panel-BOOKING_CONFIRMATION").getByTestId("auto-send-blocked"),
  ).toContainText("hasn't agreed");
  // Customer without consent from the start: blocked too.
  const second = await bookingForNewCustomer(page, randomMobile(), false);
  await page.goto(second.url);
  await expect(
    page.getByTestId("send-panel-BOOKING_CONFIRMATION").getByTestId("auto-send-blocked"),
  ).toContainText("hasn't agreed");
});

test("a failed send is shown and logged as Failed", async ({ page }) => {
  await login(page, USERS.staffA);
  await bookingForNewCustomer(page, "9111111199", true); // the mock refuses this number
  const panel = await sendAuto(page, "BOOKING_CONFIRMATION");
  await expect(panel.getByRole("alert")).toContainText("Recipient is not on WhatsApp");
  await page.reload();
  const failed = page
    .getByTestId("message-log")
    .getByTestId("delivery-status")
    .filter({ hasText: "Failed" });
  await expect(failed.first()).toBeVisible();
});

test("super admin connects a business, sends a test, and the token is never shown", async ({
  page,
  request,
}, testInfo) => {
  // Mutates Tenant B's shared connection: run once.
  test.skip(testInfo.project.name !== "desktop", "runs once, in the desktop project");
  const token = `e2e-b-token-${uniq()}-0000000000`;
  await login(page, USERS.superAdmin);
  await page.getByTestId("business-row").filter({ hasText: "Demo Tent House B" }).click();
  // B has no add-on in the seed: switch it on for this test, off at the end.
  await expect(page.getByTestId("whatsapp-connection")).toHaveCount(0);
  await page.getByRole("button", { name: "Switch WhatsApp automation on" }).click();
  await expect(page.getByTestId("whatsapp-addon-status")).toContainText("Add-on: On");
  const box = page.getByTestId("whatsapp-connection");
  await box.getByLabel("WhatsApp Business Account ID").fill("100000000000002");
  await box.getByLabel("Phone number ID").fill("300000000000002");
  await box.getByLabel("WhatsApp number customers see").fill("+91 90000 00200");
  await box.getByLabel(/Access token/).fill(token);
  await box.getByRole("button", { name: /Connect WhatsApp|Save connection/ }).click();
  await expect(box.getByText(/WhatsApp connected\./)).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("whatsapp-status")).toHaveText("Connected: +91 90000 00200");
  expect(await page.content()).not.toContain(token);

  const before = (await mockRequests(request)).length;
  await page.getByLabel("Send Meta’s test message to").fill("9111111201");
  await page.getByRole("button", { name: "Send test message" }).click();
  await expect(page.getByText("Test message sent to 9111111201.")).toBeVisible();
  const hello = (await mockRequests(request))
    .slice(before)
    .find((r) => r.body.template?.name === "hello_world");
  expect(hello?.phoneNumberId).toBe("300000000000002");
  expect(hello?.auth).toBe(`Bearer ${token}`);

  // A status update arriving on B's number can't touch Tenant A's messages.
  const aSent = (await mockRequests(request)).find(
    (r) => r.phoneNumberId === TENANT_A_PHONE_ID && r.messageId,
  );
  if (aSent) {
    await postWebhook(
      request,
      webhookBody("300000000000002", { statuses: [{ id: aSent.messageId, status: "failed" }] }),
    );
  }
  await page.getByRole("button", { name: "Switch WhatsApp automation off" }).click();
  await expect(page.getByTestId("whatsapp-addon-status")).toContainText("Add-on: Off");
  await expect(page.getByTestId("whatsapp-connection")).toHaveCount(0);

  await page.context().clearCookies();
  await login(page, USERS.staffA);
  await page.goto(`/bookings/${IDS.bookingA_seed}`);
  await expect(
    page.getByTestId("message-log").getByTestId("delivery-status").filter({ hasText: "Failed" }),
  ).toHaveCount(0);
});

test("owners see the connection status; another business has no automatic button", async ({
  page,
}) => {
  await login(page, USERS.adminA);
  await page.goto("/settings");
  await expect(page.getByTestId("settings-whatsapp")).toContainText("Connected: +91 90000 00100");

  await page.context().clearCookies();
  await login(page, USERS.staffB);
  await page.goto("/bookings/b3000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("button", { name: "Send automatically on WhatsApp" })).toHaveCount(0);
});
