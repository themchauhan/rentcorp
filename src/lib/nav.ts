export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "bookings" | "items" | "customers" | "more";
};

// Placeholder destinations only — each screen is built in its own phase.
export const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/bookings", label: "Bookings", icon: "bookings" },
  { href: "/items", label: "Items", icon: "items" },
  { href: "/customers", label: "Customers", icon: "customers" },
  { href: "/more", label: "More", icon: "more" },
];

/**
 * Whether a nav link should be highlighted for the current path.
 * "/" only matches exactly; other links also match their sub-routes
 * (e.g. "/bookings/123" highlights "Bookings").
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
