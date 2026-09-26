// Direct Supabase access for tests: as a real signed-in user (to prove RLS
// holds even without the app), or with the secret key (to inspect audit
// logs). Reads the local .env.local; never used by the app itself.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function env(name: string): string {
  if (process.env[name]) return process.env[name]!;
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim();
  if (!value) throw new Error(`${name} missing (.env.local)`);
  return value;
}

export function adminDb() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false },
  });
}

export async function userDb(mobile: string, password: string) {
  const db = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: { persistSession: false },
    },
  );
  const { error } = await db.auth.signInWithPassword({
    email: `91${mobile}@mobile.invalid`,
    password,
  });
  if (error) throw error;
  return db;
}
