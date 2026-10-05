"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { MessageType } from "@/lib/messages";
import { sendBookingViaApi, type ApiSendResult } from "@/lib/whatsapp/send";

const schema = z.object({
  orderId: z.uuid(),
  type: z.enum(["BOOKING_CONFIRMATION", "AMOUNT_DUE", "RETURN_CONFIRMATION"]),
});

/** "Send automatically on WhatsApp" (Cloud API, the business's own number). */
export async function sendAutomatically(
  orderId: string,
  type: MessageType,
): Promise<ApiSendResult> {
  const parsed = schema.safeParse({ orderId, type });
  if (!parsed.success) return { ok: false, error: "Booking not found." };
  const result = await sendBookingViaApi(parsed.data.orderId, parsed.data.type);
  revalidatePath(`/bookings/${parsed.data.orderId}`);
  revalidatePath("/");
  return result;
}
