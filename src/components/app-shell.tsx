import Link from "next/link";
import { BottomNav, SideNav } from "./nav-links";
import { SignOutButton } from "./sign-out-button";

const READ_ONLY_TEXT = {
  SUSPENDED: "This account is suspended.",
  EXPIRED: "Your subscription has ended.",
  TRIAL_ENDED: "Your free trial has ended.",
  SUBSCRIPTION_ENDED: "Your subscription has ended.",
} as const;

export function AppShell({
  businessName,
  userName,
  readOnly = null,
  children,
}: {
  businessName: string;
  userName: string;
  /** Why the business is read-only, if it is. */
  readOnly?: keyof typeof READ_ONLY_TEXT | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-stone-200 bg-white p-4 md:flex md:flex-col">
        <Link href="/" className="mb-6 block px-3 text-lg font-bold text-brand-700">
          {businessName}
        </Link>
        <SideNav />
        <div className="mt-auto space-y-2 pt-6">
          <p className="truncate px-3 text-sm text-stone-500">{userName}</p>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 md:hidden">
          <Link href="/" className="truncate text-lg font-bold text-brand-700">
            {businessName}
          </Link>
          <span className="shrink-0 truncate text-sm text-stone-500">{userName}</span>
        </header>
        {/* Bottom padding keeps content clear of the fixed phone tab bar. */}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-24 md:px-8 md:py-8">
          {readOnly && (
            <div
              role="status"
              className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
              data-testid="read-only-banner"
            >
              <strong>{READ_ONLY_TEXT[readOnly]}</strong> You can view your bookings and customers
              but not make changes. Your data is safe. Contact support to renew.
            </div>
          )}
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
