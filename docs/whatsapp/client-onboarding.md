# WhatsApp automation add-on — setup guide

Automatic WhatsApp is an **optional extra**. A business without it sees the
simple app: one-tap **Send on WhatsApp / Send SMS / Copy** buttons only. No
WhatsApp settings link, no consent checkbox, no automatic button.

With the add-on, the business's **own** WhatsApp Business number sends:

- booking details right after a booking is saved, and
- one balance message per booking at 9 PM IST while money is due.

Meta charges the business for these messages. RentCorp never pays Meta and
never sends from its own number.

---

## What the client (business owner) must arrange

The client owns everything on Meta's side. They need:

1. **A Facebook account** for the owner, to log in to Meta Business.
2. **A Meta Business account** at business.facebook.com, in the business's
   legal name.
3. **A phone number (SIM) used only for this.** It must **not** be active on
   the normal WhatsApp or WhatsApp Business app. If it is, delete that
   WhatsApp account on the phone first. Its chat history is lost. A fresh
   SIM is simplest. The SIM must be able to receive one SMS or call for the
   code.
4. **WhatsApp Business Platform set up** in WhatsApp Manager, with that
   number added and verified by code. Choose a display name that matches
   the business. Meta reviews the name.
5. **Business verification** in Meta Business Settings → Security Centre
   (GST certificate, shop licence or similar). Without it, Meta limits how
   many customers can be messaged per day.
6. **A payment method** in WhatsApp Manager → Payment settings (card or
   prepaid credit). Meta bills per message. Utility messages to Indian
   numbers cost roughly ₹0.1–0.2 each; check Meta's current rate card.
7. **The three message templates**, submitted in WhatsApp Manager →
   Message templates exactly as written in `docs/whatsapp/templates.md`
   (category Utility, language English). Approval usually takes minutes to
   a day.
8. **A permanent access token**: Business Settings → System users → add a
   system user (Admin) → assign the WhatsApp account with full control →
   Generate token with `whatsapp_business_messaging` and
   `whatsapp_business_management`, expiry **Never**.
9. **Customer consent.** Tick "Agreed to receive WhatsApp messages" on each
   customer only after the customer has said yes. Customers who reply STOP
   are switched off automatically.

The client then enters in RentCorp → More → Settings → WhatsApp:

- WhatsApp Business Account ID and Phone number ID (WhatsApp Manager →
  API Setup)
- the number customers see
- the permanent token (saved encrypted, never shown again)

Or, once Meta has approved RentCorp as a Tech Provider, they tap **Connect
with Facebook** instead.

## What you (RentCorp) do

1. **One-time platform setup** (already done once for all clients):
   - a Meta app with the WhatsApp product
   - webhook URL `https://<your domain>/api/whatsapp/webhook`, subscribed to
     `messages`
   - Vercel env vars `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
     and `CRON_SECRET`

   See `docs/phases/phase-11-whatsapp-api.md`.
2. **Agree the price** of the add-on with the client. Meta's message
   charges are billed to them directly.
3. **Switch the add-on on**: Super admin → the business → "WhatsApp
   automation (add-on)" → **Switch WhatsApp automation on**. The owner now
   sees Settings → WhatsApp.
4. **Send the client this guide** and the template text
   (`docs/whatsapp/templates.md`).
5. **Help connect.** Either the owner enters the details, or you enter them
   on the super admin business page.
6. **Check it works.** Send Meta's test message to your own phone from the
   connection box. Then create a test booking for a customer who agreed
   (your own number) and confirm "Booking details sent automatically" and
   the delivery status under Messages.
7. **Go live.** The owner leaves "Send booking details" and "9 PM balance
   message" on, or switches either off in Settings → WhatsApp.

**Switching off.** Super admin → **Switch WhatsApp automation off**. All
automatic sending stops at once and the app returns to the one-tap buttons.
The saved connection is kept, so switching on again resumes without
reconnecting.

## Common problems

| Problem | Fix |
| --- | --- |
| "Recipient is not on WhatsApp" | The customer's WhatsApp number is wrong, or they don't use WhatsApp. Use Send SMS. |
| "Template not found / not approved" | The template is missing, still pending, or its name/wording differs from `templates.md`. |
| Token errors (code 190) | The token expired or was revoked. Generate a permanent system-user token and save it again. |
| Number can't be added in Meta | It is still registered on the WhatsApp app. Delete that WhatsApp account first. |
| Only some customers get messages | Business not verified (daily limit), or those customers haven't agreed. |
