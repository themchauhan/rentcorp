import { describe, expect, it } from "vitest";
import { formatRupees, paiseToRupeesInput, parseRupeesToPaise } from "./money";

describe("parseRupeesToPaise", () => {
  it.each([
    ["1500", 150000],
    ["1,500", 150000],
    ["1,50,000", 15000000],
    ["1500.5", 150050],
    ["1500.50", 150050],
    ["0.05", 5],
    ["₹ 1,500.50", 150050],
    ["Rs. 250", 25000],
    ["0", 0],
    [" 10 ", 1000],
  ])("parses %s", (input, expected) => {
    expect(parseRupeesToPaise(input)).toBe(expected);
  });

  it.each(["", "abc", "-10", "12.345", "1.2.3", ".5", "10."])("rejects %j", (input) => {
    expect(parseRupeesToPaise(input)).toBeNull();
  });

  it("never loses paise to floating point", () => {
    // 0.1 + 0.2 style errors would turn 19.99 into 1998.
    expect(parseRupeesToPaise("19.99")).toBe(1999);
    expect(parseRupeesToPaise("1.10")).toBe(110);
  });
});

describe("formatRupees", () => {
  it("formats whole and fractional rupees with Indian grouping", () => {
    expect(formatRupees(150000)).toBe("₹1,500");
    expect(formatRupees(150050)).toBe("₹1,500.50");
    expect(formatRupees(15000000)).toBe("₹1,50,000");
    expect(formatRupees(5)).toBe("₹0.05");
    expect(formatRupees(0)).toBe("₹0");
  });

  it("refuses non-integer paise", () => {
    expect(() => formatRupees(10.5)).toThrow();
  });
});

describe("paiseToRupeesInput", () => {
  it("round-trips with parseRupeesToPaise", () => {
    for (const paise of [0, 5, 110, 1999, 150000, 150050]) {
      expect(parseRupeesToPaise(paiseToRupeesInput(paise))).toBe(paise);
    }
    expect(paiseToRupeesInput(150050)).toBe("1500.50");
    expect(paiseToRupeesInput(150000)).toBe("1500");
  });
});
