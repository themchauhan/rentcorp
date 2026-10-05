# WhatsApp message templates (submit to Meta)

Automatic messages must use templates Meta has approved **on each
business's WhatsApp Business Account**. Create them in WhatsApp Manager →
Message templates (or via the API) with exactly these names, **Category:
Utility**, **Language: English (`en`)**. The text and the order of the
variables must match `src/lib/whatsapp/templates.ts`.

## rentcorp_booking_details

```
Hello {{1}}, thank you for booking with {{2}}. Booking #{{3}}: {{4}}. From {{5}} to {{6}}. Total: {{7}}. Reply to this message if anything needs changing.
```
Sample values: Ravi · Sharma Tent House · 12 · 100 Plastic chair, 1 Shamiana · 12 Oct 2026, 9:00 am · 14 Oct 2026 · ₹4,500

## rentcorp_amount_due

```
Hello {{1}}, this is {{2}}. For booking #{{3}}, the amount due as of {{4}} is {{5}}. Please contact us if you have already paid.
```
Sample values: Ravi · Sharma Tent House · 12 · 13 Oct 2026 · ₹3,500

## rentcorp_final_bill

```
Hello {{1}}, thank you — all items for booking #{{3}} with {{2}} are back. Final bill {{4}}, paid {{5}}, balance {{6}}.
```
Sample values: Ravi · Sharma Tent House · 12 · ₹4,050 · ₹4,050 · ₹0

## Notes

- Meta reviews templates; approval usually takes minutes to a day. Wording
  changes need a new approval, so change the code and the template together.
- Meta's test number comes with `hello_world` only — the super admin's
  "Send test message" uses it. Create the three templates above on the
  test WhatsApp Business Account to test the real messages.
- Variables can't contain line breaks; the app joins items on one line.
