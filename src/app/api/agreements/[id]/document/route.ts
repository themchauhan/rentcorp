import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { tenantAccess } from "@/lib/auth/access";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// The signed rent agreement (PDF or photo) for one agreement. Stored in the
// private bucket under <tenant>/<customer>/agreements/, through the user's
// own session (Storage RLS: own business folder only). Never a public link.

const BUCKET = "resident-ids";
const LIMITS = {
  "application/pdf": { ext: "pdf", max: 5 * 1024 * 1024, label: "5 MB" },
  "image/jpeg": { ext: "jpg", max: 2 * 1024 * 1024, label: "2 MB" },
  "image/png": { ext: "png", max: 2 * 1024 * 1024, label: "2 MB" },
  "image/webp": { ext: "webp", max: 2 * 1024 * 1024, label: "2 MB" },
} as const;
type DocType = keyof typeof LIMITS;

/** The file really is what it claims to be (magic bytes). */
function looksLike(type: DocType, b: Uint8Array): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (type === "application/pdf") return ascii(0, 5) === "%PDF-";
  if (type === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === "image/png") return b[0] === 0x89 && ascii(1, 4) === "PNG";
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

async function member(write: boolean) {
  const profile = await getSessionProfile();
  if (
    !profile ||
    profile.kind !== "tenant" ||
    profile.status !== "ACTIVE" ||
    !profile.tenant ||
    profile.tenant.business_type !== "HOSTEL_PG" ||
    profile.mustChangePassword ||
    (write && (profile.role !== "ADMIN" || !tenantAccess(profile.tenant).ok))
  )
    return null;
  return { ...profile, tenant: profile.tenant };
}

export async function POST(request: Request, ctx: RouteContext<"/api/agreements/[id]/document">) {
  const profile = await member(true);
  if (!profile) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  const type = file.type as DocType;
  const limit = LIMITS[type];
  if (!limit)
    return NextResponse.json({ error: "Use a PDF or a photo (JPG, PNG, WebP)." }, { status: 400 });
  if (file.size === 0 || file.size > limit.max)
    return NextResponse.json({ error: `The file must be under ${limit.label}.` }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLike(type, bytes))
    return NextResponse.json({ error: "That file isn't a PDF or photo." }, { status: 400 });

  const supabase = await createClient();
  // The agreement must belong to the caller's business (RLS).
  const { data: agreement } = await supabase
    .from("pg_agreements")
    .select("id, stay_id, stay:pg_stays (customer_id)")
    .eq("id", id)
    .maybeSingle();
  if (!agreement?.stay) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const path = `${profile.tenant.id}/${agreement.stay.customer_id}/agreements/${crypto.randomUUID()}.${limit.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: type, upsert: false });
  if (uploadError) {
    console.error("Agreement upload failed:", uploadError.message);
    return NextResponse.json({ error: "Couldn't upload. Please try again." }, { status: 500 });
  }
  const { data: replaced, error } = await supabase.rpc("pg_set_agreement_document", {
    p_agreement_id: agreement.id,
    p_path: path,
    p_type: type,
    p_size: bytes.length,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  // The previous file is replaced: delete it.
  if (replaced) await supabase.storage.from(BUCKET).remove([replaced]);
  await logAudit("pg.agreement_document_uploaded", "pg_agreement", agreement.id, {
    type,
    size: bytes.length,
    replaced: Boolean(replaced),
  });
  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, ctx: RouteContext<"/api/agreements/[id]/document">) {
  const profile = await member(false);
  if (!profile) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: a } = await supabase
    .from("pg_agreements")
    .select("document_path, document_type")
    .eq("id", id)
    .maybeSingle();
  if (!a?.document_path || !a.document_type)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: file, error } = await supabase.storage.from(BUCKET).download(a.document_path);
  if (error || !file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(await file.arrayBuffer(), {
    headers: {
      "Content-Type": a.document_type,
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `inline; filename="agreement.${LIMITS[a.document_type as DocType]?.ext ?? "bin"}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
