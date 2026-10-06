"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";

/**
 * Header account button: a person icon (plus the name on wider screens).
 * Opens a small panel with the name, mobile number and Log out.
 */
export function AccountMenu({ name, mobile }: { name: string; mobile: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Account"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-10 items-center gap-2 rounded-full border border-stone-200 py-1 pr-3 pl-1 text-sm text-stone-700 hover:bg-stone-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" />
          </svg>
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{name}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-stone-200 bg-white p-3 shadow-lg"
          data-testid="account-menu"
        >
          <p className="truncate font-semibold text-stone-900">{name}</p>
          {mobile && <p className="font-mono text-sm text-stone-600">{mobile}</p>}
          <form action={signOut} className="mt-3 border-t border-stone-100 pt-3">
            <button
              type="submit"
              className="min-h-11 w-full rounded-lg border border-stone-300 bg-white px-4 text-left font-medium text-stone-700 hover:bg-stone-100"
            >
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
