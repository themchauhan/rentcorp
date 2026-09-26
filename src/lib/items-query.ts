import "server-only";
import { DEFAULT_CATEGORIES } from "@/lib/items";
import type { SupabaseServerClient } from "@/lib/supabase/server";

/** Categories for the form chips: defaults first, then the business's own. */
export async function categoryOptions(supabase: SupabaseServerClient): Promise<string[]> {
  const { data } = await supabase.from("rental_items").select("category");
  const seen = new Set<string>(DEFAULT_CATEGORIES.map((c) => c.toLowerCase()));
  const own: string[] = [];
  for (const { category } of data ?? []) {
    const key = category.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      own.push(category);
    }
  }
  own.sort((a, b) => a.localeCompare(b));
  // Keep "Other" last.
  const defaults = DEFAULT_CATEGORIES.filter((c) => c !== "Other");
  return [...defaults, ...own, "Other"];
}
