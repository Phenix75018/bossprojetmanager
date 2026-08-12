import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `Tu es un Directeur de Programme / DAF senior qui rédige des rapports d'avancement destinés à un comité de direction, à des investisseurs ou à des partenaires financiers.

Tu réponds UNIQUEMENT en JSON valide, sans texte avant ni après, au format :
{
  "executive_summary": "3 à 6 phrases synthétiques, factuelles, orientées décision.",
  "highlights": ["fait marquant chiffré", "..."],
  "progress": {
    "narrative": "Analyse de l'avancement (rythme, phases, goulots d'étranglement, tâches critiques).",
    "metrics": [{ "label": "Avancement global", "value": "42 %", "comment": "vs 55 % attendu" }]
  },
  "budget": {
    "narrative": "Analyse budgétaire : revenus, charges, marge, trésorerie, écarts.",
    "metrics": [{ "label": "EBITDA prévisionnel", "value": "12 400 €", "comment": "sur l'horizon" }]
  },
  "risks": [{ "title": "...", "severity": "high|medium|low", "impact": "...", "mitigation": "..." }],
  "recommendations": [{ "title": "...", "detail": "...", "priority": "P0|P1|P2" }],
  "next_steps": [{ "title": "...", "deadline": "date ou échéance relative", "owner": "rôle responsable" }]
}

RÈGLES :
- Français professionnel, phrases courtes, ton factuel.
- N'INVENTE AUCUN CHIFFRE : n'utilise que les données du contexte fourni. Si une donnée manque, dis-le explicitement ("non renseigné").
- 3 à 6 highlights, 2 à 6 métriques par bloc, 2 à 5 risques, 3 à 6 recommandations, 3 à 6 prochaines étapes.
- Les recommandations doivent être actionnables et priorisées.`;

