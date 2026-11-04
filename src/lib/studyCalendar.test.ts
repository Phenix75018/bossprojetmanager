import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { buildTimeline, mergeStudyProjects, studyBudget, studyMonthly, toDayKey, type StudyRow } from "./studyCalendar";
import { DEFAULT_CONFIG } from "./marketStudy";

const study = (over: Partial<StudyRow> = {}): StudyRow => ({
  id: "s1",
  title: "Marché des cosmétiques bio",
  description: "",
  status: "in_progress",
  config: { ...DEFAULT_CONFIG, depth: "approfondie", hourlyRate: 80, sections: ["executive_summary", "survey"] },
  sections: [],
  project_id: "p1",
  created_at: "2026-03-12T10:00:00",
  updated_at: "2026-03-20T10:00:00",
  ...over,
});

describe("study budget", () => {
  it("sums analyst time and external costs of the selected sections", () => {
    const b = studyBudget(study());
    expect(b.budget).toBe(2140); // 320 summary + (320 + 1500 fieldwork) survey
    expect(b.hours).toBe(8);
    expect(b.sectionsWanted).toBe(2);
    expect(b.sectionsWritten).toBe(0);
    expect(b.spent).toBe(0);
  });

  it("counts only written sections as engaged", () => {
    const b = studyBudget(study({ sections: [{ key: "survey", title: "Questionnaire", content: "x", generated_at: "2026-03-13T09:00:00" }] }));
    expect(b.spent).toBe(1820);
    expect(b.pendingHours).toBe(4);
    expect(b.sectionsWritten).toBe(1);
  });
});

describe("study timeline", () => {
  it("starts on the creation day and ends on the last planned day", () => {
    const today = toDayKey(new Date());
    const tomorrow = toDayKey(new Date(Date.now() + 86400000));
    const t = buildTimeline(study(), [tomorrow, today]);
    expect(t.start).toBe("2026-03-12");
    expect(t.end).toBe(tomorrow);
    expect(t.nextDate).toBe(today);
    expect(t.pct).toBe(0);
  });

  it("falls back to the last written section when nothing is left to plan", () => {
    const t = buildTimeline(study({ sections: [{ key: "survey", title: "Questionnaire", content: "x", generated_at: "2026-03-18T09:00:00" }] }), []);
    expect(t.end).toBe("2026-03-18");
    expect(t.nextDate).toBeNull();
    expect(t.pct).toBe(50);
  });

  it("is not planned without a mirrored project", () => {
    expect(buildTimeline(study({ project_id: null }), []).planned).toBe(false);
  });
});

describe("study monthly spread", () => {
  it("puts 4 sections per month, the same way the mirrored budget does", () => {
    const m = studyMonthly(study({ config: { ...DEFAULT_CONFIG, depth: "standard", hourlyRate: 100, sections: ["executive_summary", "methodology", "market_definition", "market_sizing", "trends"] } }));
    expect(m.planned[0]).toBe(1300); // 200 + 200 + 200 + (200 + 500 market data)
    expect(m.planned[1]).toBe(200); // trends
    expect(m.planned[2]).toBe(0);
  });
});

describe("merged calendar project", () => {
  it("returns null without studies and prefixes each phase with its study", () => {
    expect(mergeStudyProjects([])).toBeNull();
    const project = { phases: [{ id: "ph", name: "Étude de marché" }] } as any;
    const merged = mergeStudyProjects([{ project, studyTitle: "Boulangerie Lyon" }]);
    expect(merged?.phases[0].name).toBe("Boulangerie Lyon — Étude de marché");
    expect(merged?.id).toBe("all-studies");
  });
});
