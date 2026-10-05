import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { tenantAccess } from "@/lib/auth/access";
import { getSessionProfile } from "@/lib/auth/session";
import { ID_TYPES } from "@/lib/pg";
import { createClient } from "@/lib/supabase/server";

// Uploads one ID proof photo for a resident into the private
// "resident-ids" bucket, through the user's own session (Storage RLS:
// only the caller's own business folder). The browser shrinks photos
// before sending; the full ID number is never stored.

const MAX_BYTES = 2 * 1024 * 1024; // matches the bucket limit
const TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

/** Checks the file really is the image type it claims (magic bytes). */
function looksLike(type: keyof typeof TYPES, b: Uint8Array): boolean {
  if (type === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  return (
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  );
}

const fields = z.object({
  customerId: z.uuid(),
  docType: z.enum(ID_TYPES),
  side: z.enum(["FRONT", "BACK", "OTHER"]),
});

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (
    !profile ||
    profile.kind !== "tenant" ||
    profile.status !== "ACTIVE" ||
    !profile.tenant ||
    profile.tenant.business_type !== "HOSTEL_PG" ||
    !tenantAccess(profile.tenant).ok ||
    profile.mustChangePassword
  ) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const parsed = fields.safeParse({
    customerId: form.get("customerId"),
    docType: form.get("docType"),
    side: form.get("side") || "FRONT",
  });
  const file = form.get("file");
  if (!parsed.success || !(file instanceof File))
    return NextResponse.json({ error: "Choose a photo and the ID type." }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES)
    return NextResponse.json({ error: "The photo must be under 2 MB." }, { status: 400 });
  const type = file.type as keyof typeof TYPES;
  if (!(type in TYPES))
    return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLike(type, bytes))
    return NextResponse.json({ error: "That file isn't a photo." }, { status: 400 });

  const supabase = await createClient();
  // The resident must belong to the caller's business (RLS).
  const { data: customer } = await supabase
    .from("rental_customers")
    .select("id")
    .eq("id", parsed.data.customerId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const path = `${profile.tenant.id}/${customer.id}/${crypto.randomUUID()}.${TYPES[type]}`;
  const { error: uploadError } = await supabase.storage
    .from("resident-ids")
    .upload(path, bytes, { contentType: type, upsert: false });
  if (uploadError) {
    console.error("ID photo upload failed:", uploadError.message);
    return NextResponse.json({ error: "Couldn't upload. Please try again." }, { status: 500 });
  }
  const { data: doc, error } = await supabase
    .from("pg_id_documents")
    .insert({
      customer_id: customer.id,
      doc_type: parsed.data.docType,
      side: parsed.data.side,
      storage_path: path,
      content_type: type,
      size_bytes: bytes.length,
    })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from("resident-ids").remove([path]);
    if (error.code === "23514" && /Up to 4/.test(error.message))
      return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("pg_id_documents insert failed:", error.message);
    return NextResponse.json({ error: "Couldn't save. Please try again." }, { status: 500 });
  }
  await logAudit("pg.id_uploaded", "pg_id_document", doc.id, {
    customer_id: customer.id,
    doc_type: parsed.data.docType,
    side: parsed.data.side,
  });
  return NextResponse.json({ id: doc.id });
}
