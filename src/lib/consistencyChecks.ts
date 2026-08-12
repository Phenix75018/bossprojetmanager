export type CheckSeverity = "error" | "warn" | "info";
export type CheckCategory = "dates" | "dependencies" | "budget";

export interface CheckFinding {
  id: string;
  category: CheckCategory;
  severity: CheckSeverity;
  title: string;
  detail: string;
  recommendation: string;
  href?: string;
  cta?: string;
}

export interface CheckInput {
  project: {
    id: string;
    title: string;
    deadline: string | null;
    hours_per_week: number;
    days_per_week: string[] | null;
    updated_at: string;
    completion_percent: number;
  };
  phases: { id: string; name: string; sort_order: number }[];
  tasks: {
    id: string;
    phase_id: string;
    title: string;
    status: string;
    priority: string;
    duration_hours: number;
    dependencies: string[] | null;
  }[];
  events: { id: string; title: string; start_time: string; end_time: string; task_id: string | null }[];
  budget:
    | {
        id: string;
        horizon_months: number;
        updated_at: string;
        lines: { category: string; label: string; monthly_values: number[]; is_total: boolean }[];
      }
    | null;
  bpUpdatedAt?: string | null;
}

export interface CheckResult {
  score: number;
  findings: CheckFinding[];
  counts: { error: number; warn: number; info: number };
  byCategory: Record<CheckCategory, { score: number; error: number; warn: number; info: number }>;
  summary: {
    tasks: number;
    openHours: number;
    availableHours: number | null;
    daysToDeadline: number | null;
    cashLow: number | null;
    ebitda: number | null;
  };
}

const WEIGHT: Record<CheckSeverity, number> = { error: 14, warn: 6, info: 2 };
const DAY = 86_400_000;

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("fr-FR");
}
function euro(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}
function monthlySum(values: unknown) {
  return Array.isArray(values) ? values.reduce((a: number, b: any) => a + Number(b || 0), 0) : 0;
}

