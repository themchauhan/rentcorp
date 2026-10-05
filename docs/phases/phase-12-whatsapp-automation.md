# Phase 12 — WhatsApp automation (step 3)

Owner decisions (2026-10-01): connection link = **both** (paste details now,
Meta's Embedded Signup button later); evening message at **9:00 PM IST** to
**everyone with money due**; booking details **right after saving**.

## Tasks

- [x] Owner page Settings → WhatsApp: connect own number (paste details;
      business always from the session), test message, disconnect
- [x] "Connect with Meta" (Embedded Signup) button — shown only when
      `NEXT_PUBLIC_META_APP_ID` + `NEXT_PUBLIC_META_ES_CONFIG_ID` are set;
      server exchanges the code, subscribes the app to the WABA, saves
- [x] `whatsapp_settings`: automatic booking details / 9 PM balance on-off
- [x] Booking details sent automatically on save (banner on the booking)
- [x] 9 PM job `/api/cron/evening-reminders` (Vercel Cron `30 15 * * *`),
      `CRON_SECRET`, once per booking per day (claimed before sending),
      per-business isolation, `job_runs` shown to the super admin
- [x] Shared send core (`deliver`) used by button, on-save and job

## Tests

- [x] pgTAP `96_whatsapp_automation`
- [x] Vitest `evening.test.ts` (who gets which message)
- [x] Playwright `e2e/whatsapp-automation.spec.ts`: on-save send / no
      consent, cron secret, staff blocked, full owner journey (self-connect
      with forged tenant ignored, every booking state, setting off, 9 PM
      sends exactly the right messages, re-run sends nothing)

## Going live (needs you)

1. Vercel → Settings → Environment Variables: add `CRON_SECRET` (long random
   string), `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; redeploy.
   Vercel picks up the cron from `vercel.json` (free plan: once a day; it
   may run a little after 9 PM).
2. `npx supabase db push` for migrations `20261001000100` and `…0200`.
3. Meta: webhook URL `https://<site>/api/whatsapp/webhook`, verify token,
   subscribe to `messages`; create the 3 templates in
   `docs/whatsapp/templates.md` on each business's WhatsApp account.
4. Each owner: Settings → WhatsApp → connect → tick consent on customers.
5. Later: apply to Meta as a Tech Provider, create an Embedded Signup
   configuration, set `NEXT_PUBLIC_META_APP_ID` and
   `NEXT_PUBLIC_META_ES_CONFIG_ID`; the "Connect with Meta" button appears.
   Test it once with a real account (it can't be tested locally).
