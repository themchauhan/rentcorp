import { AppShell } from "@/components/app-shell";
import { requireTenantMember } from "@/lib/auth/guards";

// Every tenant screen needs the signed-in user's session.
export const dynamic = "force-dynamic";

export default async function TenantLayout({ children }: LayoutProps<"/">) {
  const profile = await requireTenantMember();
  const readOnly = profile.access.ok ? null : profile.access.reason;
  return (
    <AppShell
      businessName={profile.tenant.name}
      userName={profile.name}
      readOnly={readOnly}
      businessType={profile.tenant.business_type}
    >
      {children}
    </AppShell>
  );
}
