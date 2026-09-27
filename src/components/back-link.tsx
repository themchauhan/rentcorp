import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center text-sm font-medium text-brand-700"
    >
      ← {label}
    </Link>
  );
}
