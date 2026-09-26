import { AppShell } from "@/components/app-shell";
import { requireActiveTenant } from "@/lib/auth/guards";

// Every tenant screen needs the signed-in user's session.
export const dynamic = "force-dynamic";

export default async function TenantLayout({ children }: LayoutProps<"/">) {
  const profile = await requireActiveTenant();
  return (
    <AppShell businessName={profile.tenant.name} userName={profile.name}>
      {children}
    </AppShell>
  );
}
