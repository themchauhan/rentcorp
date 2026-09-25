# Phase 1a — Project scaffold & tooling

## Tasks

- [x] Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- [x] ESLint + Prettier configured; `npm run lint` clean
- [x] Supabase CLI set up for local dev (ports 55420–55429; starts,
      but health checks time out while another local Supabase stack
      shares the Docker VM — see README troubleshooting)
- [x] Mobile-first base layout: bottom nav on phones (placeholder
      links only), sidebar/top nav on desktop; 404/error pages
- [x] PWA basics: web app manifest, icons placeholder, theme colour,
      viewport meta — installable via "Add to Home Screen"
- [x] `.env.example` with every variable the app needs, no real values
- [ ] CI: install, lint, typecheck, build, on every push — workflow
      written; not yet run (no GitHub remote)
- [x] `README.md`: local setup steps from clone to running app
- [x] Vitest configured with one passing sample test
- [x] Playwright configured with one passing smoke test, run at a
      mobile viewport as well as desktop

## Acceptance criteria

- `npm run build` succeeds; `npm run lint` passes; CI is green
- A new developer can go from `git clone` to a running local app using
  only the README
- The shell looks right on a ~360px-wide phone screen

## Manual test steps

1. `npm install`, `npm run db:start`, `cp .env.example .env.local`,
   fill values from `npx supabase status`, `npm run dev`
2. Open http://localhost:3000 at phone width (~360–375px): header at
   top, 5-tab bottom bar, no sideways scrolling
3. Tap each tab: page title changes, active tab is highlighted
4. Widen to desktop: bottom bar disappears, sidebar appears
5. Visit `/nope`: 404 page with a "Go to Home" button that works
6. Open `/manifest.webmanifest`: name, icons, `display: standalone`
7. *(not yet run)* On a real phone on the same Wi-Fi, open the app and use
   "Add to Home Screen": tent icon appears and opens without browser UI
