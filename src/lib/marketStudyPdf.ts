import jsPDF from "jspdf";
import type { MarketStudyConfig, MarketStudySection } from "@/lib/marketStudy";

const KEEP = /[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF€‘’“”–—•…œŒ]/g;
/** Make text printable with the built-in PDF fonts (no emoji / exotic glyphs). */
export function pdfSafe(s: string): string {
  return s
    .replace(/≈|∼/g, "~").replace(/≥/g, ">=").replace(/≤/g, "<=")
    .replace(/→|⇒/g, "->").replace(/←/g, "<-").replace(/×/g, "x").replace(/[✓✔]/g, "OK")
    .replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(KEEP, "");
}

const M = 18, PW = 210, PH = 297, W = PW - 2 * M, BOTTOM = PH - 20;
const BURGUNDY: [number, number, number] = [122, 31, 52];

export function buildMarketStudyPdf(title: string, config: MarketStudyConfig, sections: MarketStudySection[], webUrl?: (key: string) => string): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = M;
  const newPage = () => { doc.addPage(); y = M + 4; };
  const ensure = (h: number) => { if (y + h > BOTTOM) newPage(); };
  const text = (txt: string, size: number, bold = false, gap = 1.5, indent = 0) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
    const lh = size * 0.42;
    for (const line of doc.splitTextToSize(pdfSafe(txt), W - indent)) { ensure(lh); doc.text(line, M + indent, y); y += lh; }
    y += gap;
  };
  const table = (rows: string[][]) => {
    const cols = Math.max(...rows.map((r) => r.length)); const cw = W / cols;
    doc.setFontSize(8.5);
    rows.forEach((r, ri) => {
      doc.setFont("helvetica", ri === 0 ? "bold" : "normal");
      const cells = Array.from({ length: cols }, (_, c) => doc.splitTextToSize(pdfSafe(r[c] ?? ""), cw - 3) as string[]);
      const h = Math.max(...cells.map((c) => c.length)) * 3.7 + 2.5;
      ensure(h);
      if (ri === 0) { doc.setFillColor(245, 236, 225); doc.rect(M, y, W, h, "F"); }
      doc.setDrawColor(210, 200, 190); doc.rect(M, y, W, h);
      cells.forEach((c, ci) => { if (ci) doc.line(M + ci * cw, y, M + ci * cw, y + h); doc.text(c, M + ci * cw + 1.5, y + 4); });
      y += h;
    });
    y += 7;
  };

  // Cover
  doc.setFillColor(...BURGUNDY); doc.rect(0, 0, PW, 90, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text("ÉTUDE DE MARCHÉ", M, 40);
  doc.setFont("helvetica", "bold"); doc.setFontSize(24);
  doc.text(doc.splitTextToSize(pdfSafe(title), W), M, 55);
  doc.setTextColor(40, 30, 30); y = 110;
  const meta: [string, string][] = [
    ["Secteur", config.sector || "—"], ["Zone", config.geography || "—"], ["Cible", config.targetType],
    ["Horizon", `${config.horizonYears} ans`], ["Sections", String(sections.length)],
    ["Date", new Date().toLocaleDateString("fr-FR")],
  ];
  for (const [k, v] of meta) { doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(k, M, y); doc.setFont("helvetica", "normal"); doc.text(pdfSafe(v), M + 35, y); y += 8; }
  doc.setFontSize(8.5); doc.setTextColor(110, 100, 100);
  doc.text(doc.splitTextToSize("Les chiffres et sources sont fournis à titre indicatif : vérifiez-les avant toute présentation à un financeur ou partenaire.", W), M, PH - 30);
  doc.setTextColor(40, 30, 30);

  // TOC placeholder (page 2), filled after sections are laid out
  doc.addPage();
  const tocPage = doc.getNumberOfPages();

  // Sections: each starts on its own page
  const starts: number[] = [];
  sections.forEach((s, i) => {
    newPage(); starts.push(doc.getNumberOfPages());
    doc.setTextColor(...BURGUNDY); text(`${i + 1}. ${s.title}`, 17, true, 1);
    doc.setDrawColor(...BURGUNDY); doc.setLineWidth(0.6); doc.line(M, y, M + 40, y); doc.setLineWidth(0.2); y += 6;
    if (webUrl) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...BURGUNDY);
      doc.textWithLink("Ouvrir cette section dans le navigateur ->", M, y - 2, { url: webUrl(s.key) }); y += 4;
    }
    doc.setTextColor(40, 30, 30);
    const lines = (s.content || "_Section non rédigée._").split("\n");
    for (let k = 0; k < lines.length; k++) {
      const l = lines[k];
      if (l.trim().startsWith("|")) {
        const rows: string[][] = [];
        while (k < lines.length && lines[k].trim().startsWith("|")) {
          const row = lines[k].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
          if (!row.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(row);
          k++;
        }
        k--; if (rows.length) table(rows); continue;
      }
      const h = l.match(/^(#{1,6})\s+(.*)/);
      if (h) { y += 2; ensure(12); doc.setTextColor(...BURGUNDY); text(h[2], h[1].length <= 2 ? 13 : 11.5, true, 1.5); doc.setTextColor(40, 30, 30); }
      else if (/^\s*[-*+]\s+/.test(l)) text("• " + l.replace(/^\s*[-*+]\s+/, ""), 10, false, 0.8, 3);
      else if (/^\s*\d+[.)]\s+/.test(l)) text(l.trim(), 10, false, 0.8, 3);
      else if (/^\s*>/.test(l)) { doc.setTextColor(100, 90, 90); text(l.replace(/^\s*>\s?/, ""), 10, false, 1, 4); doc.setTextColor(40, 30, 30); }
      else if (l.trim()) text(l, 10, false, 1.5);
      else y += 1.5;
    }
  });

  // TOC with clickable links
  doc.setPage(tocPage);
  doc.setTextColor(...BURGUNDY); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("Sommaire", M, M + 8);
  if (webUrl) { doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(110, 100, 100); doc.text("Titre : aller à la page du PDF  ·  « En ligne » : ouvrir la section sur le site", M, M + 14); }
  doc.setTextColor(40, 30, 30); doc.setFontSize(10.5);
  sections.forEach((s, i) => {
    const ty = M + 22 + i * 8.5;
    doc.setFont("helvetica", "normal");
    const label = doc.splitTextToSize(pdfSafe(`${i + 1}. ${s.title}`), W - 45)[0] as string;
    doc.text(label, M, ty);
    doc.link(M, ty - 5, doc.getTextWidth(label), 7, { pageNumber: starts[i] });
    doc.text(String(starts[i]), PW - M - (webUrl ? 22 : 0), ty, { align: "right" });
    doc.setDrawColor(220, 210, 200); doc.line(M + doc.getTextWidth(label) + 2, ty, PW - M - (webUrl ? 30 : 8), ty);
    if (webUrl) { doc.setTextColor(...BURGUNDY); doc.setFontSize(8.5); doc.textWithLink("En ligne ->", PW - M - 16, ty, { url: webUrl(s.key) }); doc.setTextColor(40, 30, 30); doc.setFontSize(10.5); }
  });

  // Header / footer
  const n = doc.getNumberOfPages();
  for (let p = 2; p <= n; p++) {
    doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(130, 120, 120);
    doc.text(pdfSafe(title).slice(0, 90), M, 10);
    doc.text(`Page ${p} / ${n}`, PW - M, PH - 10, { align: "right" });
  }
  return doc;
}
