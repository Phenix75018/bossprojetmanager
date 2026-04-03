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
    const { projectDescription, projectTitle, sectionType, mode, existingSections } = body;

    if (!projectDescription || typeof projectDescription !== "string" || projectDescription.length > 15000) {
      return new Response(JSON.stringify({ error: "Description invalide (max 15000 caractères)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const allSections = [
      { type: "executive_summary", title: "Résumé exécutif", description: "Pitch, mission, vision, proposition de valeur unique" },
      { type: "market_analysis", title: "Analyse de marché", description: "Marché cible, segmentation, taille du marché (TAM/SAM/SOM), tendances, analyse SWOT, concurrence" },
      { type: "business_strategy", title: "Stratégie commerciale", description: "Modèle économique, pricing, canaux de distribution, stratégie marketing, partenariats" },
      { type: "financial_plan", title: "Plan financier", description: "Prévisions revenus/dépenses sur 3-5 ans, seuil de rentabilité, besoins de financement, indicateurs clés" },
      { type: "best_practices", title: "Meilleures pratiques du secteur", description: "Benchmarks, standards, facteurs clés de succès, pièges à éviter, recommandations" },
    ];

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "full") {
      systemPrompt = `Tu es un expert en création de business plans professionnels. L'utilisateur te décrit son projet et tu dois générer un business plan complet et détaillé.

IMPORTANT: Tu dois répondre UNIQUEMENT avec un JSON valide, sans aucun texte avant ou après.

Le format JSON doit être:
{
  "sections": [
    {
      "type": "executive_summary",
      "title": "Résumé exécutif",
      "content": "Contenu détaillé en markdown..."
    },
    {
      "type": "market_analysis",
      "title": "Analyse de marché",
      "content": "Contenu détaillé en markdown..."
    },
    {
      "type": "business_strategy",
      "title": "Stratégie commerciale",
      "content": "Contenu détaillé en markdown..."
    },
    {
      "type": "financial_plan",
      "title": "Plan financier",
      "content": "Contenu détaillé en markdown avec tableaux..."
    },
    {
      "type": "best_practices",
      "title": "Meilleures pratiques du secteur",
      "content": "Contenu détaillé en markdown..."
    }
  ]
}

Règles:
- Chaque section doit faire au minimum 500 mots
- Utilise du markdown riche : titres, sous-titres, listes, tableaux, gras, italique
- Le plan financier doit contenir des tableaux de projections chiffrées
- L'analyse de marché doit inclure une matrice SWOT en tableau
- Sois très professionnel, structuré et détaillé
- Utilise des données réalistes et des estimations crédibles
- Adapte le contenu au secteur d'activité du projet`;

      userPrompt = `Projet: ${projectTitle || "Sans titre"}
Description: ${projectDescription}`;
    } else {
      const sectionInfo = allSections.find(s => s.type === sectionType);
      if (!sectionInfo) {
        return new Response(JSON.stringify({ error: "Type de section invalide" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const existingContext = existingSections && existingSections.length > 0
        ? `\n\nContexte - Sections déjà rédigées:\n${existingSections.map((s: any) => `### ${s.title}\n${s.content?.substring(0, 500)}...`).join("\n\n")}`
        : "";

      systemPrompt = `Tu es un expert en création de business plans professionnels. Tu dois générer UNE SEULE section spécifique d'un business plan.

IMPORTANT: Tu dois répondre UNIQUEMENT avec un JSON valide:
{
  "title": "${sectionInfo.title}",
  "content": "Contenu détaillé en markdown..."
}

Section à générer: ${sectionInfo.title}
Ce qu'elle doit contenir: ${sectionInfo.description}

Règles:
- La section doit faire au minimum 500 mots
- Utilise du markdown riche : titres, sous-titres, listes, tableaux, gras, italique
- Sois très professionnel, structuré et détaillé
- Si c'est le plan financier, inclus des tableaux de projections
- Si c'est l'analyse de marché, inclus une matrice SWOT
- Utilise des données réalistes`;

      userPrompt = `Projet: ${projectTitle || "Sans titre"}
Description: ${projectDescription}${existingContext}`;
    }

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
        return new Response(JSON.stringify({ error: "Trop de requêtes, veuillez réessayer dans un moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-business-plan error:", e);
    return new Response(
      JSON.stringify({ error: "Une erreur est survenue lors de la génération" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
