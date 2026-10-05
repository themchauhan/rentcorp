import type { BusinessType } from "@/lib/auth/access";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "bookings" | "items" | "customers" | "more" | "rooms" | "complaints";
  /** Other sections that live under this tab (highlight it there too). */
  also?: string[];
};

const MORE: NavItem = {
  href: "/more",
  label: "More",
  icon: "more",
  also: ["/reports", "/team", "/settings"],
};

/** Tent house tabs (the original product). */
export const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/bookings", label: "Bookings", icon: "bookings" },
  { href: "/items", label: "Items", icon: "items" },
  { href: "/customers", label: "Customers", icon: "customers" },
  MORE,
];

/** Hostel / PG tabs. */
export const pgNavItems: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/rooms", label: "Rooms", icon: "rooms" },
  { href: "/residents", label: "Residents", icon: "customers" },
  { href: "/complaints", label: "Complaints", icon: "complaints" },
  MORE,
];

export function navItemsFor(type: BusinessType): NavItem[] {
  return type === "HOSTEL_PG" ? pgNavItems : navItems;
}

/**
 * Whether a nav link should be highlighted for the current path.
 * "/" only matches exactly; other links also match their sub-routes
 * (e.g. "/bookings/123" highlights "Bookings").
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Whether a tab is highlighted, including the sections it owns. */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  return [item.href, ...(item.also ?? [])].some((href) => isActivePath(pathname, href));
}
