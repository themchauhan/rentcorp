import type { CookieOptionsWithName } from "@supabase/ssr";

// The app never talks to Supabase from the browser, so session cookies
// don't need to be readable by page scripts: httpOnly keeps them out of
// reach of any injected script. Lax blocks cross-site POSTs carrying them.
export const SESSION_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
  path: "/",
};
