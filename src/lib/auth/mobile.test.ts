import { describe, expect, it } from "vitest";
import { mobileFromLoginEmail, mobileToLoginEmail, normalizeIndianMobile } from "./mobile";

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

describe("mobileFromLoginEmail", () => {
  it("reads the mobile back from a login email", () => {
    expect(mobileFromLoginEmail("919876543210@mobile.invalid")).toBe("9876543210");
  });
  it("ignores anything else", () => {
    expect(mobileFromLoginEmail("someone@example.com")).toBeNull();
    expect(mobileFromLoginEmail("919876543210@mobileXinvalid")).toBeNull();
    expect(mobileFromLoginEmail(null)).toBeNull();
  });
});
