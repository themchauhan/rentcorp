import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage() {
  return <PlaceholderPage title="Customers" phase="Phase 3" />;
}
