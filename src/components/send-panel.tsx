"use client";

import { useState, useSyncExternalStore } from "react";
import { detectPlatform, smsLink, whatsappLink, type Platform } from "@/lib/message-links";
import type { MessageType } from "@/lib/messages";

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
  type,
  title,
  whatsappText,
  smsText,
  mobile,
  whatsappNumber,
  preferredChannel,
}: {
  orderId: string;
  type: MessageType;
  title: string;
  whatsappText: string;
  smsText: string;
  mobile: string;
  whatsappNumber: string | null;
  preferredChannel: "WHATSAPP" | "SMS";
}) {
  // Server render assumes Android; the browser reports the real platform.
  const platform = useSyncExternalStore<Platform>(
    noopSubscribe,
    () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints),
    () => "android",
  );
  const [status, setStatus] = useState<string | null>(null);
  const [showSms, setShowSms] = useState(!whatsappNumber || preferredChannel === "SMS");

  function log(channel: Channel, body: string) {
    const time = new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    setStatus(`${CHANNEL_DONE[channel]} · ${time}`);
    void fetch("/api/message-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, type, channel, body }),
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
