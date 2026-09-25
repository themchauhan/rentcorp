import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Items" };

export default function ItemsPage() {
  return <PlaceholderPage title="Items" phase="Phase 2" />;
}
