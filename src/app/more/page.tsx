import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "More" };

export default function MorePage() {
  return <PlaceholderPage title="More" phase="later phases" />;
}