function euro(n: number) {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

async function callDeepSeek(messages: any[]): Promise<string> {
  const key = Deno.env.get("DEEPSEEK_API_KEY");
  if (!key) throw new Error("DEEPSEEK_API_KEY missing");
  const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`DeepSeek ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}

async function callLovable(messages: any[]): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const r = await fetch(LOVABLE_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      temperature: 0.4,
    }),
  });
  if (!r.ok) throw new Error(`Lovable AI ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}

function parseJson(raw: string): any {
  let text = (raw || "").trim();
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.substring(start, end + 1);
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const projectId: string | undefined = body?.projectId;
    const period: "week" | "month" | "quarter" =
      body?.period === "month" || body?.period === "quarter" ? body.period : "week";

    if (!projectId || typeof projectId !== "string") {
      return new Response(JSON.stringify({ error: "projectId requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsErr || !userId) {
      return new Response(JSON.stringify({ error: "Session invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Project ----
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Projet introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const days = period === "week" ? 7 : period === "month" ? 30 : 90;
    const since = new Date(Date.now() - days * 86400_000);
    const periodLabel =
      period === "week" ? "Hebdomadaire" : period === "month" ? "Mensuel" : "Trimestriel";

    // ---- Plan (phases / tasks / subtasks) ----
    const { data: phases } = await supabase
      .from("phases")
      .select("id, name, sort_order")
      .eq("project_id", projectId)
      .order("sort_order");
    const phaseIds = (phases ?? []).map((p: any) => p.id);

    let tasks: any[] = [];
    let subtasks: any[] = [];
    if (phaseIds.length) {
      const { data: t } = await supabase
        .from("tasks")
        .select("id, phase_id, title, priority, status, duration_hours, optional, updated_at")
        .in("phase_id", phaseIds);
      tasks = t ?? [];
      if (tasks.length) {
        const { data: st } = await supabase
          .from("subtasks")
          .select("id, task_id, title, status, duration_hours")
          .in("task_id", tasks.map((x: any) => x.id));
        subtasks = st ?? [];
      }
    }

    const done = tasks.filter((t) => t.status === "done");
    const inProgress = tasks.filter((t) => t.status === "in_progress");
    const todo = tasks.filter((t) => t.status !== "done" && t.status !== "in_progress");
    const doneRecent = done.filter((t) => new Date(t.updated_at) >= since);
    const totalHours = tasks.reduce((s, t) => s + Number(t.duration_hours || 0), 0);
    const doneHours = done.reduce((s, t) => s + Number(t.duration_hours || 0), 0);
    const p0Open = tasks.filter((t) => t.priority === "P0" && t.status !== "done");

    const phaseSummary = (phases ?? []).map((ph: any) => {
      const pt = tasks.filter((t) => t.phase_id === ph.id);
      const pd = pt.filter((t) => t.status === "done").length;
      return `- ${ph.name} : ${pd}/${pt.length} tâches terminées`;
    });

    // ---- Budget ----
    const { data: budgets } = await supabase
      .from("budgets")
      .select("id, title, horizon_months")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(1);
    let budgetBlock = "Aucun budget prévisionnel lié à ce projet.";
    let budgetMeta: any = null;
    let budgetMonthly: { month: string; revenue: number; charges: number; net: number; cumulNet: number }[] = [];
    if (budgets?.length) {
      const { data: lines } = await supabase
        .from("budget_lines")
        .select("category, subcategory, label, monthly_values, is_total")
        .eq("budget_id", budgets[0].id);
      const real = (lines ?? []).filter((l: any) => !l.is_total);
      const sum = (cat: string) =>
        real
          .filter((l: any) => l.category === cat)
          .reduce(
            (s: number, l: any) =>
              s + (Array.isArray(l.monthly_values) ? l.monthly_values.reduce((a: number, b: number) => a + Number(b || 0), 0) : 0),
            0,
          );
      const revenue = sum("revenue");
      const fixed = Math.abs(sum("fixed_charges"));
      const variable = Math.abs(sum("variable_charges"));
      const invest = Math.abs(sum("investments"));
      const grossMargin = revenue - variable;
      const ebitda = grossMargin - fixed;
      budgetMeta = { revenue, fixed, variable, invest, grossMargin, ebitda, horizon: budgets[0].horizon_months, lines: real.length };

      // Monthly series (revenue vs charges) for the écarts chart
      const horizon = Number(budgets[0].horizon_months || 12);
      const monthSum = (cats: string[], i: number) =>
        real
          .filter((l: any) => cats.includes(l.category))
          .reduce((s: number, l: any) => s + Number(Array.isArray(l.monthly_values) ? l.monthly_values[i] || 0 : 0), 0);
      let cumul = 0;
      budgetMonthly = Array.from({ length: Math.min(horizon, 36) }, (_, i) => {
        const rev = monthSum(["revenue"], i);
        const ch = Math.abs(monthSum(["fixed_charges", "variable_charges", "investments"], i));
        const net = rev - ch;
        cumul += net;
        return { month: `M${i + 1}`, revenue: Math.round(rev), charges: Math.round(ch), net: Math.round(net), cumulNet: Math.round(cumul) };
      });

      budgetBlock = [
        `Budget "${budgets[0].title}" — horizon ${budgets[0].horizon_months} mois, ${real.length} lignes.`,
        `Revenus cumulés : ${euro(revenue)}`,
        `Charges variables : ${euro(variable)}`,
        `Charges fixes : ${euro(fixed)}`,
        `Investissements : ${euro(invest)}`,
        `Marge brute : ${euro(grossMargin)}`,
        `EBITDA prévisionnel : ${euro(ebitda)}`,
      ].join("\n");
    }

    // ---- Strategic docs presence ----
    const [{ data: bps }, { data: bms }] = await Promise.all([
      supabase.from("business_plans").select("id, title, updated_at").eq("project_id", projectId).limit(1),
      supabase.from("business_models").select("id, title, framework, updated_at").eq("project_id", projectId).limit(1),
    ]);
    let bpSectionsCount = 0;
    if (bps?.length) {
      const { data: secs } = await supabase
        .from("business_plan_sections")
        .select("id, content")
        .eq("business_plan_id", bps[0].id);
      bpSectionsCount = (secs ?? []).filter((s: any) => (s.content || "").trim().length > 40).length;
    }
    let bmBlocksCount = 0;
    if (bms?.length) {
      const { data: blocks } = await supabase
        .from("business_model_blocks")
        .select("id, content")
        .eq("business_model_id", bms[0].id);
      bmBlocksCount = (blocks ?? []).filter((b: any) => (b.content || "").trim().length > 40).length;
    }

    // ---- Calendar (upcoming) ----
    const nowIso = new Date().toISOString();
    const horizonIso = new Date(Date.now() + days * 86400_000).toISOString();
    const { data: events } = await supabase
      .from("calendar_events")
      .select("title, start_time")
      .eq("project_id", projectId)
      .gte("start_time", nowIso)
      .lte("start_time", horizonIso)
      .order("start_time")
      .limit(20);

    const assumptions = (project as any).business_assumptions ?? null;
    const activeScenario = (project as any).active_scenario ?? "base";

    const contextParts = [
      `PROJET : ${project.title} [${project.status}] — avancement déclaré ${project.completion_percent}%`,
      project.description ? `Description : ${String(project.description).substring(0, 800)}` : "",
      project.deadline ? `Échéance : ${project.deadline}` : "Échéance : non renseignée",
      `Capacité : ${project.hours_per_week} h/semaine, jours ${(project.days_per_week || []).join(", ")}`,
      `Scénario d'hypothèses actif : ${activeScenario}`,
      assumptions ? `Hypothèses business : ${JSON.stringify(assumptions).substring(0, 1500)}` : "",
      "",
      `PÉRIODE ANALYSÉE : ${periodLabel} (derniers ${days} jours, depuis le ${since.toLocaleDateString("fr-FR")})`,
      "",
      `PLAN D'ACTION : ${phases?.length ?? 0} phases, ${tasks.length} tâches, ${subtasks.length} sous-tâches.`,
      `Terminées : ${done.length} (dont ${doneRecent.length} sur la période) | En cours : ${inProgress.length} | À faire : ${todo.length}`,
      `Charge : ${doneHours} h réalisées sur ${totalHours} h planifiées`,
      `Tâches P0 critiques encore ouvertes : ${p0Open.length}${p0Open.length ? " → " + p0Open.slice(0, 8).map((t) => t.title).join(" ; ") : ""}`,
      phaseSummary.length ? "Avancement par phase :\n" + phaseSummary.join("\n") : "",
      doneRecent.length ? "Terminé sur la période :\n" + doneRecent.slice(0, 15).map((t) => `- ${t.title}`).join("\n") : "Aucune tâche terminée sur la période.",
      inProgress.length ? "En cours :\n" + inProgress.slice(0, 15).map((t) => `- [${t.priority}] ${t.title} (${t.duration_hours}h)`).join("\n") : "",
      "",
      `BUDGET PRÉVISIONNEL :\n${budgetBlock}`,
      "",
      `DOCUMENTS STRATÉGIQUES : Business Plan ${bps?.length ? `"${bps[0].title}" (${bpSectionsCount} sections renseignées)` : "absent"} | Business Model ${bms?.length ? `"${bms[0].title}" (${bmBlocksCount} blocs renseignés)` : "absent"}`,
      "",
      events?.length
        ? `ÉCHÉANCES À VENIR (${days} j) :\n` + events.map((e: any) => `- ${new Date(e.start_time).toLocaleString("fr-FR")} — ${e.title}`).join("\n")
        : `Aucune échéance planifiée dans les ${days} prochains jours.`,
    ].filter(Boolean);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Rédige le rapport d'avancement ${periodLabel.toLowerCase()} de ce projet à partir des données suivantes :\n\n${contextParts.join("\n")}`,
      },
    ];

    let raw = "";
    let engine = "deepseek";
    try {
      raw = await callDeepSeek(messages);
    } catch (e) {
      console.error("DeepSeek failed, fallback to Lovable AI:", e);
      engine = "lovable-gemini";
      raw = await callLovable(messages);
    }

    let report: any;
    try {
      report = parseJson(raw);
    } catch (e) {
      console.error("Report JSON parse error:", e, raw.substring(0, 500));
      return new Response(JSON.stringify({ error: "Réponse IA illisible, réessayez." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Chart series : tendance d'avancement + burndown ----
    const dayKeys = Array.from({ length: days }, (_, i) => {
      const d = new Date(since.getTime() + (i + 1) * 86400_000);
      return d;
    });
    const doneBefore = done.filter((t) => new Date(t.updated_at) < since);
    const baseDone = doneBefore.length;
    const baseHours = doneBefore.reduce((s, t) => s + Number(t.duration_hours || 0), 0);
    const dailyIdeal = days > 0 ? (tasks.length - baseDone) / days : 0;
    const dailyIdealHours = days > 0 ? (totalHours - baseHours) / days : 0;

    const progressTrend = dayKeys.map((d, i) => {
      const upTo = done.filter((t) => new Date(t.updated_at) <= d);
      const cumulTasks = upTo.length;
      const cumulHours = upTo.reduce((s, t) => s + Number(t.duration_hours || 0), 0);
      return {
        date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        doneCumul: cumulTasks,
        percent: tasks.length ? Math.round((cumulTasks / tasks.length) * 100) : 0,
        target: Math.round(baseDone + dailyIdeal * (i + 1)),
        remainingHours: Math.max(0, Math.round(totalHours - cumulHours)),
        idealHours: Math.max(0, Math.round(totalHours - (baseHours + dailyIdealHours * (i + 1)))),
      };
    });

    const phaseProgress = (phases ?? []).map((ph: any) => {
      const pt = tasks.filter((t) => t.phase_id === ph.id);
      return {
        name: String(ph.name).length > 22 ? String(ph.name).slice(0, 21) + "…" : String(ph.name),
        done: pt.filter((t) => t.status === "done").length,
        inProgress: pt.filter((t) => t.status === "in_progress").length,
        todo: pt.filter((t) => t.status !== "done" && t.status !== "in_progress").length,
      };
    });

    const payload = {
      engine,
      generated_at: new Date().toISOString(),
      period,
      period_label: periodLabel,
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        completion_percent: project.completion_percent,
        deadline: project.deadline,
      },
      stats: {
        phases: phases?.length ?? 0,
        tasks: tasks.length,
        done: done.length,
        doneRecent: doneRecent.length,
        inProgress: inProgress.length,
        todo: todo.length,
        p0Open: p0Open.length,
        totalHours,
        doneHours,
        upcomingEvents: events?.length ?? 0,
        bpSections: bpSectionsCount,
        bmBlocks: bmBlocksCount,
      },
      budget: budgetMeta,
      report,
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-progress-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
