"use client";

import { useState } from "react";

/**
 * A <details> section whose open/closed state belongs to the browser after
 * first render, so server refreshes (e.g. after saving a form inside it)
 * don't collapse it and hide the result message.
 */
export function Collapsible({
  title,
  initiallyOpen = false,
  testId,
  children,
}: {
  title: string;
  initiallyOpen?: boolean;
  testId?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group rounded-2xl border border-stone-200 bg-white p-4"
      data-testid={testId}
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold">
        {title}
        <span aria-hidden="true" className="transition group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
