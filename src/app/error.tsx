"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="py-12 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-stone-600">
        Please try again. If it keeps happening, contact support.
      </p>
      {error.digest && <p className="mt-2 text-xs text-stone-400">Ref: {error.digest}</p>}
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-brand-700 px-5 font-medium text-white"
      >
        Try again
      </button>
    </section>
  );
}
