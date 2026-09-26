import { z } from "zod";
import { parseRupeesToPaise } from "./money";

export const DEFAULT_CATEGORIES = [
  "Tents & Shamiana",
  "Furniture",
  "Lighting",
  "Sound",
  "Utensils",
  "Decoration",
  "Generator",
  "Other",
] as const;

export const UNIT_SUGGESTIONS = ["piece", "set", "pair", "metre", "sq ft"] as const;

export type RateUnit = "PER_DAY" | "PER_EVENT";
export const RATE_UNIT_LABEL: Record<RateUnit, string> = {
  PER_DAY: "per day",
  PER_EVENT: "per event",
};

// ₹1 crore per unit, matching the database check.
const MAX_RATE_PAISE = 1_000_000_000;

/** Validates the add/edit item form. Prices are entered in rupees. */
export const itemFormSchema = z.object({
  name: z.string().trim().min(1, "Enter the item name").max(120, "Name is too long"),
  category: z.string().trim().min(1, "Pick or type a category").max(60, "Category is too long"),
  unitLabel: z.string().trim().min(1, "Enter a unit, e.g. piece").max(30, "Unit is too long"),
  quantity: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number (0 or more)")
    .transform(Number)
    .refine((n) => n <= 1_000_000, "That's too many"),
  price: z.string().transform((v, ctx) => {
    const paise = parseRupeesToPaise(v);
    if (paise === null) {
      ctx.addIssue({ code: "custom", message: "Enter a price like 150 or 150.50" });
      return z.NEVER;
    }
    if (paise > MAX_RATE_PAISE) {
      ctx.addIssue({ code: "custom", message: "That price is too high" });
      return z.NEVER;
    }
    return paise;
  }),
  rateUnit: z.enum(["PER_DAY", "PER_EVENT"], { error: "Choose per day or per event" }),
});

export type ItemFormInput = z.input<typeof itemFormSchema>;
export type ItemFormValues = z.output<typeof itemFormSchema>;
export type ItemFormField = keyof ItemFormInput;
