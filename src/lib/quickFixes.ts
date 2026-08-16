import { supabase } from "@/integrations/supabase/client";
import type { CheckFinding } from "@/lib/consistencyChecks";

export interface QuickFixContext {
  projectId: string;
  userId: string;
}

export interface QuickFix {
  key: string;
  label: string;
  description: string;
  /** Runs the correction and returns a human-readable summary of what changed. */
  run: (ctx: QuickFixContext) => Promise<string>;
}

const DAY_MAP: Record<string, number> = {
  Dimanche: 0,
  Lundi: 1,
  Mardi: 2,
  Mercredi: 3,
  Jeudi: 4,
  Vendredi: 5,
  Samedi: 6,
};

function parseTimeSlots(slots: string | null): { start: number; end: number }[] {
  if (!slots) return [{ start: 9, end: 12 }, { start: 14, end: 18 }];
  const parsed = slots
    .split(",")
    .map((s) => {
      const m = s.trim().match(/(\d+)h?\s*-\s*(\d+)h?/);
      return m ? { start: parseInt(m[1]), end: parseInt(m[2]) } : null;
    })
    .filter(Boolean) as { start: number; end: number }[];
  return parsed.length ? parsed : [{ start: 9, end: 12 }, { start: 14, end: 18 }];
}

async function loadPlan(projectId: string) {
  const [projectRes, phasesRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("phases").select("id, name, sort_order").eq("project_id", projectId).order("sort_order"),
  ]);
  if (projectRes.error || !projectRes.data) throw new Error("Projet introuvable");
  const phases = phasesRes.data || [];
  const phaseIds = phases.map((p) => p.id);
  const tasksRes = phaseIds.length
    ? await supabase
        .from("tasks")
        .select("id, phase_id, title, status, priority, duration_hours, dependencies, sort_order")
        .in("phase_id", phaseIds)
        .order("sort_order")
    : { data: [] as any[] };
  return { project: projectRes.data as any, phases, tasks: (tasksRes.data || []) as any[] };
}

function resolver<T extends { id: string; title: string }>(tasks: T[]) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const byTitle = new Map(tasks.map((t) => [t.title.trim().toLowerCase(), t]));
  return (dep: string): T | undefined => byId.get(dep) ?? byTitle.get(String(dep).trim().toLowerCase());
}

async function saveDependencies(updates: { id: string; dependencies: string[] }[]) {
  for (const u of updates) {
    const { error } = await supabase.from("tasks").update({ dependencies: u.dependencies }).eq("id", u.id);
    if (error) throw new Error(error.message);
  }
}

