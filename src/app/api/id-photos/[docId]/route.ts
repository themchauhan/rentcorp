import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Streams one ID proof photo to a signed-in member of the same business.
// No public or long-lived link exists; nothing is cached.

const headers = (type: string) => ({
  "Content-Type": type,
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Disposition": "inline",
  "X-Content-Type-Options": "nosniff",
});

export async function GET(_request: Request, ctx: RouteContext<"/api/id-photos/[docId]">) {
  const profile = await getSessionProfile();
  if (
    !profile ||
    profile.kind !== "tenant" ||
    profile.status !== "ACTIVE" ||
    !profile.tenant ||
    profile.mustChangePassword
  ) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const { docId } = await ctx.params;
  if (!z.uuid().safeParse(docId).success)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("pg_id_documents")
    .select("storage_path, content_type, removed_at")
    .eq("id", docId)
    .maybeSingle();
  if (!doc || doc.removed_at) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: file, error } = await supabase.storage
    .from("resident-ids")
    .download(doc.storage_path);
  if (error || !file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(await file.arrayBuffer(), { headers: headers(doc.content_type) });
}
