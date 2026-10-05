import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { todayIST } from "@/lib/dates";
import { runEveningReminders } from "@/lib/whatsapp/evening-job";

// Vercel Cron calls this at 15:30 UTC (21:00 IST) with
// "Authorization: Bearer <CRON_SECRET>". Anyone else gets 401.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runEveningReminders(todayIST());
  return NextResponse.json(summary);
}
