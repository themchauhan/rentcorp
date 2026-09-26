import { describe, expect, it } from "vitest";
import { mobileToLoginEmail, normalizeIndianMobile } from "./mobile";

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["98765 43210", "9876543210"],
    ["98765-43210", "9876543210"],
    ["+91 98765 43210", "9876543210"],
    ["919876543210", "9876543210"],
    ["09876543210", "9876543210"],
    ["6000000000", "6000000000"],
  ])("accepts %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each([
    ["", "empty"],
    ["987654321", "9 digits"],
    ["98765432100", "11 digits without leading 0"],
    ["5876543210", "starts with 5"],
    ["0123456789", "landline-style"],
    ["98765abcde", "letters"],
    ["+44 7911 123456", "foreign number"],
  ])("rejects %s (%s)", (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });
});

describe("mobileToLoginEmail", () => {
  it("maps to the reserved internal domain", () => {
    expect(mobileToLoginEmail("9876543210")).toBe("919876543210@mobile.invalid");
  });

  it("refuses un-normalised input", () => {
    expect(() => mobileToLoginEmail("+91 98765 43210")).toThrow();
  });
});
