// WhatsApp Cloud API wire format. Pure helpers (no I/O) so they can be
// unit-tested; the HTTP call lives in cloud-api.ts.
import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_PARAM_LENGTH = 500;

/**
 * Meta rejects template parameters containing newlines, tabs or more than
 * four consecutive spaces, and empty values. Normalise to one clean line.
 */
export function sanitizeParam(value: string): string {
  const one = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  const clamped = one.length > MAX_PARAM_LENGTH ? `${one.slice(0, MAX_PARAM_LENGTH - 1)}…` : one;
  return clamped || "-";
}

/** Indian 10-digit mobile → Meta's international format (digits only). */
export function toWhatsAppNumber(mobile: string): string {
  if (!/^[6-9]\d{9}$/.test(mobile)) throw new Error("Expected a 10-digit Indian mobile");
  return `91${mobile}`;
}

export type TemplateMessage = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components?: { type: "body"; parameters: { type: "text"; text: string }[] }[];
  };
};

export function buildTemplateBody(
  mobile: string,
  template: string,
  language: string,
  params: string[],
): TemplateMessage {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toWhatsAppNumber(mobile),
    type: "template",
    template: {
      name: template,
      language: { code: language },
      ...(params.length
        ? {
            components: [
              {
                type: "body",
                parameters: params.map((p) => ({ type: "text", text: sanitizeParam(p) })),
              },
            ],
          }
        : {}),
    },
  };
}

/** Checks Meta's `X-Hub-Signature-256: sha256=<hex>` header against the raw body. */
export function verifySignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type StatusUpdate = {
  phoneNumberId: string;
  messageId: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  errorCode: string | null;
  errorMessage: string | null;
};
export type InboundText = { phoneNumberId: string; from: string; text: string };

const STATUS_MAP: Record<string, StatusUpdate["status"]> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

/** Extracts delivery statuses and inbound text messages from a webhook payload. */
export function parseWebhook(payload: unknown): {
  statuses: StatusUpdate[];
  inbound: InboundText[];
} {
  const statuses: StatusUpdate[] = [];
  const inbound: InboundText[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return { statuses, inbound };
  for (const entry of entries) {
    for (const change of (entry as { changes?: unknown[] }).changes ?? []) {
      const value = (change as { value?: Record<string, unknown> }).value;
      const phoneNumberId = String(
        (value?.metadata as { phone_number_id?: string })?.phone_number_id ?? "",
      );
      if (!phoneNumberId) continue;
      for (const s of (value?.statuses as Record<string, unknown>[]) ?? []) {
        const status = STATUS_MAP[String(s.status)];
        if (!status || typeof s.id !== "string") continue;
        const err = (
          s.errors as { code?: number; title?: string; message?: string }[] | undefined
        )?.[0];
        statuses.push({
          phoneNumberId,
          messageId: s.id,
          status,
          errorCode: err?.code != null ? String(err.code) : null,
          errorMessage: err ? String(err.message ?? err.title ?? "").slice(0, 500) || null : null,
        });
      }
      for (const m of (value?.messages as Record<string, unknown>[]) ?? []) {
        const text = (m.text as { body?: string } | undefined)?.body;
        if (m.type === "text" && typeof m.from === "string" && typeof text === "string") {
          inbound.push({ phoneNumberId, from: m.from, text });
        }
      }
    }
  }
  return { statuses, inbound };
}

/** "STOP"-style replies that withdraw consent. */
export function isOptOut(text: string): boolean {
  return /^(stop|unsubscribe|stop all|cancel)$/i.test(text.trim());
}

const RANK: Record<StatusUpdate["status"] | "PENDING", number> = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4,
};

/** Webhooks can arrive out of order: only move status forward (failure always wins). */
export function shouldApplyStatus(
  current: StatusUpdate["status"] | "PENDING" | null,
  next: StatusUpdate["status"],
): boolean {
  if (!current) return true;
  if (current === "FAILED") return false;
  return RANK[next] > RANK[current];
}
