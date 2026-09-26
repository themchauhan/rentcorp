import { signOut } from "@/app/auth/actions";

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={`min-h-12 w-full rounded-lg border border-stone-300 bg-white px-4 text-left font-medium text-stone-700 hover:bg-stone-100 ${className}`}
      >
        Log out
      </button>
    </form>
  );
}