export function runConsistencyChecks(input: CheckInput): CheckResult {
  const { project, phases, tasks, events, budget } = input;
  const f: CheckFinding[] = [];
  const now = new Date();
  const planHref = `/plan/${project.id}`;

  const openTasks = tasks.filter((t) => t.status !== "done");
  const openHours = openTasks.reduce((s, t) => s + Number(t.duration_hours || 0), 0);
  const deadline = project.deadline ? new Date(project.deadline) : null;
  const daysToDeadline = deadline ? Math.round((deadline.getTime() - now.getTime()) / DAY) : null;
  const weeksLeft = daysToDeadline !== null ? Math.max(0, daysToDeadline / 7) : null;
  const availableHours = weeksLeft !== null ? Math.round(weeksLeft * Number(project.hours_per_week || 0)) : null;

  // ---------------- DATES ----------------
  if (!deadline) {
    f.push({
      id: "dates-no-deadline",
      category: "dates",
      severity: "warn",
      title: "Aucune échéance définie",
      detail: "Le projet n'a pas de date cible, la planification ne peut pas être vérifiée dans le temps.",
      recommendation: "Définissez une échéance réaliste pour permettre le calcul de la charge et du rythme cible.",
      href: planHref,
      cta: "Ouvrir le plan",
    });
  } else {
    if (daysToDeadline !== null && daysToDeadline < 0 && openTasks.length > 0) {
      f.push({
        id: "dates-deadline-past",
        category: "dates",
        severity: "error",
        title: `Échéance dépassée de ${Math.abs(daysToDeadline)} jour(s)`,
        detail: `Échéance au ${fmtDate(deadline)} alors que ${openTasks.length} tâche(s) restent ouvertes (${Math.round(openHours)} h).`,
        recommendation: "Replanifiez l'échéance ou basculez les tâches non critiques en optionnel, puis re-dispatchez le calendrier.",
        href: planHref,
        cta: "Replanifier",
      });
    }
    if (availableHours !== null && daysToDeadline !== null && daysToDeadline >= 0 && openHours > availableHours) {
      const over = Math.round(openHours - availableHours);
      f.push({
        id: "dates-overload",
        category: "dates",
        severity: over > availableHours * 0.25 ? "error" : "warn",
        title: "Charge supérieure au temps disponible",
        detail: `${Math.round(openHours)} h restantes pour ${availableHours} h disponibles d'ici le ${fmtDate(deadline)} (${project.hours_per_week} h/semaine) → dépassement de ${over} h.`,
        recommendation: `Augmentez la disponibilité (~${Math.ceil(openHours / Math.max(1, weeksLeft!))} h/semaine), repoussez l'échéance ou réduisez le périmètre des tâches P2.`,
        href: planHref,
        cta: "Ajuster la charge",
      });
    }
    const lateEvents = events.filter((e) => new Date(e.start_time) > deadline);
    if (lateEvents.length) {
      f.push({
        id: "dates-events-after-deadline",
        category: "dates",
        severity: "error",
        title: `${lateEvents.length} créneau(x) planifié(s) après l'échéance`,
        detail: `Ex. « ${lateEvents[0].title} » le ${fmtDate(lateEvents[0].start_time)}.`,
        recommendation: "Re-dispatchez le calendrier après avoir augmenté les heures hebdomadaires ou décalé l'échéance.",
        href: "/calendar",
        cta: "Voir le calendrier",
      });
    }
  }

  // Overlapping events
  const sorted = [...events].sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  const overlaps: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (new Date(sorted[i].start_time) < new Date(sorted[i - 1].end_time)) {
      overlaps.push(`${sorted[i - 1].title} ↔ ${sorted[i].title}`);
    }
  }
  if (overlaps.length) {
    f.push({
      id: "dates-overlaps",
      category: "dates",
      severity: "warn",
      title: `${overlaps.length} chevauchement(s) de créneaux`,
      detail: overlaps.slice(0, 3).join(" · "),
      recommendation: "Re-dispatchez les tâches ou déplacez manuellement les créneaux en conflit dans le calendrier.",
      href: "/calendar",
      cta: "Résoudre",
    });
  }

  // Events in the past for tasks still open
  const staleEvents = events.filter((e) => {
    if (new Date(e.end_time) >= now || !e.task_id) return false;
    const t = tasks.find((x) => x.id === e.task_id);
    return t && t.status !== "done";
  });
  if (staleEvents.length) {
    f.push({
      id: "dates-past-not-done",
      category: "dates",
      severity: "warn",
      title: `${staleEvents.length} créneau(x) passé(s) sans tâche terminée`,
      detail: "Des créneaux sont écoulés alors que les tâches associées ne sont pas marquées comme terminées.",
      recommendation: "Mettez à jour le statut des tâches réalisées ou replanifiez-les pour garder un avancement fiable.",
      href: planHref,
      cta: "Mettre à jour",
    });
  }

  if (tasks.length > 0 && events.length === 0) {
    f.push({
      id: "dates-no-events",
      category: "dates",
      severity: "info",
      title: "Aucun créneau planifié",
      detail: "Le plan d'action existe mais aucune tâche n'est dispatchée dans le calendrier.",
      recommendation: "Lancez le dispatch automatique depuis le calendrier pour obtenir des dates de réalisation.",
      href: "/calendar",
      cta: "Dispatcher",
    });
  }

  // ---------------- DEPENDENCIES ----------------
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const titleIndex = new Map(tasks.map((t) => [t.title.trim().toLowerCase(), t]));
  const phaseOrder = new Map(phases.map((p) => [p.id, p.sort_order]));
  const resolve = (dep: string) => byId.get(dep) ?? titleIndex.get(String(dep).trim().toLowerCase());

  const unknownDeps: string[] = [];
  const selfDeps: string[] = [];
  const doneBeforeDep: string[] = [];
  const backwardPhase: string[] = [];
  const graph = new Map<string, string[]>();

  for (const t of tasks) {
    const deps = (t.dependencies || []).filter(Boolean);
    const resolved: string[] = [];
    for (const d of deps) {
      if (d === t.id || String(d).trim().toLowerCase() === t.title.trim().toLowerCase()) {
        selfDeps.push(t.title);
        continue;
      }
      const dep = resolve(d);
      if (!dep) {
        unknownDeps.push(`${t.title} → « ${d} »`);
        continue;
      }
      resolved.push(dep.id);
      if (t.status === "done" && dep.status !== "done") doneBeforeDep.push(`${t.title} ← ${dep.title}`);
      const a = phaseOrder.get(t.phase_id);
      const b = phaseOrder.get(dep.phase_id);
      if (a !== undefined && b !== undefined && b > a) backwardPhase.push(`${t.title} ← ${dep.title}`);
    }
    graph.set(t.id, resolved);
  }

  // cycle detection
  const state = new Map<string, 0 | 1 | 2>();
  const cycles: string[] = [];
  const dfs = (id: string, path: string[]) => {
    if (state.get(id) === 1) {
      const start = path.indexOf(id);
      cycles.push(
        path
          .slice(start >= 0 ? start : 0)
          .concat(id)
          .map((x) => byId.get(x)?.title ?? x)
          .join(" → "),
      );
      return;
    }
    if (state.get(id) === 2) return;
    state.set(id, 1);
    for (const n of graph.get(id) || []) dfs(n, [...path, id]);
    state.set(id, 2);
  };
  tasks.forEach((t) => dfs(t.id, []));

  if (cycles.length) {
    f.push({
      id: "deps-cycle",
      category: "dependencies",
      severity: "error",
      title: `${cycles.length} dépendance(s) circulaire(s)`,
      detail: cycles.slice(0, 2).join(" · "),
      recommendation: "Supprimez l'une des dépendances du cycle : une chaîne circulaire rend le séquencement impossible.",
      href: planHref,
      cta: "Corriger",
    });
  }
  if (unknownDeps.length) {
    f.push({
      id: "deps-unknown",
      category: "dependencies",
      severity: "warn",
      title: `${unknownDeps.length} dépendance(s) introuvable(s)`,
      detail: unknownDeps.slice(0, 3).join(" · "),
      recommendation: "Rattachez ces dépendances à une tâche existante ou supprimez la référence obsolète.",
      href: planHref,
      cta: "Corriger",
    });
  }
  if (selfDeps.length) {
    f.push({
      id: "deps-self",
      category: "dependencies",
      severity: "warn",
      title: `${selfDeps.length} tâche(s) dépendante(s) d'elle(s)-même(s)`,
      detail: selfDeps.slice(0, 3).join(" · "),
      recommendation: "Retirez l'auto-dépendance pour permettre l'ordonnancement de la tâche.",
      href: planHref,
      cta: "Corriger",
    });
  }
  if (doneBeforeDep.length) {
    f.push({
      id: "deps-done-before",
      category: "dependencies",
      severity: "error",
      title: `${doneBeforeDep.length} tâche(s) terminée(s) avant leur prérequis`,
      detail: doneBeforeDep.slice(0, 3).join(" · "),
      recommendation: "Vérifiez le statut réel : soit le prérequis est terminé, soit la dépendance n'est pas pertinente.",
      href: planHref,
      cta: "Vérifier",
    });
  }
  if (backwardPhase.length) {
    f.push({
      id: "deps-backward-phase",
      category: "dependencies",
      severity: "warn",
      title: `${backwardPhase.length} dépendance(s) vers une phase ultérieure`,
      detail: backwardPhase.slice(0, 3).join(" · "),
      recommendation: "Réordonnez les phases ou déplacez la tâche pour respecter la chronologie du plan.",
      href: planHref,
      cta: "Réordonner",
    });
  }

  const p0Open = tasks.filter((t) => t.priority === "P0" && t.status !== "done");
  const p0Blocked = p0Open.filter((t) =>
    (t.dependencies || []).some((d) => {
      const dep = resolve(d);
      return dep && dep.status !== "done" && dep.priority !== "P0";
    }),
  );
  if (p0Blocked.length) {
    f.push({
      id: "deps-p0-blocked",
      category: "dependencies",
      severity: "warn",
      title: `${p0Blocked.length} tâche(s) critique(s) bloquée(s) par une tâche non critique`,
      detail: p0Blocked.slice(0, 3).map((t) => t.title).join(" · "),
      recommendation: "Remontez la priorité des prérequis en P0 pour qu'ils soient dispatchés avant les tâches critiques.",
      href: planHref,
      cta: "Prioriser",
    });
  }

  const emptyPhases = phases.filter((p) => !tasks.some((t) => t.phase_id === p.id));
  if (emptyPhases.length) {
    f.push({
      id: "deps-empty-phases",
      category: "dependencies",
      severity: "info",
      title: `${emptyPhases.length} phase(s) sans tâche`,
      detail: emptyPhases.slice(0, 3).map((p) => p.name).join(" · "),
      recommendation: "Ajoutez des tâches à ces phases ou supprimez-les pour clarifier le plan.",
      href: planHref,
      cta: "Compléter",
    });
  }

  // ---------------- BUDGET ----------------
  let cashLow: number | null = null;
  let ebitda: number | null = null;

  if (!budget) {
    f.push({
      id: "budget-missing",
      category: "budget",
      severity: "error",
      title: "Aucun budget prévisionnel",
      detail: "Ce projet n'a pas de budget rattaché : impossible de vérifier la faisabilité financière.",
      recommendation: "Générez un budget prévisionnel à partir du Business Plan pour valider le modèle économique.",
      href: "/budgets",
      cta: "Créer un budget",
    });
  } else {
    const real = budget.lines.filter((l) => !l.is_total);
    const catSum = (c: string) => real.filter((l) => l.category === c).reduce((s, l) => s + monthlySum(l.monthly_values), 0);
    const revenue = catSum("revenue");
    const fixed = Math.abs(catSum("fixed_charges"));
    const variable = Math.abs(catSum("variable_charges"));
    const invest = Math.abs(catSum("investments"));
    ebitda = revenue - variable - fixed;

    const horizon = Math.max(1, Number(budget.horizon_months || 12));
    const monthAt = (cats: string[], i: number) =>
      real
        .filter((l) => cats.includes(l.category))
        .reduce((s, l) => s + Number(Array.isArray(l.monthly_values) ? l.monthly_values[i] || 0 : 0), 0);
    let cumul = 0;
    let low = 0;
    let lowMonth = 0;
    for (let i = 0; i < horizon; i++) {
      cumul += monthAt(["revenue"], i) - Math.abs(monthAt(["fixed_charges", "variable_charges", "investments"], i));
      if (cumul < low) {
        low = cumul;
        lowMonth = i + 1;
      }
    }
    cashLow = Math.round(low);

    if (real.length === 0) {
      f.push({
        id: "budget-empty",
        category: "budget",
        severity: "error",
        title: "Budget vide",
        detail: "Le budget existe mais ne contient aucune ligne exploitable.",
        recommendation: "Générez ou saisissez les lignes de revenus et de charges sur l'horizon retenu.",
        href: `/budget/${budget.id}`,
        cta: "Compléter",
      });
    }
    if (revenue === 0 && real.length > 0) {
      f.push({
        id: "budget-no-revenue",
        category: "budget",
        severity: "error",
        title: "Aucun revenu prévisionnel",
        detail: `Charges cumulées de ${euro(fixed + variable + invest)} sans revenu associé.`,
        recommendation: "Ajoutez les lignes de revenus issues du pricing et du volume prévus dans les hypothèses.",
        href: `/budget/${budget.id}`,
        cta: "Ajouter des revenus",
      });
    }
    if (ebitda < 0) {
      f.push({
        id: "budget-negative-ebitda",
        category: "budget",
        severity: revenue > 0 && Math.abs(ebitda) < revenue * 0.15 ? "warn" : "error",
        title: `EBITDA prévisionnel négatif (${euro(ebitda)})`,
        detail: `Revenus ${euro(revenue)} · charges variables ${euro(variable)} · charges fixes ${euro(fixed)}.`,
        recommendation: "Relevez le pricing, réduisez les charges fixes ou allongez l'horizon pour atteindre le point mort.",
        href: `/budget/${budget.id}`,
        cta: "Analyser",
      });
    }
    if (low < 0) {
      f.push({
        id: "budget-cash-gap",
        category: "budget",
        severity: "error",
        title: `Trésorerie négative (${euro(low)} au mois ${lowMonth})`,
        detail: "Le cumul net devient négatif avant d'être compensé par les revenus.",
        recommendation: `Prévoyez un financement d'au moins ${euro(Math.abs(low) * 1.2)} (fonds propres, prêt) ou étalez les investissements.`,
        href: `/budget/${budget.id}`,
        cta: "Voir la trésorerie",
      });
    }
    if (revenue > 0 && variable > revenue * 0.7) {
      f.push({
        id: "budget-variable-high",
        category: "budget",
        severity: "warn",
        title: "Charges variables trop élevées",
        detail: `Les charges variables représentent ${Math.round((variable / revenue) * 100)} % des revenus (marge brute ${euro(revenue - variable)}).`,
        recommendation: "Vérifiez le coût unitaire et le pricing : viser une marge brute d'au moins 40 % des revenus.",
        href: `/budget/${budget.id}`,
        cta: "Revoir la marge",
      });
    }
    if (deadline) {
      const months = Math.ceil((deadline.getTime() - now.getTime()) / (30 * DAY));
      if (months > horizon) {
        f.push({
          id: "budget-horizon-short",
          category: "budget",
          severity: "warn",
          title: "Horizon budgétaire plus court que le projet",
          detail: `Horizon de ${horizon} mois pour une échéance projet à ~${months} mois.`,
          recommendation: `Étendez l'horizon budgétaire à au moins ${months} mois pour couvrir toute la durée du projet.`,
          href: `/budget/${budget.id}`,
          cta: "Étendre",
        });
      }
    }
    if (input.bpUpdatedAt && new Date(input.bpUpdatedAt).getTime() - new Date(budget.updated_at).getTime() > 7 * DAY) {
      f.push({
        id: "budget-stale",
        category: "budget",
        severity: "info",
        title: "Budget plus ancien que le Business Plan",
        detail: `Budget mis à jour le ${fmtDate(budget.updated_at)}, Business Plan le ${fmtDate(input.bpUpdatedAt)}.`,
        recommendation: "Régénérez le budget pour refléter les hypothèses les plus récentes du Business Plan.",
        href: `/budget/${budget.id}`,
        cta: "Régénérer",
      });
    }
    const zeroLines = real.filter((l) => monthlySum(l.monthly_values) === 0);
    if (zeroLines.length) {
      f.push({
        id: "budget-zero-lines",
        category: "budget",
        severity: "info",
        title: `${zeroLines.length} ligne(s) budgétaire(s) à zéro`,
        detail: zeroLines.slice(0, 3).map((l) => l.label).join(" · "),
        recommendation: "Chiffrez ces lignes ou supprimez-les pour éviter d'alourdir le prévisionnel.",
        href: `/budget/${budget.id}`,
        cta: "Chiffrer",
      });
    }
  }

  // ---------------- Scoring ----------------
  const order: Record<CheckSeverity, number> = { error: 0, warn: 1, info: 2 };
  f.sort((a, b) => order[a.severity] - order[b.severity]);

  const counts = {
    error: f.filter((x) => x.severity === "error").length,
    warn: f.filter((x) => x.severity === "warn").length,
    info: f.filter((x) => x.severity === "info").length,
  };
  const penalty = f.reduce((s, x) => s + WEIGHT[x.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  const cats: CheckCategory[] = ["dates", "dependencies", "budget"];
  const byCategory = cats.reduce(
    (acc, c) => {
      const list = f.filter((x) => x.category === c);
      acc[c] = {
        score: Math.max(0, 100 - list.reduce((s, x) => s + WEIGHT[x.severity], 0) * 1.6),
        error: list.filter((x) => x.severity === "error").length,
        warn: list.filter((x) => x.severity === "warn").length,
        info: list.filter((x) => x.severity === "info").length,
      };
      return acc;
    },
    {} as CheckResult["byCategory"],
  );
  cats.forEach((c) => (byCategory[c].score = Math.round(byCategory[c].score)));

  return {
    score,
    findings: f,
    counts,
    byCategory,
    summary: {
      tasks: tasks.length,
      openHours: Math.round(openHours),
      availableHours,
      daysToDeadline,
      cashLow,
      ebitda: ebitda === null ? null : Math.round(ebitda),
    },
  };
}
