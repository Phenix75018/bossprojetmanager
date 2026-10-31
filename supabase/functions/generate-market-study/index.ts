import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Non autorisé" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: ce } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (ce || !claims?.claims) return json({ error: "Non autorisé" }, 401);

    const body = await req.json();
    const title = s(body.title, 300);
    const description = s(body.description, 8000);
    const section = { title: s(body.section?.title, 200), brief: s(body.section?.brief, 1000) };
    const c = body.config ?? {};
    const previous = Array.isArray(body.previous) ? body.previous.slice(0, 20) : [];
    if (!title || !section.title) return json({ error: "Requête invalide" }, 400);

    const depthWords: Record<string, string> = { standard: "800", approfondie: "1300", experte: "2000" };
    const words = depthWords[c.depth] ?? "1300";
    const lang = c.language === "en" ? "anglais" : "français";

    const system = `Tu es un directeur d'études senior d'un cabinet de conseil en stratégie (niveau McKinsey / Xerfi / Gartner). Tu rédiges des études de marché professionnelles, exhaustives, chiffrées et présentables à des investisseurs, banques et comités de direction, pour N'IMPORTE QUEL secteur.

Tu rédiges UNE SEULE section, en ${lang}, en markdown riche (##, ###, listes, tableaux markdown GFM, **gras** pour les chiffres clés). Minimum ${words} mots.

EXIGENCES :
- Chiffres précis avec unités, année de référence et devise ${s(c.currency, 10) || "EUR"}.
- Citer des sources plausibles et nommées (INSEE, Eurostat, Statista, Xerfi, OCDE, Banque mondiale, fédérations professionnelles, rapports annuels), en indiquant qu'elles sont à vérifier.
- Hypothèses explicites ("Hypothèse : ...") quand une donnée manque ; jamais de chiffre flou.
- Au moins un tableau markdown pertinent.
- Terminer par "### À retenir" (3 à 5 puces actionnables).
- Cohérence stricte avec les sections précédentes (mêmes chiffres, mêmes personas).
- Ne réponds QU'avec le contenu markdown de la section, sans titre de niveau 1 ni texte d'introduction méta.`;

    const user = `ÉTUDE : ${title}
Description du projet / produit : ${description || "(non précisée)"}
Secteur : ${s(c.sector, 200) || "à déduire de la description"}
Zone géographique : ${s(c.geography, 200)}
Cible : ${s(c.targetType, 10)}
Horizon de prévision : ${Number(c.horizonYears) || 5} ans
Niveau de profondeur : ${s(c.depth, 20)}
Public du rapport : ${s(c.audience, 200)}
Concurrents connus : ${s(c.competitors, 1000) || "à identifier"}
Objectifs de l'étude : ${s(c.objectives, 1500) || "évaluer l'attractivité et l'opportunité d'entrée"}
Cadres d'analyse à mobiliser : ${(Array.isArray(c.frameworks) ? c.frameworks : []).join(", ")}

SECTION À RÉDIGER : ${section.title}
Contenu attendu : ${section.brief}

${previous.length ? "SECTIONS DÉJÀ RÉDIGÉES (extraits) :\n" + previous.map((p: any) => `### ${s(p.title, 200)}\n${s(p.content, 900)}`).join("\n\n") : ""}`;

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: c.depth === "experte" ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (r.status === 429) return json({ error: "Trop de requêtes, réessayez dans un moment." }, 429);
    if (r.status === 402) return json({ error: "Crédits IA insuffisants." }, 402);
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
    const data = await r.json();
    let content: string = data.choices?.[0]?.message?.content ?? "";
    content = content.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/, "").trim();
    if (!content) throw new Error("Réponse vide");
    return json({ content });
  } catch (e) {
    console.error("generate-market-study error:", e);
    return json({ error: "Une erreur est survenue lors de la génération" }, 500);
  }
});
