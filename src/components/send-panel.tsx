"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { sendAutomatically } from "@/app/actions/whatsapp";
import { detectPlatform, smsLink, whatsappLink, type Platform } from "@/lib/message-links";
import type { MessageType } from "@/lib/messages";
import type { PgMessageType } from "@/lib/pg-messages";

type Channel = "WHATSAPP" | "SMS" | "COPY";

const noopSubscribe = () => () => {};

const CHANNEL_DONE: Record<Channel, string> = {
  WHATSAPP: "Opened in WhatsApp",
  SMS: "Opened in SMS",
  COPY: "Copied",
};

/**
 * Message preview with Send on WhatsApp / Send SMS / Copy. The buttons are
 * plain links so the phone opens the app immediately; each tap is logged
 * in the background. We can't know if the message was actually sent, so
 * the UI only ever says "Opened in …".
 */
export function SendPanel({
  orderId,
  stayId,
  type,
  title,
  whatsappText,
  smsText,
  mobile,
  whatsappNumber,
  preferredChannel,
  autoSend,
}: {
  /** The booking (tent house) or the resident's stay (hostel/PG). */
  orderId?: string;
  stayId?: string;
  type: MessageType | PgMessageType;
  title: string;
  whatsappText: string;
  smsText: string;
  mobile: string;
  whatsappNumber: string | null;
  preferredChannel: "WHATSAPP" | "SMS";
  /**
   * Present when the business has WhatsApp connected. `blocker` explains why
   * this customer can't get an automatic message (null = they can).
   */
  autoSend?: { blocker: "no_whatsapp" | "no_consent" | null };
}) {
  // Server render assumes Android; the browser reports the real platform.
  const platform = useSyncExternalStore<Platform>(
    noopSubscribe,
    () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
    () => "android",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [showSms, setShowSms] = useState(!whatsappNumber || preferredChannel === "SMS");
  const [sending, startSending] = useTransition();
  const [autoResult, setAutoResult] = useState<{ ok: boolean; text: string } | null>(null);

  function sendAuto() {
    startSending(async () => {
      if (!orderId || type === "RENT_DUE" || type === "PAYMENT_RECEIPT") return;
      const r = await sendAutomatically(orderId, type);
      setAutoResult(
        r.ok
          ? { ok: true, text: "Sent automatically. Delivery updates appear under Messages." }
          : { ok: false, text: r.error },
      );
    });
  }

  function log(channel: Channel, body: string) {
    const time = new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    setStatus(`${CHANNEL_DONE[channel]} · ${time}`);
    void fetch("/api/message-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        stayId ? { stayId, type, channel, body } : { orderId, type, channel, body },
      ),
      keepalive: true,
    })
      .then((r) => {
        if (!r.ok) setStatus("Couldn't record this in the message log. Please tap again.");
      })
      .catch(() => setStatus("Couldn't record this in the message log. Please tap again."));
  }

  async function copy() {
    const body = showSms ? smsText : whatsappText;
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      setStatus("Couldn't copy on this phone. Long-press the text to copy.");
      return;
    }
    log("COPY", body);
  }

  const primary = "bg-brand-700 text-white";
  const secondary = "border border-stone-300 bg-white text-stone-800";
  const button =
    "flex min-h-12 items-center justify-center rounded-lg px-4 font-semibold whitespace-nowrap";
  const waPreferred = preferredChannel === "WHATSAPP" && !!whatsappNumber;

  return (
    <section
      className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4"
      aria-label={title}
      data-testid={`send-panel-${type}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          type="button"
          onClick={() => setShowSms((s) => !s)}
          className="text-sm font-medium text-brand-700"
        >
          {showSms ? "Show WhatsApp text" : "Show SMS text"}
        </button>
      </div>
      <pre
        className="max-h-72 overflow-auto rounded-lg bg-stone-50 p-3 font-sans text-sm whitespace-pre-wrap"
        data-testid="message-preview"
      >
        {showSms ? smsText : whatsappText}
      </pre>
      {autoSend && autoSend.blocker === null && (
        <div className="space-y-2" data-testid="auto-send">
          <button
            type="button"
            onClick={sendAuto}
            disabled={sending || autoResult?.ok}
            className={`${button} w-full bg-green-700 text-white disabled:opacity-60`}
          >
            {sending
              ? "Sending…"
              : autoResult?.ok
                ? "Sent automatically ✓"
                : "Send automatically on WhatsApp"}
          </button>
          {autoResult && (
            <p
              role={autoResult.ok ? "status" : "alert"}
              className={`text-sm ${autoResult.ok ? "text-green-800" : "text-red-700"}`}
            >
              {autoResult.text}
            </p>
          )}
          <p className="text-center text-xs text-stone-500">or send it yourself:</p>
        </div>
      )}
      {autoSend && autoSend.blocker !== null && (
        <p className="text-xs text-stone-500" data-testid="auto-send-blocked">
          Automatic WhatsApp:{" "}
          {autoSend.blocker === "no_consent"
            ? "customer hasn't agreed to WhatsApp messages (edit the customer to record consent)."
            : "customer has no WhatsApp number."}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {whatsappNumber ? (
          <a
            href={whatsappLink(whatsappNumber, whatsappText)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => log("WHATSAPP", whatsappText)}
            className={`${button} col-span-2 ${waPreferred ? primary : secondary}`}
          >
            Send on WhatsApp
          </a>
        ) : (
          <span className={`${button} col-span-2 ${secondary} opacity-50`} aria-disabled="true">
            Not on WhatsApp
          </span>
        )}
        <a
          href={smsLink(mobile, smsText, platform)}
          onClick={() => log("SMS", smsText)}
          className={`${button} ${waPreferred ? secondary : primary}`}
        >
          Send SMS
        </a>
        <button type="button" onClick={copy} className={`${button} ${secondary}`}>
          Copy
        </button>
      </div>
      {status && (
        <p role="status" className="text-sm text-stone-600">
          {status}
        </p>
      )}
    </section>
  );
}
