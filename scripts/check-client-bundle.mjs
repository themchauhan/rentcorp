// Fails if anything secret-looking made it into the browser bundle.
// Run after `npm run build`:  node scripts/check-client-bundle.mjs
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = ".next/static";

const patterns = [
  /sb_secret_[A-Za-z0-9_-]{8,}/, // Supabase secret key
  /SUPABASE_SECRET_KEY/,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /"role"\s*:\s*"service_role"/, // decoded legacy service-role JWT payload
  /postgres(ql)?:\/\/[^"'\s]*:[^"'\s]*@/, // DB connection string with password
];

// Also look for the literal secret value, if it is set in this environment.
const secret = process.env.SUPABASE_SECRET_KEY;
if (secret && secret.length >= 8)
  patterns.push(new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

let scanned = 0;
const hits = [];
try {
  for await (const file of files(ROOT)) {
    if (!/\.(js|css|json|html|txt|map)$/.test(file)) continue;
    scanned++;
    const text = await readFile(file, "utf8");
    for (const pattern of patterns) {
      if (pattern.test(text)) hits.push(`${file}: matches ${pattern}`);
    }
  }
} catch (error) {
  console.error(`Could not scan ${ROOT} — run \`npm run build\` first.\n${error.message}`);
  process.exit(1);
}

if (scanned === 0) {
  console.error(`No files found in ${ROOT} — run \`npm run build\` first.`);
  process.exit(1);
}
if (hits.length) {
  console.error("Secret-looking content found in the client bundle:\n" + hits.join("\n"));
  process.exit(1);
}
console.log(`Client bundle clean (${scanned} files scanned).`);
