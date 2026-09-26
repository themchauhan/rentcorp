import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">You don&apos;t have access to this page</h1>
      <p className="mt-2 text-stone-600">
        Your account&apos;s role doesn&apos;t allow this. Ask your business owner if you need it.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-brand-700 px-5 font-medium text-white"
      >
        Go to Home
      </Link>
    </main>
  );
}
