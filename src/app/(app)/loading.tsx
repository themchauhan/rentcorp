import { Spinner } from "@/components/spinner";

// Shown instantly while the next screen loads on the server.
export default function Loading() {
  return (
    <div
      role="status"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-brand-700"
    >
      <Spinner className="h-8 w-8" />
      <span className="text-sm text-stone-600">Loading…</span>
    </div>
  );
}
