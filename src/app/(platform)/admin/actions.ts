"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuthUser, removeUnprovisionedAuthUser, resetPassword } from "@/lib/accounts";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { normalizeIndianMobile } from "@/lib/auth/mobile";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Issued = { name: string; mobile: string; password: string };

type BusinessFields = "businessName" | "businessPhone" | "ownerName" | "ownerMobile";
export type CreateBusinessState = {
  error?: string;
  fieldErrors?: Partial<Record<BusinessFields, string>>;
  values?: Record<BusinessFields, string>;
  issued?: Issued & { businessName: string };
};

export type OwnerActionState = { error?: string; issued?: Issued };

const text = (label: string) =>
  z.string().trim().min(1, `Enter ${label}`).max(120, `${label} is too long`);

export async function createBusiness(
  _prev: CreateBusinessState,
  formData: FormData,
): Promise<CreateBusinessState> {
  await requireRole("SUPER_ADMIN");

  const values = {
    businessName: String(formData.get("businessName") ?? ""),
    businessPhone: String(formData.get("businessPhone") ?? ""),
    ownerName: String(formData.get("ownerName") ?? ""),
    ownerMobile: String(formData.get("ownerMobile") ?? ""),
  };
  const businessName = text("the business name").safeParse(values.businessName);
  const ownerName = text("the owner's name").safeParse(values.ownerName);
  const ownerMobile = normalizeIndianMobile(values.ownerMobile);
  const businessPhone = values.businessPhone.trim()
    ? normalizeIndianMobile(values.businessPhone)
    : "";

  const fieldErrors: CreateBusinessState["fieldErrors"] = {};
  if (!businessName.success) fieldErrors.businessName = businessName.error.issues[0]?.message;
  if (!ownerName.success) fieldErrors.ownerName = ownerName.error.issues[0]?.message;
  if (!ownerMobile) fieldErrors.ownerMobile = "Enter a valid 10-digit mobile number";
  if (businessPhone === null) fieldErrors.businessPhone = "Enter a valid 10-digit number";
  if (!businessName.success || !ownerName.success || !ownerMobile || businessPhone === null) {
    return { values, fieldErrors };
  }

  const password = generateTempPassword();
  const created = await createAuthUser(ownerMobile, password);
  if (!created.ok) {
    return {
      values,
      ...(created.reason === "mobile_taken"
        ? { fieldErrors: { ownerMobile: "This mobile number already has an account" } }
        : { error: "Couldn't create the account. Please try again." }),
    };
  }

  // Tenant + owner profile are created in one transaction.
  const { data: tenantId, error } = await createAdminClient().rpc("provision_tenant_with_owner", {
    p_tenant_name: businessName.data,
    p_owner_id: created.userId,
    p_owner_name: ownerName.data,
    p_owner_mobile: ownerMobile,
    ...(businessPhone ? { p_tenant_phone: businessPhone } : {}),
  });
  if (error || !tenantId) {
    await removeUnprovisionedAuthUser(created.userId);
    console.error("provision_tenant_with_owner failed:", error?.message);
    return { values, error: "Couldn't create the business. Please try again." };
  }

  await logAudit(
    "tenant.created",
    "tenant",
    tenantId,
    { name: businessName.data, owner_id: created.userId, owner_mobile: ownerMobile },
    { tenantId },
  );
  revalidatePath("/admin");
  return {
    issued: {
      businessName: businessName.data,
      name: ownerName.data,
      mobile: ownerMobile,
      password,
    },
  };
}

export async function resetOwnerPassword(
  _prev: OwnerActionState,
  formData: FormData,
): Promise<OwnerActionState> {
  await requireRole("SUPER_ADMIN");
  const id = z.uuid().safeParse(formData.get("profileId"));
  if (!id.success) return { error: "Owner not found." };

  const supabase = await createClient();
  const { data: owner } = await supabase
    .from("profiles")
    .select("id, name, mobile, tenant_id")
    .eq("id", id.data)
    .eq("role", "ADMIN")
    .maybeSingle();
  if (!owner) return { error: "Owner not found." };

  const password = generateTempPassword();
  if (!(await resetPassword(owner.id, password))) {
    return { error: "Couldn't reset the password. Please try again." };
  }
  await logAudit("owner.password_reset", "profile", owner.id, {}, { tenantId: owner.tenant_id });
  return { issued: { name: owner.name, mobile: owner.mobile, password } };
}
