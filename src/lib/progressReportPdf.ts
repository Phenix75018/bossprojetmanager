import jsPDF from "jspdf";

export interface ReportMetric {
  label: string;
  value: string;
  comment?: string;
}

export interface ProgressReportCharts {
  progressTrend?: {
    date: string;
    doneCumul: number;
    percent: number;
    target: number;
    remainingHours: number;
    idealHours: number;
  }[];
  phaseProgress?: { name: string; done: number; inProgress: number; todo: number }[];
  budgetMonthly?: { month: string; revenue: number; charges: number; net: number; cumulNet: number }[];
}


export interface ProgressReportPayload {
  engine: string;
  generated_at: string;
  period: "week" | "month" | "quarter";
  period_label: string;
  project: {
    id: string;
    title: string;
    status: string;
    completion_percent: number;
    deadline: string | null;
  };
  stats: {
    phases: number;
    tasks: number;
    done: number;
    doneRecent: number;
    inProgress: number;
    todo: number;
    p0Open: number;
    totalHours: number;
    doneHours: number;
    upcomingEvents: number;
    bpSections: number;
    bmBlocks: number;
  };
  budget: {
    revenue: number;
    fixed: number;
    variable: number;
    invest: number;
    grossMargin: number;
    ebitda: number;
    horizon: number;
    lines: number;
  } | null;
  report: {
    executive_summary?: string;
    highlights?: string[];
    progress?: { narrative?: string; metrics?: ReportMetric[] };
    budget?: { narrative?: string; metrics?: ReportMetric[] };
    risks?: { title: string; severity?: string; impact?: string; mitigation?: string }[];
    recommendations?: { title: string; detail?: string; priority?: string }[];
    next_steps?: { title: string; deadline?: string; owner?: string }[];
  };
}

const INK: [number, number, number] = [38, 26, 24];
const BURGUNDY: [number, number, number] = [123, 30, 46];
const AMBER: [number, number, number] = [196, 132, 44];
const MUTED: [number, number, number] = [120, 106, 100];
const LIGHT: [number, number, number] = [248, 243, 236];

