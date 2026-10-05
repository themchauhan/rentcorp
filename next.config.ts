import type { NextConfig } from "next";

// Security headers for every response. The browser only ever talks to this
// app's own origin (Supabase is called server-side), so the policy can stay
// tight. 'unsafe-inline' scripts are needed for Next's inline bootstrap
// scripts; eval is only allowed in development (fast refresh).
const isDev = process.env.NODE_ENV !== "production";
// Meta's "Connect with Meta" (Embedded Signup) needs its SDK, popup frames
// and Graph calls — allowed only once the Meta app is configured.
const meta = Boolean(
  process.env.NEXT_PUBLIC_META_APP_ID && process.env.NEXT_PUBLIC_META_ES_CONFIG_ID,
);
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${meta ? " https://connect.facebook.net" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}${meta ? " https://*.facebook.com https://graph.facebook.com" : ""}`,
  `frame-src 'self'${meta ? " https://*.facebook.com" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
