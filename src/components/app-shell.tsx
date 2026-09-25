import Link from "next/link";
import { APP_NAME } from "@/lib/app";
import { BottomNav, SideNav } from "./nav-links";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-stone-200 bg-white p-4 md:block">
        <Link href="/" className="mb-6 block px-3 text-lg font-bold text-brand-700">
          {APP_NAME}
        </Link>
        <SideNav />
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white px-4 py-3 md:hidden">
          <Link href="/" className="text-lg font-bold text-brand-700">
            {APP_NAME}
          </Link>
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
