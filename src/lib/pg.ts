// Hostel / PG: labels and form parsing shared by pages and actions.
import { z } from "zod";
import { parseRupeesToPaise } from "./money";
import type { StayStatus } from "./pg-dues";

export type RentMode = "PER_BED" | "PER_ROOM";
export type IdType =
  "AADHAAR" | "PAN" | "DRIVING_LICENCE" | "VOTER_ID" | "PASSPORT" | "COLLEGE_ID" | "OTHER";
export type ComplaintCategory =
  "ELECTRICAL" | "PLUMBING" | "CLEANING" | "FURNITURE" | "WIFI" | "FOOD" | "OTHER";
export type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export const RENT_MODE_LABEL: Record<RentMode, string> = {
  PER_BED: "Per bed",
  PER_ROOM: "Whole room",
};

export const STAY_STATUS_LABEL: Record<StayStatus, string> = {
  ACTIVE: "Living here",
  NOTICE: "On notice",
  MOVED_OUT: "Moved out",
  CANCELLED: "Cancelled",
};

export const ID_TYPE_LABEL: Record<IdType, string> = {
  AADHAAR: "Aadhaar",
  PAN: "PAN card",
  DRIVING_LICENCE: "Driving licence",
  VOTER_ID: "Voter ID",
  PASSPORT: "Passport",
  COLLEGE_ID: "College / office ID",
  OTHER: "Other",
};
export const ID_TYPES = Object.keys(ID_TYPE_LABEL) as IdType[];

export const COMPLAINT_CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  ELECTRICAL: "Electrical",
  PLUMBING: "Plumbing",
  CLEANING: "Cleaning",
  FURNITURE: "Furniture",
  WIFI: "Wi-Fi",
  FOOD: "Food",
  OTHER: "Other",
};
export const COMPLAINT_CATEGORIES = Object.keys(COMPLAINT_CATEGORY_LABEL) as ComplaintCategory[];

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

export const PAYMENT_PURPOSE_LABEL = {
  RENT: "Rent",
  DEPOSIT: "Deposit",
  REFUND: "Refund paid",
} as const;

/** "Room 101 · Bed A" or "Room 201 (whole room)". */
export function placeLabel(room: string, bed: string | null): string {
  return bed ? `Room ${room} · Bed ${bed}` : `Room ${room} (whole room)`;
}

const money = (max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const p = parseRupeesToPaise(v);
      if (p === null || p > max) {
        ctx.addIssue({ code: "custom", message: `Enter a valid ${label}` });
        return z.NEVER;
      }
      return p;
    });

export const roomFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the room name or number")
    .max(40, "Keep it under 40 characters"),
  floor: z.string().trim().max(30, "Keep it under 30 characters"),
  rentMode: z.enum(["PER_BED", "PER_ROOM"], { error: "Choose how rent is charged" }),
  rent: money(100000000, "monthly rent"),
  beds: z.coerce
    .number({ error: "Enter the number of beds" })
    .int("Enter a whole number")
    .min(1, "At least 1 bed")
    .max(20, "At most 20 beds"),
  notes: z.string().trim().max(500, "Keep notes under 500 characters"),
});
export type RoomFormField = keyof z.input<typeof roomFormSchema>;
export type RoomFormInput = Record<RoomFormField, string>;

export const settingsSchema = z.object({
  electricity: money(10000000, "electricity amount"),
  deposit: money(100000000, "deposit amount"),
  noticeDays: z.coerce
    .number({ error: "Enter the notice period in days" })
    .int("Enter whole days")
    .min(0, "0 to 180 days")
    .max(180, "0 to 180 days"),
  agreementMonths: z.coerce
    .number({ error: "Enter the agreement length in months" })
    .int("Enter whole months")
    .min(1, "1 to 60 months")
    .max(60, "1 to 60 months"),
  lockInMonths: z.coerce
    .number({ error: "Enter the lock-in in months" })
    .int("Enter whole months")
    .min(0, "0 to 24 months")
    .max(24, "0 to 24 months"),
  increasePct: z.coerce
    .number({ error: "Enter the yearly increase %" })
    .min(0, "0 to 50%")
    .max(50, "0 to 50%")
    .transform((n) => Math.round(n * 100) / 100),
  alertDays: z.coerce
    .number({ error: "Enter how many days before to remind" })
    .int("Enter whole days")
    .min(0, "0 to 120 days")
    .max(120, "0 to 120 days"),
});

export const mealPlanSchema = z.object({
  name: z.string().trim().min(1, "Enter the plan name").max(60, "Keep it under 60 characters"),
  price: money(10000000, "monthly price"),
});

export { money as rupeesField };
