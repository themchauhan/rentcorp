import type { Metadata } from "next";
import Link from "next/link";
import { requireActiveTenant } from "@/lib/auth/guards";
import { todayIST } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage({ searchParams }: PageProps<"/bookings/new">) {
  const raw = (await searchParams).customer;
  const initialCustomerId = Array.isArray(raw) ? raw[0] : raw;

  const member = await requireActiveTenant();
  const supabase = await createClient();
  const [{ data: items }, { data: customers }] = await Promise.all([
    supabase
      .from("rental_items")
      .select("id, name, category, unit_label, rate_paise, rate_unit, total_quantity_owned")
      .eq("active", true)
      .order("category")
      .order("name"),
    supabase
      .from("rental_customers")
      .select("id, name, mobile")
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);

  return (
    <section className="max-w-2xl">
      <Link href="/bookings" className="text-sm font-medium text-brand-700">
        ← Bookings
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold text-stone-900">New booking</h1>
      {!items?.length ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-stone-600">
          No items in the catalog yet. Add items first.
        </p>
      ) : (
        <BookingForm
          showWhatsAppConsent={member.tenant.whatsapp_addon}
          today={todayIST()}
          initialCustomerId={initialCustomerId}
          customers={customers ?? []}
          items={items.map((i) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            unitLabel: i.unit_label,
            ratePaise: i.rate_paise,
            rateUnit: i.rate_unit,
            owned: i.total_quantity_owned,
          }))}
        />
      )}
    </section>
  );
}
