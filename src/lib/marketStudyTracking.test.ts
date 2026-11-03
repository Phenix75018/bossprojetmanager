import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { sectionCost } from "./marketStudyTracking";
import { DEFAULT_CONFIG } from "./marketStudy";

describe("market study task budget", () => {
  it("analyst time = hours by depth × hourly rate", () => {
    expect(sectionCost("executive_summary", { ...DEFAULT_CONFIG, depth: "approfondie", hourlyRate: 80 })).toBe(320);
  });
  it("adds external fieldwork cost for the survey", () => {
    expect(sectionCost("survey", { ...DEFAULT_CONFIG, depth: "standard", hourlyRate: 100 })).toBe(1700);
  });
});
