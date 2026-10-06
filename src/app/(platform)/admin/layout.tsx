import { AccountMenu } from "@/components/account-menu";
import { APP_NAME } from "@/lib/app";
import { requireRole } from "@/lib/auth/guards";
import { mobileFromLoginEmail } from "@/lib/auth/mobile";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireRole("SUPER_ADMIN");
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-2">
        <span className="truncate font-bold text-brand-700">{APP_NAME} · Platform admin</span>
        <AccountMenu name={admin.name} mobile={mobileFromLoginEmail(admin.loginEmail)} />
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
