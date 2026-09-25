# Phase 1a — Project scaffold & tooling

## Tasks

- [ ] Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- [ ] ESLint + Prettier configured; `npm run lint` clean
- [ ] Supabase CLI set up for local dev
- [ ] Mobile-first base layout: bottom nav on phones (placeholder
      links only), sidebar/top nav on desktop; 404/error pages
- [ ] PWA basics: web app manifest, icons placeholder, theme colour,
      viewport meta — installable via "Add to Home Screen"
- [ ] `.env.example` with every variable the app needs, no real values
- [ ] CI: install, lint, typecheck, build, on every push
- [ ] `README.md`: local setup steps from clone to running app
- [ ] Vitest configured with one passing sample test
- [ ] Playwright configured with one passing smoke test, run at a
      mobile viewport as well as desktop

## Acceptance criteria

- `npm run build` succeeds; `npm run lint` passes; CI is green
- A new developer can go from `git clone` to a running local app using
  only the README
- The shell looks right on a ~360px-wide phone screen
