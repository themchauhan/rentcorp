"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createAuthUser,
  removeUnprovisionedAuthUser,
  resetPassword,
  setAccountActive,
} from "@/lib/accounts";
import { logAudit } from "@/lib/audit";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { normalizeIndianMobile } from "@/lib/auth/mobile";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Issued = { name: string; mobile: string; password: string };

export type AddStaffState = {
  error?: string;
  fieldErrors?: { name?: string; mobile?: string };
  values?: { name: string; mobile: string };
  issued?: Issued;
};

export type StaffActionState = { error?: string; issued?: Issued; done?: string };

const nameSchema = z.string().trim().min(1, "Enter a name").max(120, "Name is too long");

/**
 * Loads a STAFF member of the signed-in owner's business using the owner's
 * own session, so RLS decides visibility. Returns null for anyone outside
 * the owner's tenant, admins, or unknown ids.
 */
async function loadOwnStaff(tenantId: string, profileId: unknown) {
  const id = z.uuid().safeParse(profileId);
  if (!id.success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, name, mobile, status, tenant_id, role")
    .eq("id", id.data)
    .eq("role", "STAFF")
    .maybeSingle();
  return data && data.tenant_id === tenantId ? data : null;
}

export async function addStaff(_prev: AddStaffState, formData: FormData): Promise<AddStaffState> {
  // tenant_id comes from the session only — never from formData.
  const owner = await requireTenantAdmin();

  const values = {
    name: String(formData.get("name") ?? ""),
    mobile: String(formData.get("mobile") ?? ""),
  };
  const name = nameSchema.safeParse(values.name);
  const mobile = normalizeIndianMobile(values.mobile);
  if (!name.success || !mobile) {
    return {
      values,
      fieldErrors: {
        name: name.success ? undefined : name.error.issues[0]?.message,
        mobile: mobile ? undefined : "Enter a valid 10-digit mobile number",
      },
    };
  }

  const password = generateTempPassword();
  const created = await createAuthUser(mobile, password);
  if (!created.ok) {
    return {
      values,
      ...(created.reason === "mobile_taken"
        ? { fieldErrors: { mobile: "This mobile number already has an account" } }
        : { error: "Couldn't create the account. Please try again." }),
    };
  }

  const { error } = await createAdminClient().from("profiles").insert({
    id: created.userId,
    tenant_id: owner.tenantId,
    name: name.data,
    mobile,
    role: "STAFF",
    status: "ACTIVE",
    must_change_password: true,
  });
  if (error) {
    await removeUnprovisionedAuthUser(created.userId);
    return {
      values,
      ...(error.code === "23505"
        ? { fieldErrors: { mobile: "This mobile number already has an account" } }
        : { error: "Couldn't create the account. Please try again." }),
    };
  }

  await logAudit("staff.created", "profile", created.userId, { name: name.data, mobile });
  revalidatePath("/team");
  return { issued: { name: name.data, mobile, password } };
}

export async function resetStaffPassword(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const owner = await requireTenantAdmin();
  const staff = await loadOwnStaff(owner.tenantId, formData.get("profileId"));
  if (!staff) return { error: "Staff member not found." };

  const password = generateTempPassword();
  if (!(await resetPassword(staff.id, password))) {
    return { error: "Couldn't reset the password. Please try again." };
  }
  await logAudit("staff.password_reset", "profile", staff.id);
  return { issued: { name: staff.name, mobile: staff.mobile, password } };
}

export async function setStaffActive(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const owner = await requireTenantAdmin();
  const staff = await loadOwnStaff(owner.tenantId, formData.get("profileId"));
  if (!staff) return { error: "Staff member not found." };

  const active = formData.get("active") === "true";
  if (!(await setAccountActive(staff.id, active))) {
    return { error: "Couldn't update the account. Please try again." };
  }
  await logAudit(active ? "staff.reactivated" : "staff.deactivated", "profile", staff.id);
  revalidatePath("/team");
  return { done: active ? "Reactivated." : "Deactivated." };
}
