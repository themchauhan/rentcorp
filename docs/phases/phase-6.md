# Phase 6 — Home screen and installable app polish

Replaces the earlier automated daily-reminder job (automation is out
of scope). Goal: the owner opens the app and immediately sees what's
out and who to follow up with, then acts in one tap.

## Tasks

- [x] Home screen: bookings with items still out, showing customer,
      items out, days out, amount due today; OVERDUE ones first
- [x] Each row has a one-tap **Send amount due** (opens the Phase 5
      send panel)
- [x] Shows when each customer was last messaged (from `message_log`)
      so staff don't message the same customer twice in a day by
      accident
- [x] Order status moves to OVERDUE when past expected_return_date
      with items still out — **computed on read** (`effectiveStatus()`
      in `src/lib/booking-status.ts`); no scheduled job. Stock
      commitments treat an overdue booking as still holding its items
      today (`item_commitments`, migration `…0700`)
- [x] "Starting soon" list: bookings starting in the next 3 days
- [x] PWA polish: app icon, name, splash/theme colour, `lang`, app id,
      home-screen shortcuts (New booking, Bookings); installs via "Add
      to Home Screen" on Android and iOS
- [x] Big tap targets, fast load on a mid-range Android phone on 4G

## Tests

- [x] Home list shows only the current tenant's open bookings, ordered
      with overdue first
- [x] "Last messaged" reflects the latest `message_log` entry
- [x] Cross-tenant: another tenant's bookings never appear

## Acceptance criteria

- From the home screen, the owner can see every booking still out and
  send an amount-due message to any customer in two taps

## Manual test steps

1. `npm run db:reset`, `npm run dev`, log in as `9000000102`
2. Home: summary tiles (Out now, Overdue, Due today) and seeded booking
   #1 for Demo Customer Ravi with today's amount due
3. Create a booking with start 5 days ago and return 2 days ago → Home
   shows it first, red, "2 days overdue"; Bookings list shows "Overdue"
4. On a Home row tap "Send amount due" → "Send on WhatsApp" (2 taps) →
   after reload the row says "Messaged today, <time>"
5. Create a booking starting tomorrow → listed under "Starting soon"
6. Log in as `9000000201` → only Tenant B's bookings appear

**Still to do on real phones (needs you):** "Add to Home Screen" on an
Android phone and an iPhone — tent icon, opens without browser bars,
long-press the icon for the New booking shortcut (Android).
