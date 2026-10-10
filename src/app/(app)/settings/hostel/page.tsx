import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { BackLink } from "@/components/back-link";
import { Field } from "@/components/ui/form";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { formatRupees, paiseToRupeesInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { addMealPlan, saveHostelSettings, updateMealPlan } from "./actions";

export const metadata: Metadata = { title: "Hostel setup" };

const card = "rounded-2xl border border-stone-200 bg-white p-4";

export default async function HostelSettingsPage() {
  const owner = await requireTenantAdmin({ write: false, type: "HOSTEL_PG" });
  const supabase = await createClient();
  const [{ data: settings }, { data: plans }] = await Promise.all([
    supabase
      .from("pg_settings")
      .select(
        "electricity_paise, deposit_paise, notice_days, agreement_months, lock_in_months, rent_increase_pct, agreement_alert_days",
      )
      .maybeSingle(),
    supabase
      .from("pg_meal_plans")
      .select("id, name, monthly_paise")
      .eq("active", true)
      .order("name"),
  ]);
  const disabled = owner.readOnly;

  return (
    <section className="max-w-lg space-y-5">
      <div>
        <BackLink href="/settings" label="Settings" />
        <h1 className="text-2xl font-bold text-stone-900">Hostel setup</h1>
        <p className="mt-1 text-stone-600">
          Defaults for new residents. Each resident keeps the amounts agreed when they moved in.
        </p>
      </div>

      <div className={card}>
        <h2 className="mb-3 font-semibold">Monthly charges and deposit</h2>
        <fieldset disabled={disabled}>
          <ActionForm action={saveHostelSettings} label="Save" testId="hostel-settings">
            <Field
              label="Electricity per resident, per month (₹)"
              name="electricity"
              inputMode="decimal"
              defaultValue={paiseToRupeesInput(settings?.electricity_paise ?? 0)}
            />
            <Field
              label="Security deposit (₹)"
              name="deposit"
              inputMode="decimal"
              defaultValue={paiseToRupeesInput(settings?.deposit_paise ?? 0)}
            />
            <Field
              label="Notice period (days)"
              name="noticeDays"
              type="number"
              inputMode="numeric"
              min={0}
              max={180}
              defaultValue={settings?.notice_days ?? 30}
            />
            <h3 className="pt-2 font-semibold">Agreements</h3>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Length (months)"
                name="agreementMonths"
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                defaultValue={settings?.agreement_months ?? 11}
              />
              <Field
                label="Lock-in (months)"
                name="lockInMonths"
                type="number"
                inputMode="numeric"
                min={0}
                max={24}
                defaultValue={settings?.lock_in_months ?? 0}
              />
              <Field
                label="Rent increase on renewal (%)"
                name="increasePct"
                inputMode="decimal"
                defaultValue={Number(settings?.rent_increase_pct ?? 5)}
              />
              <Field
                label="Remind before end (days)"
                name="alertDays"
                type="number"
                inputMode="numeric"
                min={0}
                max={120}
                defaultValue={settings?.agreement_alert_days ?? 30}
              />
            </div>
          </ActionForm>
        </fieldset>
      </div>

      <div className={card} data-testid="meal-plans">
        <h2 className="mb-1 font-semibold">Meal plans</h2>
        <p className="mb-3 text-sm text-stone-600">
          Price per month. Residents without food choose “No meals”.
        </p>
        <ul className="space-y-4">
          {(plans ?? []).map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-stone-200 p-3"
              data-testid="meal-plan"
            >
              <p className="mb-2 font-medium">
                {p.name} · {formatRupees(p.monthly_paise)}/month
              </p>
              <fieldset disabled={disabled} className="space-y-2">
                <ActionForm
                  action={updateMealPlan}
                  hidden={{ planId: p.id }}
                  label="Save plan"
                  tone="secondary"
                  className="space-y-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Name" name="name" id={`name-${p.id}`} defaultValue={p.name} />
                    <Field
                      label="Price (₹)"
                      name="price"
                      id={`price-${p.id}`}
                      inputMode="decimal"
                      defaultValue={paiseToRupeesInput(p.monthly_paise)}
                    />
                  </div>
                </ActionForm>
                <ActionForm
                  action={updateMealPlan}
                  hidden={{ planId: p.id, remove: "1" }}
                  label="Remove plan"
                  tone="danger"
                  confirm={`Remove ${p.name}?`}
                />
              </fieldset>
            </li>
          ))}
        </ul>
        <fieldset disabled={disabled} className="mt-4">
          <ActionForm
            action={addMealPlan}
            label="Add meal plan"
            tone="secondary"
            className="space-y-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <Field label="New plan name" name="name" placeholder="e.g. All meals" />
              <Field label="Price per month (₹)" name="price" inputMode="decimal" />
            </div>
          </ActionForm>
        </fieldset>
      </div>
    </section>
  );
}
