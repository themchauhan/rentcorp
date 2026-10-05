"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FormMessage } from "@/components/ui/form";
import { completeEmbeddedSignup } from "./actions";

// Meta's Embedded Signup ("Connect with Meta"). Only rendered when the Meta
// app id and Embedded Signup configuration id are set (after Meta approves
// RentCorp as a Tech Provider).
type FB = {
  init: (o: Record<string, unknown>) => void;
  login: (
    cb: (r: { authResponse?: { code?: string } }) => void,
    o: Record<string, unknown>,
  ) => void;
};
declare global {
  interface Window {
    FB?: FB;
    fbAsyncInit?: () => void;
  }
}

export function EmbeddedSignupButton({
  appId,
  configId,
  graphVersion,
}: {
  appId: string;
  configId: string;
  graphVersion: string;
}) {
  const session = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  const [ready, setReady] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; done?: string }>({});

  useEffect(() => {
    // Meta posts the chosen WABA / phone number back to this window.
    function onMessage(e: MessageEvent) {
      if (!/(^|\.)facebook\.com$/.test(new URL(e.origin).hostname)) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data.event?.startsWith("FINISH")) {
          session.current = {
            wabaId: data.data?.waba_id,
            phoneNumberId: data.data?.phone_number_id,
          };
        }
      } catch {
        /* not ours */
      }
    }
    window.addEventListener("message", onMessage);
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
      setReady(true);
    };
    if (!document.getElementById("facebook-jssdk")) {
      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.crossOrigin = "anonymous";
      document.body.appendChild(s);
    } else if (window.FB) {
      window.fbAsyncInit();
    }
    return () => window.removeEventListener("message", onMessage);
  }, [appId, graphVersion]);

  function connect() {
    window.FB?.login(
      (response) => {
        const code = response.authResponse?.code;
        const { wabaId, phoneNumberId } = session.current;
        if (!code || !wabaId || !phoneNumberId) {
          setResult({ error: "Sign-up wasn’t finished. Please try again." });
          return;
        }
        start(async () => setResult(await completeEmbeddedSignup({ code, wabaId, phoneNumberId })));
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: "3" },
      },
    );
  }

  return (
    <div className="space-y-3">
      {result.error && <FormMessage tone="error">{result.error}</FormMessage>}
      {result.done && <FormMessage tone="success">{result.done}</FormMessage>}
      <button
        type="button"
        onClick={connect}
        disabled={!ready || pending}
        className="min-h-12 w-full rounded-lg bg-[#1877F2] px-5 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Connecting…" : "Connect with Meta (WhatsApp)"}
      </button>
    </div>
  );
}
