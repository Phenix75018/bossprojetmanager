import { describe, it, expect } from "vitest";
import { auditMarketStudy } from "./marketStudyAudit";
import { DEFAULT_CONFIG } from "./marketStudy";

const cfg = { ...DEFAULT_CONFIG, sector: "Boulangerie", sections: ["executive_summary", "methodology", "market_sizing", "pestel"], frameworks: ["PESTEL"] };

describe("auditMarketStudy", () => {
  it("flags missing sector as critical", () => {
    const a = auditMarketStudy({ ...cfg, sector: "" }, []);
    expect(a.issues.some((i) => i.category === "secteur" && i.severity === "critical")).toBe(true);
  });
  it("flags a chosen method whose section is excluded", () => {
    const a = auditMarketStudy({ ...cfg, frameworks: ["Porter"] }, []);
    expect(a.issues.some((i) => i.category === "methodes" && /Porter/.test(i.message))).toBe(true);
  });
  it("flags figures without source and without estimate label", () => {
    const a = auditMarketStudy(cfg, [{ key: "market_sizing", title: "", content: "Boulangerie France : 12 milliards et 3 % par an." }]);
    expect(a.issues.some((i) => i.category === "sources" && i.sectionKey === "market_sizing")).toBe(true);
    expect(a.issues.some((i) => i.category === "estimations" && i.sectionKey === "market_sizing")).toBe(true);
  });
  it("scores 100 minus penalties", () => {
    const a = auditMarketStudy({ ...cfg, sector: "" }, []);
    const p = a.issues.reduce((s, i) => s + ({ critical: 15, warning: 6, info: 2 })[i.severity], 0);
    expect(a.score).toBe(Math.max(0, 100 - p));
  });
});
