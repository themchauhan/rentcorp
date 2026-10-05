import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildTemplateBody,
  isOptOut,
  parseWebhook,
  sanitizeParam,
  shouldApplyStatus,
  verifySignature,
} from "./protocol";

describe("sanitizeParam", () => {
  it("makes values a single clean line", () => {
    expect(sanitizeParam("100 chairs\n1 shamiana\t ok")).toBe("100 chairs 1 shamiana ok");
    expect(sanitizeParam("a      b")).toBe("a b");
    expect(sanitizeParam("   ")).toBe("-");
  });
  it("clamps long values", () => {
    const v = sanitizeParam("x".repeat(900));
    expect(v.length).toBe(500);
    expect(v.endsWith("…")).toBe(true);
  });
});

describe("buildTemplateBody", () => {
  it("builds a template message with body parameters", () => {
    expect(
      buildTemplateBody("9111111101", "rentcorp_amount_due", "en", ["Ravi", "₹2,500"]),
    ).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "919111111101",
      type: "template",
      template: {
        name: "rentcorp_amount_due",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Ravi" },
              { type: "text", text: "₹2,500" },
            ],
          },
        ],
      },
    });
  });
  it("omits components for templates without variables (hello_world)", () => {
    expect(buildTemplateBody("9111111101", "hello_world", "en_US", []).template).toEqual({
      name: "hello_world",
      language: { code: "en_US" },
    });
  });
  it("refuses numbers that aren't normalised", () => {
    expect(() => buildTemplateBody("+91 91111 11101", "x", "en", [])).toThrow();
  });
});

describe("verifySignature", () => {
  const body = '{"entry":[]}';
  const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
  it("accepts Meta's signature and rejects anything else", () => {
    expect(verifySignature(body, sig, "s3cret")).toBe(true);
    expect(verifySignature(body + " ", sig, "s3cret")).toBe(false);
    expect(verifySignature(body, sig, "other")).toBe(false);
    expect(verifySignature(body, null, "s3cret")).toBe(false);
    expect(verifySignature(body, "sha256=abcd", "s3cret")).toBe(false);
    expect(verifySignature(body, sig, "")).toBe(false);
  });
});

describe("parseWebhook", () => {
  it("extracts statuses (with errors) and inbound texts", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "200000000000001" },
                statuses: [
                  { id: "wamid.A", status: "delivered" },
                  {
                    id: "wamid.B",
                    status: "failed",
                    errors: [{ code: 131026, title: "Message undeliverable" }],
                  },
                  { id: "wamid.C", status: "weird" },
                ],
                messages: [{ from: "919111111101", type: "text", text: { body: "STOP" } }],
              },
            },
          ],
        },
      ],
    };
    expect(parseWebhook(payload)).toEqual({
      statuses: [
        {
          phoneNumberId: "200000000000001",
          messageId: "wamid.A",
          status: "DELIVERED",
          errorCode: null,
          errorMessage: null,
        },
        {
          phoneNumberId: "200000000000001",
          messageId: "wamid.B",
          status: "FAILED",
          errorCode: "131026",
          errorMessage: "Message undeliverable",
        },
      ],
      inbound: [{ phoneNumberId: "200000000000001", from: "919111111101", text: "STOP" }],
    });
  });
  it("ignores junk", () => {
    expect(parseWebhook(null)).toEqual({ statuses: [], inbound: [] });
    expect(parseWebhook({ entry: [{ changes: [{ value: {} }] }] })).toEqual({
      statuses: [],
      inbound: [],
    });
  });
});

describe("opt-out and status ordering", () => {
  it("recognises STOP replies", () => {
    expect(isOptOut(" stop ")).toBe(true);
    expect(isOptOut("Unsubscribe")).toBe(true);
    expect(isOptOut("please stop by tomorrow")).toBe(false);
  });
  it("only moves delivery status forward", () => {
    expect(shouldApplyStatus(null, "SENT")).toBe(true);
    expect(shouldApplyStatus("SENT", "DELIVERED")).toBe(true);
    expect(shouldApplyStatus("READ", "DELIVERED")).toBe(false);
    expect(shouldApplyStatus("DELIVERED", "FAILED")).toBe(true);
    expect(shouldApplyStatus("FAILED", "READ")).toBe(false);
  });
});
