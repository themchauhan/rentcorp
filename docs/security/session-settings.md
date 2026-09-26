# Session and transport settings (Phase 10 review)

| Setting | Value | Where |
|---|---|---|
| Session cookie | `httpOnly`, `SameSite=Lax`, `Secure` in production, path `/` | `src/lib/supabase/cookies.ts` |
| Access token (JWT) lifetime | 1 hour, refreshed automatically by the proxy | `supabase/config.toml` `jwt_expiry` |
| Refresh token rotation | on, 10 s reuse window | `config.toml` |
| Deactivation | profile INACTIVE + Auth ban: next request loses access (RLS), refresh blocked | `src/lib/accounts.ts` |
| Public signup | disabled | `config.toml` `enable_signup = false` |
| Password minimum | 8 characters | `config.toml` |
| Sign-in rate limit | 30 / 5 min per IP (Supabase default) on hosted; raised to 300 locally for tests | `config.toml` |
| Security headers | CSP (self only, no framing), X-Frame-Options DENY, nosniff, strict referrer, Permissions-Policy, HSTS | `next.config.ts` |

`INSECURE_COOKIES=1` turns off the `Secure` flag for plain-http local runs
(the e2e server). Never set it in production.

**Decision for you (hosted project):** Supabase can also cap session
length (Auth → Sessions: time-box / inactivity timeout). Staff use the app
on their own phones all day, so a long session is convenient; a
reasonable setting is an **inactivity timeout of 30 days**. Not enabled
yet.
