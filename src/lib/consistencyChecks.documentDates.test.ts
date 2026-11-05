import { describe, expect, it } from "vitest";
import { runConsistencyChecks, type CheckInput } from "./consistencyChecks";

describe("document modification dates in the audit", () => {
  it("clears the stale budget finding when the modified budget catches up with the business plan", () => {
    const input: CheckInput = {
      project: {
        id: "project", title: "Test", deadline: null, hours_per_week: 20,
        days_per_week: ["Lundi"], updated_at: "2026-11-05T21:15:00Z", completion_percent: 0,
      },
      phases: [], tasks: [], events: [],
      bpUpdatedAt: "2026-11-05T21:15:10.832733Z",
      budget: {
        id: "budget", horizon_months: 12, updated_at: "2026-10-22T08:41:53.491Z",
        lines: [{ category: "revenue", label: "Sales", monthly_values: [1000], is_total: false }],
      },
    };
    expect(runConsistencyChecks(input).findings.some(f => f.id === "budget-stale")).toBe(true);
    const updated: CheckInput = {
      ...input,
      budget: { ...input.budget, id: "budget", horizon_months: 12, lines: input.budget?.lines ?? [], updated_at: "2026-11-05T21:15:15.271586Z" },
    };
    expect(runConsistencyChecks(updated).findings.some(f => f.id === "budget-stale")).toBe(false);
  });
});