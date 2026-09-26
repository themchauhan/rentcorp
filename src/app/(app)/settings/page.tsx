import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Business settings" };

export default async function SettingsPage() {
  await requireRole("ADMIN");
  return <PlaceholderPage title="Business settings" phase="later phases (owner only)" />;
}
