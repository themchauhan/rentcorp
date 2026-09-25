# Phase 6 — Home screen and installable app polish

Replaces the earlier automated daily-reminder job (automation is out
of scope). Goal: the owner opens the app and immediately sees what's
out and who to follow up with, then acts in one tap.

## Tasks

- [ ] Home screen: bookings with items still out, showing customer,
      items out, days out, amount due today; OVERDUE ones first
- [ ] Each row has a one-tap **Send amount due** (opens the Phase 5
      send panel)
- [ ] Shows when each customer was last messaged (from `message_log`)
      so staff don't message the same customer twice in a day by
      accident
- [ ] Order status moves to OVERDUE when past expected_return_date
      with items still out (computed on read or via a lightweight
      daily status update — no messages sent)
- [ ] PWA polish: app icon, name, splash/theme colour, installs
      cleanly via "Add to Home Screen" on Android and iOS
- [ ] Big tap targets, fast load on a mid-range Android phone on 4G

## Tests

- [ ] Home list shows only the current tenant's open bookings, ordered
      with overdue first
- [ ] "Last messaged" reflects the latest `message_log` entry
- [ ] Cross-tenant: another tenant's bookings never appear

## Acceptance criteria

- From the home screen, the owner can see every booking still out and
  send an amount-due message to any customer in two taps
