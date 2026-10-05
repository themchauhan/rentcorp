import { describe, expect, it } from "vitest";
import { computeStayDues, dueDates, isDueDate, rateOn, type StayInput } from "./pg-dues";

const rate = (effectiveFrom: string, rent: number, meal = 0, elec = 0) => ({
  effectiveFrom,
  rentPaise: rent,
  mealPaise: meal,
  electricityPaise: elec,
  mealPlanName: meal ? "Plan" : null,
});

function stay(over: Partial<StayInput> = {}): StayInput {
  return {
    startDate: "2026-03-12",
    status: "ACTIVE",
    movedOutOn: null,
    rates: [rate("2026-03-12", 600000, 250000, 50000)],
    adjustments: [],
    payments: [],
    ...over,
  };
}

describe("due dates", () => {
  it("falls on the joining date every month", () => {
    expect(dueDates("2026-03-12", "2026-06-12")).toEqual([
      "2026-03-12",
      "2026-04-12",
      "2026-05-12",
      "2026-06-12",
    ]);
  });

  it("clamps to the month end without drifting (31 Jan joiner)", () => {
    expect(dueDates("2026-01-31", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
    expect(dueDates("2028-01-31", "2028-02-29")).toEqual(["2028-01-31", "2028-02-29"]); // leap year
  });

  it("knows which dates are due dates", () => {
    expect(isDueDate("2026-01-31", "2026-02-28")).toBe(true);
    expect(isDueDate("2026-01-31", "2026-02-27")).toBe(false);
    expect(isDueDate("2026-01-31", "2026-01-31")).toBe(false); // joining date itself
  });
});

describe("computeStayDues", () => {
  it("charges the first month on the joining date", () => {
    const d = computeStayDues(stay(), "2026-03-12");
    expect(d.cycles).toHaveLength(1);
    expect(d.cycles[0]).toMatchObject({ start: "2026-03-12", end: "2026-04-11", total: 900000 });
    expect(d.amountDue).toBe(900000);
    expect(d.nextDueDate).toBe("2026-04-12");
    expect(d.daysOverdue).toBe(0);
  });

  it("charges nothing before the joining date", () => {
    const d = computeStayDues(stay(), "2026-03-11");
    expect(d.cycles).toHaveLength(0);
    expect(d.balance).toBe(0);
    expect(d.nextDueDate).toBe("2026-03-12");
  });

  it("adds a full month on each due date", () => {
    expect(computeStayDues(stay(), "2026-04-11").cycleCharges).toBe(900000);
    expect(computeStayDues(stay(), "2026-04-12").cycleCharges).toBe(1800000);
  });

  it("settles the oldest month first and shows part payments", () => {
    const d = computeStayDues(
      stay({ payments: [{ purpose: "RENT", amountPaise: 1200000 }] }),
      "2026-05-12",
    );
    expect(d.cycles.map((c) => c.status)).toEqual(["PAID", "PART", "DUE"]);
    expect(d.cycles[1].paid).toBe(300000);
    expect(d.amountDue).toBe(1500000);
    expect(d.oldestUnpaid).toBe("2026-04-12");
    expect(d.daysOverdue).toBe(30);
  });

  it("shows overpayment as credit", () => {
    const d = computeStayDues(
      stay({ payments: [{ purpose: "RENT", amountPaise: 1000000 }] }),
      "2026-03-20",
    );
    expect(d.balance).toBe(-100000);
    expect(d.credit).toBe(100000);
    expect(d.amountDue).toBe(0);
    expect(d.oldestUnpaid).toBeNull();
  });

  it("counts reversals", () => {
    const d = computeStayDues(
      stay({
        payments: [
          { purpose: "RENT", amountPaise: 900000 },
          { purpose: "RENT", amountPaise: -900000 },
        ],
      }),
      "2026-03-20",
    );
    expect(d.amountDue).toBe(900000);
  });

  it("uses the rate in effect on each due date", () => {
    const d = computeStayDues(
      stay({ rates: [rate("2026-03-12", 600000), rate("2026-05-12", 700000, 300000)] }),
      "2026-05-12",
    );
    expect(d.cycles.map((c) => c.total)).toEqual([600000, 600000, 1000000]);
  });

  it("never counts the deposit as rent", () => {
    const d = computeStayDues(
      stay({ payments: [{ purpose: "DEPOSIT", amountPaise: 1000000 }] }),
      "2026-03-12",
    );
    expect(d.amountDue).toBe(900000);
    expect(d.depositHeld).toBe(1000000);
    expect(d.final).toBe(-100000);
  });

  it("applies extra charges and discounts", () => {
    const d = computeStayDues(
      stay({
        adjustments: [
          { kind: "CHARGE", amountPaise: 50000, reason: "Late fee", onDate: "2026-03-20" },
          { kind: "DISCOUNT", amountPaise: 100000, reason: "Festival", onDate: "2026-03-20" },
        ],
      }),
      "2026-03-20",
    );
    expect(d.extraCharges).toBe(50000);
    expect(d.discounts).toBe(100000);
    expect(d.balance).toBe(850000);
  });

  it("stops charging after the move-out date", () => {
    const moved = stay({ status: "MOVED_OUT", movedOutOn: "2026-05-12" });
    const d = computeStayDues(moved, "2026-08-01");
    expect(d.cycles.map((c) => c.start)).toEqual(["2026-03-12", "2026-04-12"]);
    expect(d.nextDueDate).toBeNull();
    const dayAfter = computeStayDues({ ...moved, movedOutOn: "2026-05-13" }, "2026-08-01");
    expect(dayAfter.cycles).toHaveLength(3);
  });

  it("always charges the first month, even for a same-day move-out", () => {
    const d = computeStayDues(
      stay({ status: "MOVED_OUT", movedOutOn: "2026-03-12" }),
      "2026-03-12",
    );
    expect(d.cycles).toHaveLength(1);
  });

  it("works out the move-out settlement: refund or collect", () => {
    const base = stay({
      status: "MOVED_OUT",
      movedOutOn: "2026-04-20",
      adjustments: [
        { kind: "CHARGE", amountPaise: 200000, reason: "Broken chair", onDate: "2026-04-20" },
      ],
    });
    // Charges 2 × 9,000 + 2,000 = 20,000; paid 18,000; deposit 10,000 → refund 8,000.
    const refund = computeStayDues(
      {
        ...base,
        payments: [
          { purpose: "RENT", amountPaise: 1800000 },
          { purpose: "DEPOSIT", amountPaise: 1000000 },
        ],
      },
      "2026-04-20",
    );
    expect(refund.final).toBe(-800000);
    // After the refund is paid, it's settled.
    const settled = computeStayDues(
      {
        ...base,
        payments: [
          { purpose: "RENT", amountPaise: 1800000 },
          { purpose: "DEPOSIT", amountPaise: 1000000 },
          { purpose: "REFUND", amountPaise: 800000 },
        ],
      },
      "2026-04-20",
    );
    expect(settled.final).toBe(0);
    // Nothing paid, small deposit → collect.
    const collect = computeStayDues(
      { ...base, payments: [{ purpose: "DEPOSIT", amountPaise: 500000 }] },
      "2026-04-20",
    );
    expect(collect.final).toBe(1500000);
  });

  it("charges nothing for a cancelled stay", () => {
    const d = computeStayDues(stay({ status: "CANCELLED" }), "2026-06-01");
    expect(d.cycles).toHaveLength(0);
    expect(d.balance).toBe(0);
  });

  it("picks the latest rate on or before a date", () => {
    const rates = [rate("2026-03-12", 1), rate("2026-05-12", 2)];
    expect(rateOn(rates, "2026-05-11")?.rentPaise).toBe(1);
    expect(rateOn(rates, "2026-05-12")?.rentPaise).toBe(2);
    expect(rateOn(rates, "2026-03-11")).toBeNull();
  });
});
