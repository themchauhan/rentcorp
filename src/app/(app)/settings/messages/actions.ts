"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { DEFAULT_TEMPLATES } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

export type TemplateState = { error?: string; saved?: string; body?: string };

const schema = z.object({
  type: z.enum(["BOOKING_CONFIRMATION", "AMOUNT_DUE", "RETURN_CONFIRMATION"]),
  body: z
    .string()
    .trim()
    .min(1, "The message can't be empty")
    .max(2000, "Keep it under 2000 characters"),
});

export async function saveTemplate(
  _prev: TemplateState,
  formData: FormData,
): Promise<TemplateState> {
  await requireTenantAdmin();
  const reset = formData.get("reset") === "1";
  const type = String(formData.get("type") ?? "");
  const parsed = schema.safeParse({
    type,
    body: reset ? DEFAULT_TEMPLATES[type as keyof typeof DEFAULT_TEMPLATES] : formData.get("body"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid message",
      body: String(formData.get("body") ?? ""),
    };
  }

  const supabase = await createClient();
  // tenant_id is filled from the session by the database.
  const { error } = await supabase
    .from("message_templates")
    .upsert(
      { message_type: parsed.data.type, body: parsed.data.body },
      { onConflict: "tenant_id,message_type" },
    );
  if (error) {
    console.error("saveTemplate failed:", error.message);
    return { error: "Couldn't save. Please try again.", body: parsed.data.body };
  }
  await logAudit("message_template.updated", "message_template", parsed.data.type, {
    reset,
    length: parsed.data.body.length,
  });
  revalidatePath("/settings/messages");
  return { saved: reset ? "Back to the default wording." : "Saved.", body: parsed.data.body };
}