export function euro(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

export function exportProgressReportPDF(data: ProgressReportPayload) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18;
  const contentW = pageW - M * 2;
  let y = 0;

  const generatedAt = new Date(data.generated_at);

  // ---------- Cover ----------
  doc.setFillColor(...INK);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...BURGUNDY);
  doc.rect(0, pageH / 2 - 55, pageW, 3, "F");

  doc.setTextColor(...AMBER);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BOSS PROJECT MANAGER", M, 30);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(30);
  doc.text("Rapport d'avancement", M, pageH / 2 - 25, { maxWidth: contentW });
  doc.setFontSize(18);
  doc.setFont("helvetica", "normal");
  doc.text(data.project.title, M, pageH / 2 - 8, { maxWidth: contentW });

  doc.setFontSize(11);
  doc.setTextColor(220, 210, 205);
  doc.text(`Périodicité : ${data.period_label}`, M, pageH / 2 + 8);
  doc.text(
    `Généré le ${generatedAt.toLocaleDateString("fr-FR")} à ${generatedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
    M,
    pageH / 2 + 16,
  );
  doc.text(
    `Avancement : ${data.project.completion_percent}%${data.project.deadline ? ` — échéance ${new Date(data.project.deadline).toLocaleDateString("fr-FR")}` : ""}`,
    M,
    pageH / 2 + 24,
  );
  doc.setFontSize(9);
  doc.setTextColor(160, 148, 142);
  doc.text("Document confidentiel — destiné aux dirigeants, investisseurs et partenaires.", M, pageH - 20, {
    maxWidth: contentW,
  });

  // ---------- Helpers ----------
  const newPage = () => {
    doc.addPage();
    doc.setFillColor(...INK);
    doc.rect(0, 0, pageW, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`Rapport d'avancement — ${data.project.title}`, M, 10.5);
    doc.setFont("helvetica", "normal");
    doc.text(data.period_label, pageW - M, 10.5, { align: "right" });
    y = 30;
  };

  const ensure = (needed: number) => {
    if (y + needed > pageH - 20) newPage();
  };

  const heading = (text: string) => {
    ensure(20);
    doc.setTextColor(...BURGUNDY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(text, M, y);
    y += 3;
    doc.setDrawColor(...AMBER);
    doc.setLineWidth(0.8);
    doc.line(M, y, M + 24, y);
    y += 8;
  };

  const paragraph = (text: string) => {
    if (!text) return;
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      ensure(6);
      doc.text(line, M, y);
      y += 5;
    }
    y += 3;
  };

  const bullets = (items: string[]) => {
    doc.setFontSize(10);
    for (const item of items) {
      const lines = doc.splitTextToSize(item, contentW - 6);
      ensure(lines.length * 5 + 2);
      doc.setFillColor(...AMBER);
      doc.circle(M + 1.4, y - 1.4, 1.1, "F");
      doc.setTextColor(...INK);
      doc.setFont("helvetica", "normal");
      lines.forEach((line: string, i: number) => {
        doc.text(line, M + 6, y + i * 5);
      });
      y += lines.length * 5 + 2;
    }
    y += 2;
  };

  const metricCards = (metrics: ReportMetric[]) => {
    const cols = 2;
    const gap = 6;
    const cardW = (contentW - gap) / cols;
    for (let i = 0; i < metrics.length; i += cols) {
      const row = metrics.slice(i, i + cols);
      const heights = row.map((m) => {
        const commentLines = m.comment ? doc.splitTextToSize(m.comment, cardW - 10).length : 0;
        return 20 + commentLines * 4;
      });
      const h = Math.max(...heights);
      ensure(h + 4);
      row.forEach((m, idx) => {
        const x = M + idx * (cardW + gap);
        doc.setFillColor(...LIGHT);
        doc.roundedRect(x, y, cardW, h, 2, 2, "F");
        doc.setTextColor(...MUTED);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(doc.splitTextToSize(m.label, cardW - 8)[0] ?? m.label, x + 4, y + 6);
        doc.setTextColor(...BURGUNDY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(doc.splitTextToSize(m.value ?? "—", cardW - 8)[0] ?? "—", x + 4, y + 14);
        if (m.comment) {
          doc.setTextColor(...MUTED);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.splitTextToSize(m.comment, cardW - 8).forEach((line: string, li: number) => {
            doc.text(line, x + 4, y + 19 + li * 4);
          });
        }
      });
      y += h + 4;
    }
    y += 3;
  };

  const tagBlock = (
    items: { tag?: string; title: string; body?: string[] }[],
    tagColor: (tag?: string) => [number, number, number],
  ) => {
    doc.setFontSize(10);
    for (const item of items) {
      const bodyLines = (item.body ?? []).flatMap((b) => doc.splitTextToSize(b, contentW - 12) as string[]);
      const h = 9 + bodyLines.length * 4.6 + 4;
      ensure(h + 3);
      const c = tagColor(item.tag);
      doc.setFillColor(...LIGHT);
      doc.roundedRect(M, y, contentW, h, 2, 2, "F");
      doc.setFillColor(...c);
      doc.roundedRect(M, y, 2.2, h, 1, 1, "F");
      doc.setTextColor(...INK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const titleLine = doc.splitTextToSize(item.title, contentW - 34)[0] ?? item.title;
      doc.text(titleLine, M + 6, y + 6.5);
      if (item.tag) {
        doc.setFillColor(...c);
        const tw = doc.getTextWidth(item.tag) + 5;
        doc.roundedRect(M + contentW - tw - 5, y + 3, tw, 5.5, 1.5, 1.5, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.text(item.tag, M + contentW - tw - 2.5, y + 6.9);
      }
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      bodyLines.forEach((line, i) => doc.text(line, M + 6, y + 12 + i * 4.6));
      y += h + 3;
    }
    y += 2;
  };

  const sevColor = (tag?: string): [number, number, number] => {
    const t = (tag || "").toLowerCase();
    if (t === "high" || t === "élevé" || t === "p0") return [180, 45, 45];
    if (t === "medium" || t === "moyen" || t === "p1") return AMBER;
    return [70, 130, 120];
  };

  // ---------- Page 2: synthèse ----------
  newPage();

  heading("Synthèse exécutive");
  paragraph(data.report.executive_summary || "Synthèse non disponible.");

  const progressPct =
    data.stats.tasks > 0 ? Math.round((data.stats.done / data.stats.tasks) * 100) : data.project.completion_percent;
  const baseMetrics: ReportMetric[] = [
    { label: "Avancement des tâches", value: `${progressPct} %`, comment: `${data.stats.done}/${data.stats.tasks} tâches terminées` },
    { label: "Terminé sur la période", value: `${data.stats.doneRecent} tâches`, comment: `${data.stats.inProgress} en cours, ${data.stats.todo} à faire` },
    { label: "Charge réalisée", value: `${data.stats.doneHours} h`, comment: `sur ${data.stats.totalHours} h planifiées` },
    { label: "Tâches critiques ouvertes", value: `${data.stats.p0Open}`, comment: "priorité P0 non terminées" },
    { label: "Échéances à venir", value: `${data.stats.upcomingEvents}`, comment: "événements planifiés sur la période" },
    {
      label: "Documents stratégiques",
      value: `${data.stats.bpSections} / ${data.stats.bmBlocks}`,
      comment: "sections Business Plan / blocs Business Model renseignés",
    },
  ];
  heading("Indicateurs clés");
  metricCards(baseMetrics);

  if (data.report.highlights?.length) {
    heading("Faits marquants");
    bullets(data.report.highlights);
  }

  // ---------- Avancement ----------
  heading("Analyse de l'avancement");
  paragraph(data.report.progress?.narrative || "Analyse non disponible.");
  if (data.report.progress?.metrics?.length) metricCards(data.report.progress.metrics);

  // ---------- Budget ----------
  heading("Analyse budgétaire");
  if (data.budget) {
    metricCards([
      { label: "Revenus cumulés", value: euro(data.budget.revenue), comment: `horizon ${data.budget.horizon} mois` },
      { label: "EBITDA prévisionnel", value: euro(data.budget.ebitda), comment: "marge brute − charges fixes" },
      { label: "Marge brute", value: euro(data.budget.grossMargin), comment: `charges variables ${euro(data.budget.variable)}` },
      { label: "Charges fixes", value: euro(data.budget.fixed), comment: `investissements ${euro(data.budget.invest)}` },
    ]);
  } else {
    paragraph("Aucun budget prévisionnel n'est rattaché à ce projet.");
  }
  paragraph(data.report.budget?.narrative || "");
  if (data.report.budget?.metrics?.length) metricCards(data.report.budget.metrics);

  // ---------- Risques ----------
  if (data.report.risks?.length) {
    heading("Risques identifiés");
    tagBlock(
      data.report.risks.map((r) => ({
        tag: r.severity,
        title: r.title,
        body: [r.impact ? `Impact : ${r.impact}` : "", r.mitigation ? `Mitigation : ${r.mitigation}` : ""].filter(Boolean),
      })),
      sevColor,
    );
  }

  // ---------- Recommandations ----------
  if (data.report.recommendations?.length) {
    heading("Recommandations");
    tagBlock(
      data.report.recommendations.map((r) => ({
        tag: r.priority,
        title: r.title,
        body: r.detail ? [r.detail] : [],
      })),
      sevColor,
    );
  }

  // ---------- Prochaines étapes ----------
  if (data.report.next_steps?.length) {
    heading("Prochaines étapes");
    tagBlock(
      data.report.next_steps.map((s) => ({
        tag: s.deadline,
        title: s.title,
        body: s.owner ? [`Responsable : ${s.owner}`] : [],
      })),
      () => BURGUNDY,
    );
  }

  // ---------- Footer page numbers ----------
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Page ${p} / ${total}`, pageW - M, pageH - 10, { align: "right" });
    doc.text(`Boss Project Manager — ${generatedAt.toLocaleDateString("fr-FR")}`, M, pageH - 10);
  }

  const slug = data.project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "projet";
  doc.save(`rapport-avancement-${slug}-${generatedAt.toISOString().slice(0, 10)}.pdf`);
}
