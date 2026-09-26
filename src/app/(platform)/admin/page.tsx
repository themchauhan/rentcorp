import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Platform admin" };

export default function PlatformAdminPage() {
  return <PlaceholderPage title="Platform dashboard" phase="Phase 9 (tenants, subscriptions)" />;
}
