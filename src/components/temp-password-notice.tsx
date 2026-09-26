"use client";

import { useState } from "react";

/**
 * Shows freshly generated login details exactly once. The password is not
 * stored anywhere readable, so the admin must pass it on now.
 */
export function TempPasswordNotice({
  name,
  mobile,
  password,
}: {
  name: string;
  mobile: string;
  password: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = `Login for ${name}\nMobile: ${mobile}\nTemporary password: ${password}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      role="status"
      className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900"
    >
      <p className="font-semibold">Login details for {name}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt>Mobile</dt>
        <dd className="font-mono">{mobile}</dd>
        <dt>Temporary password</dt>
        <dd className="font-mono text-base font-semibold" data-testid="temp-password">
          {password}
        </dd>
      </dl>
      <p className="mt-2 text-sm">
        Share these now — the password won&apos;t be shown again. They&apos;ll choose their own
        password when they first log in.
      </p>
      <button
        type="button"
        onClick={copy}
        className="mt-3 min-h-11 rounded-lg border border-green-300 bg-white px-4 text-sm font-medium"
      >
        {copied ? "Copied" : "Copy login details"}
      </button>
    </div>
  );
}
