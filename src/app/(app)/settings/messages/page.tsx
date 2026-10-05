import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { loadTemplates } from "@/lib/booking-messages";
import { DEFAULT_TEMPLATES, PLACEHOLDERS, type MessageType } from "@/lib/messages";
import {
  PG_DEFAULT_TEMPLATES,
  PG_MESSAGE_TITLE,
  PG_MESSAGE_TYPES,
  PG_PLACEHOLDERS,
} from "@/lib/pg-messages";
import { loadPgTemplates } from "@/lib/pg-server";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "Message wording" };

const TITLES: Record<MessageType, string> = {
  BOOKING_CONFIRMATION: "Booking details",
  AMOUNT_DUE: "Amount due",
  RETURN_CONFIRMATION: "Return confirmation",
};

export default async function MessageWordingPage() {
  const owner = await requireTenantAdmin({ write: false });
  const supabase = await createClient();
  if (owner.tenant.business_type === "HOSTEL_PG") {
    const pg = await loadPgTemplates(supabase);
    return (
      <section className="max-w-2xl space-y-6">
        <div>
          <Link href="/settings" className="text-sm font-medium text-brand-700">
            ← Settings
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-stone-900">Message wording</h1>
          <p className="mt-1 text-stone-600">
            Words in {"{curly brackets}"} are filled in for each resident. SMS messages use “Rs.”.
          </p>
        </div>
        {PG_MESSAGE_TYPES.map((type) => (
          <TemplateEditor
            key={type}
            type={type}
            title={PG_MESSAGE_TITLE[type]}
            initialBody={pg[type]}
            isCustom={pg[type] !== PG_DEFAULT_TEMPLATES[type]}
          />
        ))}
        <Placeholders list={PG_PLACEHOLDERS} />
      </section>
    );
  }
  const templates = await loadTemplates(supabase);

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <Link href="/settings" className="text-sm font-medium text-brand-700">
          ← Settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-stone-900">Message wording</h1>
        <p className="mt-1 text-stone-600">
          Words in {"{curly brackets}"} are filled in for each booking. SMS messages use “Rs.” and
          switch to a short summary when the item list is long.
        </p>
      </div>
      {(Object.keys(TITLES) as MessageType[]).map((type) => (
        <TemplateEditor
          key={type}
          type={type}
          title={TITLES[type]}
          initialBody={templates[type]}
          isCustom={templates[type] !== DEFAULT_TEMPLATES[type]}
        />
      ))}
      <Placeholders list={PLACEHOLDERS} />
    </section>
  );
}

function Placeholders({ list }: { list: { key: string; meaning: string }[] }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="mb-2 font-semibold">What you can use</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {list.map((p) => (
          <div key={p.key} className="contents">
            <dt className="font-mono">{`{${p.key}}`}</dt>
            <dd className="text-stone-600">{p.meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
