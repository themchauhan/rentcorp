import { describe, expect, it } from "vitest";
import {
  generateTempPassword,
  TEMP_PASSWORD_ALPHABET,
  TEMP_PASSWORD_LENGTH,
} from "./temp-password";

describe("generateTempPassword", () => {
  it("has the expected length and meets the 8-character minimum", () => {
    const pw = generateTempPassword();
    expect(pw).toHaveLength(TEMP_PASSWORD_LENGTH);
    expect(pw.length).toBeGreaterThanOrEqual(8);
  });

  it("only uses unambiguous characters", () => {
    const all = Array.from({ length: 200 }, () => generateTempPassword()).join("");
    for (const ch of all) expect(TEMP_PASSWORD_ALPHABET).toContain(ch);
    expect(all).not.toMatch(/[0O1lI]/);
  });

  it("is different every time", () => {
    const set = new Set(Array.from({ length: 500 }, () => generateTempPassword()));
    expect(set.size).toBe(500);
  });
});
