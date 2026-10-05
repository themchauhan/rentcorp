"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { BusinessType } from "@/lib/auth/access";
import { isNavItemActive, navItemsFor, type NavItem } from "@/lib/nav";
import { NavIcon } from "./nav-icon";
import { Spinner } from "./spinner";

/** The tab's icon, swapped for a spinner while its page is loading. */
function TabIcon({ name }: { name: NavItem["icon"] }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="h-6 w-6" /> : <NavIcon name={name} />;
}

/** Fixed bottom tab bar, shown on phones only. */
export function BottomNav({ businessType }: { businessType: BusinessType }) {
  const pathname = usePathname();
  const navItems = navItemsFor(businessType);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {navItems.map((item) => {
          const active = isNavItemActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  active ? "text-brand-700" : "text-stone-500"
                }`}
              >
                <TabIcon name={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Sidebar, shown on tablets and desktops. */
export function SideNav({ businessType }: { businessType: BusinessType }) {
  const pathname = usePathname();
  const navItems = navItemsFor(businessType);
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="space-y-1">
        {navItems.map((item) => {
          const active = isNavItemActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  active ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                <TabIcon name={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
