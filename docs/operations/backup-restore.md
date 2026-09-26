# Backup and recovery

## Tested locally (2026-09-26)

```bash
npm run db:backup-test
```

Dumps `public`, `private` and `auth` from the local database, restores
them into a brand-new database, compares row counts for every app table
and checks RLS is still enabled. Last run: all 16 tables matched, RLS
intact. The dump is kept in `./backups/` (git-ignored).

## Hosted Supabase (to do before the pilot — needs you)

1. Use a paid plan with **daily backups**; turn on **Point-in-Time
   Recovery** if the budget allows (restore to any minute).
2. Weekly, keep an off-site copy you control:
   `pg_dump "<connection string>" -Fc --schema=public --schema=private --schema=auth > backup.dump`
   stored encrypted (e.g. a password-protected drive), never in git.
3. **Restore drill (monthly, and once before the pilot):** create a
   throwaway Supabase project, restore the latest backup into it (or
   `pg_restore --no-owner` the weekly dump as the `supabase_admin` /
   `postgres` owner), point a local build at it, log in with a known
   account and check a few bookings, then delete the throwaway project.
   Write the date and result below.

| Date | Backup used | Restored into | Result | By |
|---|---|---|---|---|
| 2026-09-26 | local pg_dump | local `restore_test` DB | ✓ all tables match | automated |

## If something goes wrong

- Bad data change → PITR to just before it (hosted) or restore the
  latest dump into a new project and copy back the affected rows.
- Lost project → restore the latest backup into a new project, update
  the app's environment variables, redeploy.
