import Link from "next/link";
import { BottomNav, SideNav } from "./nav-links";
import { SignOutButton } from "./sign-out-button";

export function AppShell({
  businessName,
  userName,
  children,
}: {
  businessName: string;
  userName: string;
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
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
