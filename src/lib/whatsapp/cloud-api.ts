import "server-only";
import { buildTemplateBody } from "./protocol";

// Thin client for Meta's WhatsApp Cloud API. Server-only: it handles access
// tokens. Version and base URL are settings so tests can point at a mock.
const BASE_URL = (process.env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com").replace(
  /\/$/,
  "",
);
const VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v21.0";

export type SendResult =
  { ok: true; messageId: string } | { ok: false; code: string; message: string };

export async function sendTemplate({
  phoneNumberId,
  token,
  to,
  template,
  language,
  params,
}: {
  phoneNumberId: string;
  token: string;
  to: string;
  template: string;
  language: string;
  params: string[];
}): Promise<SendResult> {
  let body;
  try {
    body = buildTemplateBody(to, template, language, params);
  } catch (e) {
    return { ok: false, code: "bad_number", message: (e as Error).message };
  }
  try {
    const res = await fetch(
      `${BASE_URL}/${VERSION}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { code?: number; message?: string; error_data?: { details?: string } };
    };
    const id = json.messages?.[0]?.id;
    if (res.ok && id) return { ok: true, messageId: id };
    return {
      ok: false,
      code: String(json.error?.code ?? res.status),
      message: (
        json.error?.error_data?.details ||
        json.error?.message ||
        `HTTP ${res.status}`
      ).slice(0, 500),
    };
  } catch (e) {
    const timeout = (e as Error).name === "TimeoutError";
    return {
      ok: false,
      code: timeout ? "timeout" : "network",
      message: timeout ? "WhatsApp didn't answer in time" : "Couldn't reach WhatsApp",
    };
  }
}

// ---------------------------------------------------------------------------
// Embedded Signup (Meta's "Connect WhatsApp" popup). After the owner finishes
// the popup we get a short-lived code plus their WABA and phone number IDs.
// ---------------------------------------------------------------------------

async function graph<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(`${BASE_URL}/${VERSION}${path}`, {
      ...init,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok || json.error)
      return { ok: false, message: json.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, data: json };
  } catch {
    return { ok: false, message: "Couldn't reach Meta" };
  }
}

/** Exchanges the Embedded Signup code for the business's access token. */
export async function exchangeSignupCode(code: string) {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!appId || !secret) return { ok: false as const, message: "Meta app isn't configured" };
  const q = new URLSearchParams({ client_id: appId, client_secret: secret, code });
  const r = await graph<{ access_token?: string }>(`/oauth/access_token?${q}`);
  if (!r.ok) return r;
  if (!r.data.access_token) return { ok: false as const, message: "Meta returned no token" };
  return { ok: true as const, token: r.data.access_token };
}

/** Subscribes our app to the business's WABA so its webhooks reach us. */
export async function subscribeAppToWaba(wabaId: string, token: string) {
  return graph<{ success?: boolean }>(`/${encodeURIComponent(wabaId)}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** The phone number customers see, e.g. "+91 98765 43210". */
export async function fetchDisplayNumber(phoneNumberId: string, token: string) {
  const r = await graph<{ display_phone_number?: string }>(
    `/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return r.ok ? (r.data.display_phone_number ?? null) : null;
}
