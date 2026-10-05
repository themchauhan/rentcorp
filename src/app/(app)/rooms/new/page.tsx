import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { createRoom } from "../actions";
import { RoomForm } from "../room-form";

export const metadata: Metadata = { title: "Add room" };

export default async function NewRoomPage() {
  await requireTenantAdmin({ type: "HOSTEL_PG" });
  return (
    <section className="max-w-lg">
      <BackLink href="/rooms" label="Rooms" />
      <h1 className="mt-2 mb-6 text-2xl font-bold text-stone-900">Add room</h1>
      <RoomForm
        action={createRoom}
        submitLabel="Save room"
        initial={{ name: "", floor: "", rentMode: "PER_BED", rent: "", beds: "2", notes: "" }}
      />
    </section>
  );
}
