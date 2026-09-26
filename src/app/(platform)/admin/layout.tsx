import { SignOutButton } from "@/components/sign-out-button";
import { APP_NAME } from "@/lib/app";
import { requireRole } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireRole("SUPER_ADMIN");
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <span className="font-bold text-brand-700">{APP_NAME} · Platform admin</span>
        <span className="truncate text-sm text-stone-500">{admin.name}</span>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        {children}
        <div className="mt-8 max-w-xs">
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}
