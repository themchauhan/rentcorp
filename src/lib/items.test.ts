import { describe, expect, it } from "vitest";
import { itemFormSchema } from "./items";

const valid = {
  name: "  Plastic chair ",
  category: "Furniture",
  unitLabel: "piece",
  quantity: "500",
  price: "10",
  rateUnit: "PER_DAY",
};

describe("itemFormSchema", () => {
  it("accepts a valid item and converts price to paise", () => {
    expect(itemFormSchema.parse(valid)).toEqual({
      name: "Plastic chair",
      category: "Furniture",
      unitLabel: "piece",
      quantity: 500,
      price: 1000,
      rateUnit: "PER_DAY",
    });
  });

  it.each([
    ["name", { name: " " }],
    ["category", { category: "" }],
    ["quantity", { quantity: "-1" }],
    ["quantity", { quantity: "2.5" }],
    ["price", { price: "12.345" }],
    ["price", { price: "free" }],
    ["price", { price: "10000001" }],
    ["rateUnit", { rateUnit: "PER_HOUR" }],
  ])("rejects a bad %s", (field, override) => {
    const result = itemFormSchema.safeParse({ ...valid, ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path[0]).toBe(field);
  });

  it("allows a free (₹0) item and zero quantity", () => {
    expect(itemFormSchema.parse({ ...valid, price: "0", quantity: "0" })).toMatchObject({
      price: 0,
      quantity: 0,
    });
  });
});
