import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "resident-ids";

/**
 * Permanently removes every stored file of one business (ID photos and
 * agreements under "<tenant>/"). Used only after a test business has been
 * deleted by delete_test_business(); the secret-key client is needed
 * because the business's own users no longer exist.
 */
export async function removeBusinessFiles(tenantId: string): Promise<number> {
  const storage = createAdminClient().storage.from(BUCKET);
  const files: string[] = [];
  const walk = async (prefix: string) => {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await storage.list(prefix, { limit: 100, offset });
      if (error) throw new Error(error.message);
      for (const entry of data ?? []) {
        const path = `${prefix}/${entry.name}`;
        // Folders come back without an id.
        if (entry.id) files.push(path);
        else await walk(path);
      }
      if (!data || data.length < 100) break;
    }
  };
  await walk(tenantId);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await storage.remove(files.slice(i, i + 100));
    if (error) throw new Error(error.message);
  }
  return files.length;
}
