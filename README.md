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
minutes. It applies the migrations in `supabase/migrations` and loads
the dummy data in `supabase/seed.sql`, then prints the local URLs and
keys.

`db:start` skips Studio (the database admin UI) because it is slow to
boot on smaller machines. Use `npm run db:start:studio` when you want it.

This project uses ports **55420–55429** (not Supabase's default
54321–54329), so it can run alongside other local Supabase projects.

| Service              | URL                                                       |
| -------------------- | --------------------------------------------------------- |
| API                  | http://127.0.0.1:55421                                    |
| Studio (DB admin UI) | http://127.0.0.1:55423 (only with `db:start:studio`)      |
| Postgres             | `postgresql://postgres:postgres@127.0.0.1:55422/postgres` |

Re-print the keys any time with `npx supabase status`.

> **If `db:start` fails with `HealthCheckTimeoutError`:** Docker is
> short on CPU/memory. Stop any other local Supabase project
> (`npx supabase stop` in its folder) and/or raise Docker Desktop's
> limits (Settings → Resources; 4+ CPUs and 6+ GB RAM recommended),
> then run `npm run db:start` again. Realtime, analytics, storage and
> edge functions are disabled in `supabase/config.toml` because the app
> doesn't use them yet.

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

Open http://localhost:3000 and log in with a seed account. To try it at phone size, use your browser's
device toolbar, or open `http://<your-computer's-LAN-IP>:3000` on a
phone on the same Wi-Fi.

### Seed logins (local only)

Everyone logs in with a **mobile number + password**. All seed accounts
use the password `Demo@1234`:

| Mobile       | Account                          |
| ------------ | -------------------------------- |
| `9000000001` | Super admin (platform dashboard) |
| `9000000101` | Owner (admin), Demo Tent House A |
| `9000000102` | Staff, Demo Tent House A         |
| `9000000103` | Deactivated staff (can't log in) |
| `9000000201` | Owner (admin), Demo Tent House B |
| `9000000301` | Owner of a suspended business    |

The full list is at the top of `supabase/seed.sql`. `npm run db:reset`
restores them if you change anything.

## Scripts

| Command                   | What it does                                                          |
| ------------------------- | --------------------------------------------------------------------- |
| `npm run dev`             | Dev server on http://localhost:3000                                   |
| `npm run build`           | Production build                                                      |
| `npm run lint`            | ESLint (fails on any warning)                                         |
| `npm run typecheck`       | Generate Next route types, then `tsc --noEmit`                        |
| `npm run format`          | Format everything with Prettier                                       |
| `npm run format:check`    | Check formatting without writing                                      |
| `npm test`                | Unit tests (Vitest)                                                   |
| `npm run test:e2e`        | E2E tests (Playwright, phone + desktop; needs local Supabase running) |
| `npm run db:start`        | Start local Supabase (without Studio)                                 |
| `npm run db:start:studio` | Start local Supabase including Studio                                 |
| `npm run db:stop`         | Stop local Supabase                                                   |
| `npm run db:reset`        | Recreate the local DB from migrations + seed                          |
| `npm run db:test`         | Database / RLS tests (pgTAP, `supabase/tests`)                        |
| `npm run db:types`        | Regenerate `src/lib/supabase/database.types.ts`                       |
| `npm run icons`           | Regenerate PWA icons from `scripts/generate-icons.mjs`                |

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
supabase/         Local Supabase config, migrations, seed, pgTAP tests
docs/             Product brief and phase checklists
scripts/          One-off dev scripts
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull
request: install → lint → format check → typecheck → unit tests →
start local Supabase → RLS tests → build → client-bundle secret check →
Playwright e2e tests.

## Deployment

Deployed on Vercel, pinned to the Mumbai region (`bom1`) in
`vercel.json`. Set the same environment variables as `.env.example`
in the Vercel project settings, using the hosted Supabase project's
values.
