import type { NavItem } from "@/lib/nav";

const paths: Record<NavItem["icon"], string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  bookings:
    "M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3 8h3m-3 4h6",
  items: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5",
  customers:
    "M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 9v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  more: "M4 6h16M4 12h16M4 18h16",
  rooms: "M3 20v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M3 16h18M7 10V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4",
  complaints:
    "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z",
};

export function NavIcon({ name }: { name: NavItem["icon"] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
