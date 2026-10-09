"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/app";

// "Install RentCorp" card at the top of the screen, like the one Chrome
// shows for installable sites. Android / desktop Chrome: the Install button
// opens the browser's own install dialog. iPhone / iPad (no install API):
// explains Share → Add to Home Screen. Hidden once installed, and for 24
// hours after the user closes it (Chrome's own bar stays hidden too).

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "install-prompt-dismissed-until";
const DISMISS_HOURS = 24;
const SHOW_AFTER_MS = 1500;

function dismissedRecently(): boolean {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [mode, setMode] = useState<"android" | "ios" | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if (isInstalled()) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onPrompt = (e: Event) => {
      // Always stop Chrome's own install bar, even while our card is
      // snoozed; otherwise Chrome shows its bar instead on every visit.
      e.preventDefault();
      setDeferred(e as InstallEvent);
      if (!dismissedRecently()) timer = setTimeout(() => setMode("android"), SHOW_AFTER_MS);
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIos() && !dismissedRecently()) timer = setTimeout(() => setMode("ios"), SHOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function close() {
    setMode(null);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_HOURS * 3_600_000));
    } catch {
      // private mode etc.: it just shows again next time
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setMode(null);
    else close();
  }

  if (!mode) return null;
  return (
    <div
      role="dialog"
      aria-label={`Install ${APP_NAME}`}
      data-testid="install-prompt"
      className="fixed inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
      <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-stone-900">Install {APP_NAME}</p>
        {mode === "android" ? (
          <p className="truncate text-sm text-stone-500">{window.location.host}</p>
        ) : (
          <p className="text-sm text-stone-600">
            Tap{" "}
            <svg
              aria-label="Share"
              viewBox="0 0 24 24"
              className="inline h-4 w-4 align-[-2px] text-brand-700"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>{" "}
            Share, then <strong>Add to Home Screen</strong>
          </p>
        )}
      </div>
      {mode === "android" && (
        <button
          type="button"
          onClick={install}
          className="min-h-10 shrink-0 rounded-lg px-3 font-semibold text-brand-700 hover:bg-brand-50"
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={close}
        aria-label="Not now"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
