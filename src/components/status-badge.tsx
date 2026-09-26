const LABEL = {
  ACTIVE: "Active",
  PARTIALLY_RETURNED: "Partly returned",
  RETURNED: "Returned",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
} as const;

const TONE = {
  ACTIVE: "bg-green-100 text-green-800",
  PARTIALLY_RETURNED: "bg-amber-100 text-amber-800",
  RETURNED: "bg-stone-200 text-stone-700",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-stone-200 text-stone-500",
} as const;

export type BookingStatus = keyof typeof LABEL;

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE[status]}`}>
      {LABEL[status]}
    </span>
  );
}