/** Rebuilds calendar_events from the current plan using the availability settings. */
async function redispatchCalendar(ctx: QuickFixContext): Promise<string> {
  const { project, phases, tasks } = await loadPlan(ctx.projectId);
  const open = tasks.filter((t) => t.status !== "done");
  if (!open.length) throw new Error("Aucune tâche à planifier");

  const availableDays = new Set(
    (project.days_per_week || []).map((d: string) => DAY_MAP[d] ?? -1).filter((d: number) => d >= 0),
  );
  if (availableDays.size === 0) [1, 2, 3, 4, 5].forEach((d) => availableDays.add(d));
  const slots = parseTimeSlots(project.time_slots);
  const hoursPerDay = slots.reduce((s, x) => s + (x.end - x.start), 0);

  const phaseName = new Map(phases.map((p) => [p.id, p.name]));
  const phaseOrder = new Map(phases.map((p) => [p.id, p.sort_order]));
  const prioOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
  const items = [...open].sort(
    (a, b) =>
      (prioOrder[a.priority] ?? 1) - (prioOrder[b.priority] ?? 1) ||
      (phaseOrder.get(a.phase_id) ?? 0) - (phaseOrder.get(b.phase_id) ?? 0) ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  const rows: any[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const nextAvailable = (d: Date) => {
    const x = new Date(d);
    for (let i = 0; i < 730; i++) {
      if (availableDays.has(x.getDay())) return x;
      x.setDate(x.getDate() + 1);
    }
    return x;
  };
  let day = nextAvailable(cursor);
  let slotIdx = 0;
  let hourInSlot = slots[0].start;
  let hoursLeftToday = hoursPerDay;

  for (const task of items) {
    let remaining = Math.max(0.5, Number(task.duration_hours || 1));
    let guard = 0;
    while (remaining > 0 && guard++ < 500) {
      if (hoursLeftToday <= 0 || slotIdx >= slots.length) {
        day = nextAvailable(new Date(day.getTime() + 86_400_000));
        slotIdx = 0;
        hourInSlot = slots[0].start;
        hoursLeftToday = hoursPerDay;
        continue;
      }
      const slot = slots[slotIdx];
      const room = slot.end - hourInSlot;
      if (room <= 0) {
        slotIdx++;
        if (slotIdx < slots.length) hourInSlot = slots[slotIdx].start;
        continue;
      }
      const chunk = Math.min(remaining, room);
      const start = new Date(day);
      start.setHours(Math.floor(hourInSlot), Math.round((hourInSlot % 1) * 60), 0, 0);
      const end = new Date(start.getTime() + chunk * 3_600_000);
      rows.push({
        user_id: ctx.userId,
        project_id: ctx.projectId,
        task_id: task.id,
        title: task.title,
        description: `Phase : ${phaseName.get(task.phase_id) ?? "—"} · Priorité ${task.priority}`,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        all_day: false,
      });
      remaining -= chunk;
      hoursLeftToday -= chunk;
      hourInSlot += chunk;
      if (hourInSlot >= slot.end) {
        slotIdx++;
        if (slotIdx < slots.length) hourInSlot = slots[slotIdx].start;
      }
    }
  }

  const del = await supabase
    .from("calendar_events")
    .delete()
    .eq("project_id", ctx.projectId)
    .not("task_id", "is", null);
  if (del.error) throw new Error(del.error.message);
  const ins = await supabase.from("calendar_events").insert(rows);
  if (ins.error) throw new Error(ins.error.message);
  const last = rows.length ? new Date(rows[rows.length - 1].end_time) : null;
  return `${rows.length} créneau(x) recalculé(s)${last ? ` jusqu'au ${last.toLocaleDateString("fr-FR")}` : ""}.`;
}

const redispatchFix = (label = "Recalculer les dates"): QuickFix => ({
  key: "redispatch",
  label,
  description: "Supprime les créneaux liés aux tâches et re-dispatche le plan à partir d'aujourd'hui.",
  run: redispatchCalendar,
});

const FIXES: Record<string, QuickFix> = {
  "dates-no-events": redispatchFix("Dispatcher le plan"),
  "dates-events-after-deadline": redispatchFix(),
  "dates-overlaps": redispatchFix("Recalculer les créneaux"),
  "dates-past-not-done": redispatchFix("Replanifier à aujourd'hui"),

  "dates-overload": {
    key: "raise-capacity",
    label: "Ajuster la disponibilité",
    description: "Augmente les heures hebdomadaires au niveau requis pour tenir l'échéance.",
    async run(ctx) {
      const { project, tasks } = await loadPlan(ctx.projectId);
      if (!project.deadline) throw new Error("Aucune échéance définie");
      const openHours = tasks
        .filter((t) => t.status !== "done")
        .reduce((s, t) => s + Number(t.duration_hours || 0), 0);
      const weeks = Math.max(
        1,
        (new Date(project.deadline).getTime() - Date.now()) / (7 * 86_400_000),
      );
      const needed = Math.min(60, Math.ceil(openHours / weeks));
      if (needed <= project.hours_per_week) throw new Error("La disponibilité est déjà suffisante");
      const { error } = await supabase.from("projects").update({ hours_per_week: needed }).eq("id", ctx.projectId);
      if (error) throw new Error(error.message);
      return `Disponibilité portée de ${project.hours_per_week} h à ${needed} h/semaine.`;
    },
  },

  "dates-no-deadline": {
    key: "set-deadline",
    label: "Proposer une échéance",
    description: "Calcule une échéance réaliste à partir de la charge restante et du rythme hebdomadaire.",
    async run(ctx) {
      const { project, tasks } = await loadPlan(ctx.projectId);
      const openHours = tasks
        .filter((t) => t.status !== "done")
        .reduce((s, t) => s + Number(t.duration_hours || 0), 0);
      const perWeek = Math.max(1, Number(project.hours_per_week || 10));
      const weeks = Math.max(1, Math.ceil(openHours / perWeek));
      const date = new Date(Date.now() + weeks * 7 * 86_400_000);
      const iso = date.toISOString().slice(0, 10);
      const { error } = await supabase.from("projects").update({ deadline: iso }).eq("id", ctx.projectId);
      if (error) throw new Error(error.message);
      return `Échéance fixée au ${date.toLocaleDateString("fr-FR")} (${weeks} semaine(s) à ${perWeek} h).`;
    },
  },

  "deps-unknown": {
    key: "clean-unknown-deps",
    label: "Nettoyer les dépendances",
    description: "Supprime les références de dépendance qui ne correspondent à aucune tâche.",
    async run(ctx) {
      const { tasks } = await loadPlan(ctx.projectId);
      const resolve = resolver(tasks);
      const updates: { id: string; dependencies: string[] }[] = [];
      let removed = 0;
      for (const t of tasks) {
        const deps = (t.dependencies || []).filter(Boolean);
        const kept = deps.filter((d: string) => !!resolve(d));
        if (kept.length !== deps.length) {
          removed += deps.length - kept.length;
          updates.push({ id: t.id, dependencies: kept });
        }
      }
      if (!updates.length) throw new Error("Aucune dépendance orpheline à supprimer");
      await saveDependencies(updates);
      return `${removed} référence(s) obsolète(s) supprimée(s) sur ${updates.length} tâche(s).`;
    },
  },

  "deps-self": {
    key: "clean-self-deps",
    label: "Retirer les auto-dépendances",
    description: "Supprime les dépendances d'une tâche vers elle-même.",
    async run(ctx) {
      const { tasks } = await loadPlan(ctx.projectId);
      const updates: { id: string; dependencies: string[] }[] = [];
      let removed = 0;
      for (const t of tasks) {
        const deps = (t.dependencies || []).filter(Boolean);
        const kept = deps.filter(
          (d: string) => d !== t.id && String(d).trim().toLowerCase() !== t.title.trim().toLowerCase(),
        );
        if (kept.length !== deps.length) {
          removed += deps.length - kept.length;
          updates.push({ id: t.id, dependencies: kept });
        }
      }
      if (!updates.length) throw new Error("Aucune auto-dépendance détectée");
      await saveDependencies(updates);
      return `${removed} auto-dépendance(s) retirée(s).`;
    },
  },

  "deps-cycle": {
    key: "break-cycles",
    label: "Casser les cycles",
    description: "Supprime le minimum de dépendances nécessaires pour rendre le graphe acyclique.",
    async run(ctx) {
      const { tasks } = await loadPlan(ctx.projectId);
      const resolve = resolver(tasks);
      const graph = new Map<string, string[]>();
      for (const t of tasks) {
        graph.set(
          t.id,
          (t.dependencies || [])
            .filter(Boolean)
            .map((d: string) => resolve(d)?.id)
            .filter((x): x is string => !!x && x !== t.id),
        );
      }
      const state = new Map<string, 0 | 1 | 2>();
      const cut = new Set<string>(); // "from|to"
      const dfs = (id: string) => {
        state.set(id, 1);
        for (const n of graph.get(id) || []) {
          if (cut.has(`${id}|${n}`)) continue;
          if (state.get(n) === 1) {
            cut.add(`${id}|${n}`);
            continue;
          }
          if (state.get(n) !== 2) dfs(n);
        }
        state.set(id, 2);
      };
      tasks.forEach((t) => {
        if (state.get(t.id) !== 2) dfs(t.id);
      });
      if (!cut.size) throw new Error("Aucun cycle détecté");

      const updates: { id: string; dependencies: string[] }[] = [];
      for (const t of tasks) {
        const deps = (t.dependencies || []).filter(Boolean);
        const kept = deps.filter((d: string) => {
          const target = resolve(d)?.id;
          return !target || !cut.has(`${t.id}|${target}`);
        });
        if (kept.length !== deps.length) updates.push({ id: t.id, dependencies: kept });
      }
      await saveDependencies(updates);
      return `${cut.size} dépendance(s) supprimée(s) pour éliminer les cycles.`;
    },
  },

  "deps-backward-phase": {
    key: "fix-backward-deps",
    label: "Corriger le sens des dépendances",
    description: "Supprime les dépendances pointant vers une phase postérieure.",
    async run(ctx) {
      const { phases, tasks } = await loadPlan(ctx.projectId);
      const order = new Map(phases.map((p) => [p.id, p.sort_order]));
      const resolve = resolver(tasks);
      const updates: { id: string; dependencies: string[] }[] = [];
      let removed = 0;
      for (const t of tasks) {
        const deps = (t.dependencies || []).filter(Boolean);
        const kept = deps.filter((d: string) => {
          const dep = resolve(d);
          if (!dep) return true;
          const a = order.get(t.phase_id);
          const b = order.get(dep.phase_id);
          return !(a !== undefined && b !== undefined && b > a);
        });
        if (kept.length !== deps.length) {
          removed += deps.length - kept.length;
          updates.push({ id: t.id, dependencies: kept });
        }
      }
      if (!updates.length) throw new Error("Aucune dépendance à contre-sens");
      await saveDependencies(updates);
      return `${removed} dépendance(s) à contre-sens supprimée(s).`;
    },
  },

  "deps-p0-blocked": {
    key: "promote-prereqs",
    label: "Prioriser les prérequis",
    description: "Passe en P0 les prérequis non terminés des tâches critiques.",
    async run(ctx) {
      const { tasks } = await loadPlan(ctx.projectId);
      const resolve = resolver(tasks);
      const promote = new Set<string>();
      for (const t of tasks.filter((x) => x.priority === "P0" && x.status !== "done")) {
        for (const d of (t.dependencies || []).filter(Boolean)) {
          const dep = resolve(d);
          if (dep && dep.status !== "done" && dep.priority !== "P0") promote.add(dep.id);
        }
      }
      if (!promote.size) throw new Error("Aucun prérequis à remonter");
      const { error } = await supabase.from("tasks").update({ priority: "P0" }).in("id", [...promote]);
      if (error) throw new Error(error.message);
      return `${promote.size} prérequis passé(s) en P0.`;
    },
  },

  "deps-empty-phases": {
    key: "remove-empty-phases",
    label: "Supprimer les phases vides",
    description: "Supprime les phases qui ne contiennent aucune tâche.",
    async run(ctx) {
      const { phases, tasks } = await loadPlan(ctx.projectId);
      const empty = phases.filter((p) => !tasks.some((t) => t.phase_id === p.id));
      if (!empty.length) throw new Error("Aucune phase vide");
      const { error } = await supabase
        .from("phases")
        .delete()
        .in("id", empty.map((p) => p.id));
      if (error) throw new Error(error.message);
      return `${empty.length} phase(s) vide(s) supprimée(s).`;
    },
  },

  "budget-horizon-short": {
    key: "extend-horizon",
    label: "Étendre l'horizon",
    description: "Aligne l'horizon budgétaire sur la durée du projet et complète les mois manquants.",
    async run(ctx) {
      const { project } = await loadPlan(ctx.projectId);
      if (!project.deadline) throw new Error("Aucune échéance définie");
      const { data: budget } = await supabase
        .from("budgets")
        .select("id, horizon_months")
        .eq("project_id", ctx.projectId)
        .maybeSingle();
      if (!budget) throw new Error("Aucun budget rattaché");
      const months = Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (30 * 86_400_000));
      if (months <= budget.horizon_months) throw new Error("L'horizon couvre déjà le projet");
      const { data: lines } = await supabase
        .from("budget_lines")
        .select("id, monthly_values")
        .eq("budget_id", budget.id);
      for (const l of lines || []) {
        const values = Array.isArray(l.monthly_values) ? [...(l.monthly_values as number[])] : [];
        while (values.length < months) values.push(0);
        const { error } = await supabase.from("budget_lines").update({ monthly_values: values }).eq("id", l.id);
        if (error) throw new Error(error.message);
      }
      const { error } = await supabase.from("budgets").update({ horizon_months: months }).eq("id", budget.id);
      if (error) throw new Error(error.message);
      return `Horizon étendu de ${budget.horizon_months} à ${months} mois.`;
    },
  },

  "budget-zero-lines": {
    key: "remove-zero-lines",
    label: "Supprimer les lignes à zéro",
    description: "Retire du prévisionnel les lignes dont tous les montants sont nuls.",
    async run(ctx) {
      const { data: budget } = await supabase
        .from("budgets")
        .select("id")
        .eq("project_id", ctx.projectId)
        .maybeSingle();
      if (!budget) throw new Error("Aucun budget rattaché");
      const { data: lines } = await supabase
        .from("budget_lines")
        .select("id, monthly_values, is_total")
        .eq("budget_id", budget.id);
      const zero = (lines || []).filter(
        (l) =>
          !l.is_total &&
          (Array.isArray(l.monthly_values) ? (l.monthly_values as number[]) : []).reduce(
            (s, v) => s + Number(v || 0),
            0,
          ) === 0,
      );
      if (!zero.length) throw new Error("Aucune ligne à zéro");
      const { error } = await supabase
        .from("budget_lines")
        .delete()
        .in("id", zero.map((l) => l.id));
      if (error) throw new Error(error.message);
      return `${zero.length} ligne(s) budgétaire(s) supprimée(s).`;
    },
  },
};

export function getQuickFix(finding: CheckFinding): QuickFix | null {
  return FIXES[finding.id] ?? null;
}

export function countQuickFixes(findings: CheckFinding[]): number {
  return findings.filter((f) => !!getQuickFix(f)).length;
}
