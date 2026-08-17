import type { ProgressReportPayload } from "./progressReportPdf";

const SEP = ";";

function cell(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return /[";\n]/.test(s) ? `"${s}"` : s;
}

function row(values: unknown[]) {
  return values.map(cell).join(SEP);
}

export function buildProgressReportCsv(data: ProgressReportPayload): string {
  const lines: string[] = [];
  const section = (title: string) => {
    if (lines.length) lines.push("");
    lines.push(row([`## ${title}`]));
  };
  const generatedAt = new Date(data.generated_at);

  section("Rapport d'avancement");
  lines.push(row(["Projet", data.project.title]));
  lines.push(row(["Statut", data.project.status]));
  lines.push(row(["Périodicité", data.period_label]));
  lines.push(row(["Généré le", generatedAt.toLocaleString("fr-FR")]));
  lines.push(row(["Avancement (%)", data.project.completion_percent]));
  lines.push(
    row(["Échéance", data.project.deadline ? new Date(data.project.deadline).toLocaleDateString("fr-FR") : "—"]),
  );
  lines.push(row(["Moteur IA", data.engine]));

  section("Indicateurs clés");
  lines.push(row(["Indicateur", "Valeur"]));
  const s = data.stats;
  const progressPct = s.tasks > 0 ? Math.round((s.done / s.tasks) * 100) : data.project.completion_percent;
  [
    ["Avancement des tâches (%)", progressPct],
    ["Phases", s.phases],
    ["Tâches totales", s.tasks],
    ["Tâches terminées", s.done],
    ["Terminées sur la période", s.doneRecent],
    ["Tâches en cours", s.inProgress],
    ["Tâches à faire", s.todo],
    ["Tâches critiques ouvertes (P0)", s.p0Open],
    ["Heures planifiées", s.totalHours],
    ["Heures réalisées", s.doneHours],
    ["Échéances à venir", s.upcomingEvents],
    ["Sections Business Plan", s.bpSections],
    ["Blocs Business Model", s.bmBlocks],
  ].forEach((r) => lines.push(row(r)));

  section("Budget prévisionnel");
  if (data.budget) {
    lines.push(row(["Indicateur", "Valeur (€)"]));
    [
      ["Revenus cumulés", data.budget.revenue],
      ["Charges fixes", data.budget.fixed],
      ["Charges variables", data.budget.variable],
      ["Investissements", data.budget.invest],
      ["Marge brute", data.budget.grossMargin],
      ["EBITDA", data.budget.ebitda],
    ].forEach((r) => lines.push(row(r)));
    lines.push(row(["Horizon (mois)", data.budget.horizon]));
    lines.push(row(["Lignes budgétaires", data.budget.lines]));
  } else {
    lines.push(row(["Aucun budget prévisionnel rattaché à ce projet"]));
  }

  const charts = data.charts;
  const trend = charts?.progressTrend ?? [];
  if (trend.length) {
    section("Tendance d'avancement / Burndown");
    lines.push(
      row([
        "Date",
        "Terminées (cumul)",
        "Avancement (%)",
        "Rythme cible",
        "Heures restantes",
        "Heures idéales",
      ]),
    );
    trend.forEach((t) =>
      lines.push(row([t.date, t.doneCumul, t.percent, t.target, t.remainingHours, t.idealHours])),
    );
  }

  const budgetMonthly = charts?.budgetMonthly ?? [];
  if (budgetMonthly.length) {
    section("Budget mensuel (écarts & trésorerie)");
    lines.push(row(["Mois", "Revenus (€)", "Charges (€)", "Résultat net (€)", "Net cumulé (€)"]));
    budgetMonthly.forEach((m) => lines.push(row([m.month, m.revenue, m.charges, m.net, m.cumulNet])));
  }

  const phases = charts?.phaseProgress ?? [];
  if (phases.length) {
    section("Avancement par phase");
    lines.push(row(["Phase", "Terminées", "En cours", "À faire"]));
    phases.forEach((p) => lines.push(row([p.name, p.done, p.inProgress, p.todo])));
  }

  const r = data.report;
  if (r.executive_summary) {
    section("Synthèse exécutive");
    lines.push(row([r.executive_summary]));
  }
  if (r.highlights?.length) {
    section("Faits marquants");
    r.highlights.forEach((h) => lines.push(row([h])));
  }
  if (r.progress?.narrative || r.progress?.metrics?.length) {
    section("Analyse de l'avancement");
    if (r.progress.narrative) lines.push(row([r.progress.narrative]));
    if (r.progress.metrics?.length) {
      lines.push(row(["Indicateur", "Valeur", "Commentaire"]));
      r.progress.metrics.forEach((m) => lines.push(row([m.label, m.value, m.comment ?? ""])));
    }
  }
  if (r.budget?.narrative || r.budget?.metrics?.length) {
    section("Analyse budgétaire");
    if (r.budget.narrative) lines.push(row([r.budget.narrative]));
    if (r.budget.metrics?.length) {
      lines.push(row(["Indicateur", "Valeur", "Commentaire"]));
      r.budget.metrics.forEach((m) => lines.push(row([m.label, m.value, m.comment ?? ""])));
    }
  }
  if (r.risks?.length) {
    section("Risques identifiés");
    lines.push(row(["Risque", "Sévérité", "Impact", "Mitigation"]));
    r.risks.forEach((x) => lines.push(row([x.title, x.severity ?? "", x.impact ?? "", x.mitigation ?? ""])));
  }
  if (r.recommendations?.length) {
    section("Recommandations");
    lines.push(row(["Recommandation", "Priorité", "Détail"]));
    r.recommendations.forEach((x) => lines.push(row([x.title, x.priority ?? "", x.detail ?? ""])));
  }
  if (r.next_steps?.length) {
    section("Prochaines étapes");
    lines.push(row(["Étape", "Échéance", "Responsable"]));
    r.next_steps.forEach((x) => lines.push(row([x.title, x.deadline ?? "", x.owner ?? ""])));
  }

  return lines.join("\r\n");
}

export function exportProgressReportCSV(data: ProgressReportPayload) {
  const csv = buildProgressReportCsv(data);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const slug =
    data.project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "projet";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rapport-avancement-${slug}-${new Date(data.generated_at).toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
