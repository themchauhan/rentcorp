// Creates a SUPER_ADMIN (platform admin) login. Run manually — there is
// deliberately no web route for this.
//
//   node --env-file=.env.local scripts/create-super-admin.mjs --mobile 98765 43210 --name "Your Name"
//
// Prompts for the password twice (hidden). For hosted Supabase, point
// NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY at that project instead.
// If stdin is not a terminal, the password is read from the first line.
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

// Keep in sync with src/lib/auth/mobile.ts.
const LOGIN_EMAIL_DOMAIN = "mobile.invalid";
function normalizeIndianMobile(input) {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function ask(question, { hidden }) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Echo nothing while typing.
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(question);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    const lines = [];
    for await (const line of createInterface({ input: process.stdin })) lines.push(line);
    return lines[0] ?? "";
  }
  const first = await ask("Password (min 8 characters): ", { hidden: true });
  const second = await ask("Repeat password: ", { hidden: true });
  if (first !== second) fail("Passwords don't match.");
  return first;
}

const { values, positionals } = parseArgs({
  options: { mobile: { type: "string" }, name: { type: "string" } },
  allowPositionals: true,
});
// Allow `--mobile 98765 43210` (space inside the number).
const mobileInput = [values.mobile, ...positionals].filter(Boolean).join("");
const mobile = normalizeIndianMobile(mobileInput ?? "");
const name = values.name?.trim();
if (!mobile) fail("Pass a valid 10-digit Indian mobile with --mobile.");
if (!name) fail('Pass the admin\'s name with --name "Full Name".');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (use --env-file=.env.local).");
}

const password = await readPassword();
if (password.length < 8) fail("Password must be at least 8 characters.");

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email: `91${mobile}@${LOGIN_EMAIL_DOMAIN}`,
  password,
  email_confirm: true,
});
if (error || !data.user) {
  fail(
    error?.code === "email_exists"
      ? `Mobile ${mobile} already has an account.`
      : `Couldn't create the login: ${error?.message}`,
  );
}

const { error: insertError } = await admin
  .from("platform_admins")
  .insert({ user_id: data.user.id, name });
if (insertError) {
  // Don't leave a login behind that isn't a platform admin.
  await admin.auth.admin.deleteUser(data.user.id);
  fail(`Couldn't register the platform admin: ${insertError.message}`);
}

console.log(`✓ Super admin "${name}" created. Log in with mobile ${mobile}.`);
