import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { sectionContent, sectionType, projectTitle } = body;

    if (!sectionContent || typeof sectionContent !== "string" || sectionContent.length < 50) {
      return new Response(JSON.stringify({ error: "Le contenu de la section est trop court pour extraire des graphiques" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Tu es un expert en visualisation de données financières. À partir du contenu d'une section de business plan, tu dois extraire les données chiffrées pertinentes et proposer des graphiques.

IMPORTANT: Tu dois répondre UNIQUEMENT avec un JSON valide, sans texte avant ou après.

Format de réponse:
{
  "charts": [
    {
      "chart_type": "bar" ou "pie",
      "title": "Titre du graphique",
      "chart_data": [
        { "name": "Label", "value": 1234, "color": "hsl(210, 70%, 50%)" }
      ]
    }
  ]
}

Règles:
- Génère entre 2 et 5 graphiques pertinents
- Utilise "bar" pour les comparaisons, évolutions, projections temporelles
- Utilise "pie" pour les répartitions et distributions en pourcentage
- Extrais les chiffres réels du contenu quand possible
- Si pas de chiffres explicites, fais des estimations crédibles basées sur le contexte
- Chaque graphique doit avoir 3-8 données
- Utilise des couleurs HSL variées et harmonieuses
- Les titres doivent être clairs et descriptifs
- Pour le plan financier: revenus, dépenses, marges, projections
- Pour l'analyse de marché: parts de marché, segments, tailles
- Pour la stratégie: canaux, investissements, ROI
- Pour les meilleures pratiques: scores, benchmarks, comparaisons`;

    const userPrompt = `Projet: ${projectTitle || "Business Plan"}
Type de section: ${sectionType}
Contenu de la section:
${sectionContent.substring(0, 8000)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erreur du service IA");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    let result;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      result = JSON.parse(jsonStr);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!result?.charts || !Array.isArray(result.charts)) {
      throw new Error("Invalid chart data format");
    }

    // Validate chart data
    const validCharts = result.charts.filter((c: any) =>
      c.chart_type && c.title && Array.isArray(c.chart_data) && c.chart_data.length > 0
    ).map((c: any) => ({
      chart_type: c.chart_type === "pie" ? "pie" : "bar",
      title: String(c.title).substring(0, 200),
      chart_data: c.chart_data.slice(0, 10).map((d: any, i: number) => ({
        name: String(d.name || `Item ${i + 1}`).substring(0, 100),
        value: Math.max(0, Number(d.value) || 0),
        color: typeof d.color === "string" ? d.color : `hsl(${(i * 45) % 360}, 70%, 50%)`,
      })),
    }));

    return new Response(JSON.stringify({ charts: validCharts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-bp-charts error:", e);
    return new Response(
      JSON.stringify({ error: "Erreur lors de la génération des graphiques" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
