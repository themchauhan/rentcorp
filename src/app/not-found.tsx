import Link from "next/link";

export default function NotFound() {
  return (
    <section className="py-12 text-center">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-stone-600">This page doesn&apos;t exist or has moved.</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-brand-700 px-5 font-medium text-white"
      >
        Go to Home
      </Link>
    </section>
  );
}
