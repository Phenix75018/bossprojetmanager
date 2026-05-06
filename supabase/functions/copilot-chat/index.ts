import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es "Boss Copilot", l'assistant IA contextuel intégré à l'application Boss Project Manager.
Tu aides l'utilisateur à piloter ses projets, plans d'action, budgets prévisionnels, business plans, business models et calendrier.

RÈGLES :
- Réponds en français, ton concis, professionnel et chaleureux.
- Tu as accès au CONTEXTE LIVE de l'utilisateur (projets, tâches, budget, événements à venir) — utilise-le toujours.
- Si on te demande quelque chose hors contexte, réponds quand même utilement.
- Quand pertinent, propose 1 à 3 ACTIONS concrètes formatées en JSON à la fin sous la balise <ACTIONS>...</ACTIONS> :
  [{"label":"Texte du bouton","type":"navigate|info","payload":"/route ou texte"}]
- Pas d'invention de chiffres : si une donnée n'est pas dans le contexte, dis-le.
- Format markdown autorisé pour la lisibilité (titres ##, listes, gras).`;

async function callDeepSeek(messages: any[]): Promise<string> {
  const key = Deno.env.get("DEEPSEEK_API_KEY");
  if (!key) throw new Error("DEEPSEEK_API_KEY missing");
  const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "deepseek-chat", messages, temperature: 0.6, max_tokens: 1500 }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`DeepSeek ${r.status}: ${t}`);
  }
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callLovableAI(messages: any[]): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
  });
  if (!r.ok) {
    if (r.status === 429) throw new Error("RATE_LIMIT");
    if (r.status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error(`LovableAI ${r.status}`);
  }
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function buildContext(supabase: any, userId: string, route: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    const { data: projects } = await supabase
      .from("projects")
      .select("id,title,status,completion_percent,deadline,project_type")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(10);
    if (projects?.length) {
      parts.push("PROJETS:\n" + projects.map((p: any) =>
        `- ${p.title} [${p.status}] ${p.completion_percent}%${p.deadline ? ` (échéance ${p.deadline})` : ""}`
      ).join("\n"));
    }

    // Tasks for the most recent project
    if (projects?.[0]) {
      const { data: phases } = await supabase.from("phases").select("id").eq("project_id", projects[0].id);
      const phaseIds = (phases ?? []).map((p: any) => p.id);
      if (phaseIds.length) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("title,priority,status,duration_hours")
          .in("phase_id", phaseIds)
          .neq("status", "done")
          .limit(15);
        if (tasks?.length) {
          parts.push(`TÂCHES EN COURS (projet "${projects[0].title}"):\n` +
            tasks.map((t: any) => `- [${t.priority}] ${t.title} (${t.duration_hours}h, ${t.status})`).join("\n"));
        }
      }
    }

    const now = new Date().toISOString();
    const in7 = new Date(Date.now() + 7 * 86400_000).toISOString();
    const { data: events } = await supabase
      .from("calendar_events")
      .select("title,start_time,end_time")
      .eq("user_id", userId)
      .gte("start_time", now)
      .lte("start_time", in7)
      .order("start_time")
      .limit(10);
    if (events?.length) {
      parts.push("ÉVÉNEMENTS À VENIR (7j):\n" +
        events.map((e: any) => `- ${new Date(e.start_time).toLocaleString("fr-FR")} — ${e.title}`).join("\n"));
    }

    const { data: budgets } = await supabase
      .from("budgets")
      .select("id,title,horizon_months")
      .eq("user_id", userId)
      .limit(3);
    if (budgets?.length) {
      parts.push("BUDGETS:\n" + budgets.map((b: any) => `- ${b.title} (${b.horizon_months} mois)`).join("\n"));
    }

    if (route) parts.push(`PAGE ACTUELLE: ${route}`);
  } catch (e) {
    console.error("buildContext error:", e);
  }
  return parts.join("\n\n") || "Aucune donnée utilisateur disponible.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { messages, route } = body as { messages: { role: string; content: string }[]; route?: string };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const context = await buildContext(supabase, userId, route ?? null);
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `CONTEXTE UTILISATEUR LIVE:\n${context}` },
      ...messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    ];

    let content = "";
    let provider = "deepseek";
    try {
      content = await callDeepSeek(fullMessages);
    } catch (e) {
      console.warn("DeepSeek failed, falling back:", (e as Error).message);
      provider = "lovable-ai";
      try {
        content = await callLovableAI(fullMessages);
      } catch (e2) {
        const msg = (e2 as Error).message;
        if (msg === "RATE_LIMIT") {
          return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (msg === "PAYMENT_REQUIRED") {
          return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw e2;
      }
    }

    // Extract suggestions
    let suggestions: any[] = [];
    let cleanContent = content;
    const m = content.match(/<ACTIONS>([\s\S]*?)<\/ACTIONS>/);
    if (m) {
      try { suggestions = JSON.parse(m[1].trim()); } catch { /* ignore */ }
      cleanContent = content.replace(/<ACTIONS>[\s\S]*?<\/ACTIONS>/, "").trim();
    }

    return new Response(JSON.stringify({ content: cleanContent, suggestions, provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("copilot-chat error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Erreur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
