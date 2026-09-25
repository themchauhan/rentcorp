# Tent House

Mobile-first web app for tent-house / event-rental businesses: item
catalog with rates, bookings, automatic amount-due calculation, and
one-tap WhatsApp/SMS messages sent from the owner's own phone.

- Product brief: [`docs/BRIEF.md`](docs/BRIEF.md)
- Project rules: [`CLAUDE.md`](CLAUDE.md)
- Build phases: [`docs/phases/`](docs/phases)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
Supabase (Postgres, Auth, Storage) · Vitest · Playwright · Vercel (`bom1`)

## Prerequisites

- **Node.js 22+** (`.nvmrc` is provided — `nvm use` if you use nvm)
- **Docker Desktop**, running — local Supabase runs in containers
- Git

The Supabase CLI and Playwright are installed as dev dependencies; no
global installs are needed.

## Local setup

```bash
git clone <repo-url> tent-house-management
cd tent-house-management
npm install
```

### 1. Start local Supabase

```bash
npm run db:start
```

The first run downloads the Supabase Docker images and takes a few
minutes. When it finishes it prints the local URLs and keys.

This project uses ports **55420–55429** (not Supabase's default
54321–54329), so it can run alongside other local Supabase projects.

| Service              | URL                                                       |
| -------------------- | --------------------------------------------------------- |
| API                  | http://127.0.0.1:55421                                    |
| Studio (DB admin UI) | http://127.0.0.1:55423                                    |
| Mailpit (test inbox) | http://127.0.0.1:55424                                    |
| Postgres             | `postgresql://postgres:postgres@127.0.0.1:55422/postgres` |

Re-print the keys any time with `npx supabase status`.

> **If `db:start` fails with `HealthCheckTimeoutError`:** Docker is
> short on CPU/memory. Stop any other local Supabase project
> (`npx supabase stop` in its folder) and/or raise Docker Desktop's
> limits (Settings → Resources; 4+ CPUs and 6+ GB RAM recommended),
> then run `npm run db:start` again. Realtime and analytics are
> disabled in `supabase/config.toml` because this app doesn't use them.

### 2. Create your env file

```bash
cp .env.example .env.local
```

Fill in the values from `npx supabase status` — see the comments in
`.env.example` for which value goes where. `.env.local` is git-ignored;
never commit real keys.

### 3. Run the app

```bash
npm run dev
```

Open http://localhost:3000. To try it at phone size, use your browser's
device toolbar, or open `http://<your-computer's-LAN-IP>:3000` on a
phone on the same Wi-Fi.

## Scripts

| Command                | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Dev server on http://localhost:3000                    |
| `npm run build`        | Production build                                       |
| `npm run lint`         | ESLint (fails on any warning)                          |
| `npm run typecheck`    | Generate Next route types, then `tsc --noEmit`         |
| `npm run format`       | Format everything with Prettier                        |
| `npm run format:check` | Check formatting without writing                       |
| `npm test`             | Unit tests (Vitest)                                    |
| `npm run test:e2e`     | Smoke tests (Playwright, phone + desktop)              |
| `npm run db:start`     | Start local Supabase                                   |
| `npm run db:stop`      | Stop local Supabase                                    |
| `npm run db:reset`     | Recreate the local DB from migrations + seed           |
| `npm run icons`        | Regenerate PWA icons from `scripts/generate-icons.mjs` |

### First-time Playwright setup

```bash
npx playwright install chromium
```

`npm run test:e2e` builds the app and serves it on port 3100 before
running the tests.

## Project layout

```
src/app/          Routes (App Router), layout, error/404 pages, manifest
src/components/   Shared UI (app shell, navigation)
src/lib/          Plain TypeScript helpers (unit-tested alongside, *.test.ts)
e2e/              Playwright tests
supabase/         Local Supabase config; migrations + seed arrive in Phase 1b
docs/             Product brief and phase checklists
scripts/          One-off dev scripts
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull
request: install → lint → format check → typecheck → unit tests →
build → Playwright smoke tests.

## Deployment

Deployed on Vercel, pinned to the Mumbai region (`bom1`) in
`vercel.json`. Set the same environment variables as `.env.example`
in the Vercel project settings, using the hosted Supabase project's
values.
