# Phase 11 — WhatsApp Cloud API (step 2: core integration)

Follows the owner's deck `RentCorp_WhatsApp_Integration_Presentation.pptx`.
Step 3 (daily scheduler, reminder settings, duplicate protection) is next.

## Tasks

- [x] `whatsapp_connections` per business; tokens in Supabase Vault via
      service-role-only `wa_set_credentials()` / `wa_access_token()`
- [x] Server-only Cloud API client (`src/lib/whatsapp/cloud-api.ts`), version
      and base URL configurable
- [x] Fixed templates `rentcorp_booking_details`, `rentcorp_amount_due`,
      `rentcorp_final_bill` (`docs/whatsapp/templates.md`)
- [x] Customer consent (`whatsapp_opt_in`) on the customer form; STOP reply
      opts out
- [x] "Send automatically on WhatsApp" on the booking page and Home, with a
      reason when not possible; manual buttons unchanged
- [x] Message history shows Sent / Delivered / Read / Failed for automatic
      sends; server-only logging (users can't fake API rows)
- [x] Signed webhook `/api/whatsapp/webhook` (GET handshake, POST statuses +
      STOP)
- [x] Super admin: connect / update / disconnect a business, send Meta's
      `hello_world` test; owner Settings shows status

## Tests

- [x] pgTAP `95_whatsapp_api`: connections per business, token functions
      service-role only, users can't fake API sends or delivery status
- [x] Vitest: message body, parameter cleaning, signature check, webhook
      parsing, status ordering, consent
- [x] Playwright (`e2e/whatsapp-api.spec.ts`, mock Graph API
      `e2e/mock-graph.mjs`): automatic send with correct template/params/
      token, delivered via webhook, bad signature 401, handshake, STOP,
      failure, super admin connect + test (token never in page), other
      business unaffected

## Manual test with Meta's test number (needs you)

1. Meta developer app → WhatsApp → API Setup: note the **test phone number
   ID**, **WhatsApp Business Account ID**, a **temporary access token**, and
   add your own phone as a recipient.
2. Locally (`npm run dev`), as super admin: Businesses → a **Test** business →
   WhatsApp → enter the IDs, the display number and the token → Connect →
   "Send test message" to your phone. You should get Meta's hello_world.
3. In WhatsApp Manager create the three templates from
   `docs/whatsapp/templates.md` on the test account; wait for approval.
4. As that business's owner: add a customer with your number, tick "Agreed
   to receive WhatsApp messages", make a booking → "Send automatically on
   WhatsApp" → message arrives; status shows "Sent".
5. Delivery statuses need the webhook, which Meta can only reach on the
   deployed site: set Callback URL `https://<your-site>/api/whatsapp/webhook`,
   Verify token = `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, subscribe to `messages`;
   set `WHATSAPP_APP_SECRET` (App settings → Basic) in Vercel. Then statuses
   change to Delivered / Read.

Temporary tokens from API Setup expire in ~24 hours; for longer use create a
System User token in Meta Business Settings.
