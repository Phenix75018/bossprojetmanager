import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth validation
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
    const { description, projectType, status, statusDetails } = body;

    // Input validation
    if (!description || typeof description !== "string" || description.length > 10000) {
      return new Response(JSON.stringify({ error: "Description invalide (max 10000 caractères)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (projectType && !["personal", "professional"].includes(projectType)) {
      return new Response(JSON.stringify({ error: "Type de projet invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (statusDetails && (typeof statusDetails !== "string" || statusDetails.length > 5000)) {
      return new Response(JSON.stringify({ error: "Détails de statut trop longs" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isProfessional = projectType === "professional";

    const recruitmentBlock = isProfessional
      ? `
IMPORTANT - Pour les projets professionnels, tu dois AUSSI inclure une section "team_recommendations" dans le JSON.
Cette section liste les profils à recruter pour le projet.

Format de "team_recommendations":
"team_recommendations": [
  {
    "role": "Développeur Backend Senior",
    "description": "Expert en architecture serveur et APIs REST/GraphQL",
    "importance": "nécessaire",
    "skills": ["Node.js", "PostgreSQL", "Architecture microservices"],
    "estimated_monthly_cost": "4000-6000€"
  }
]

Niveaux d'importance:
- "nécessaire": Le projet ne peut pas aboutir sans ce profil
- "fortement recommandé": Le projet peut avancer mais avec des risques significatifs sans ce profil
- "recommandé": Ce profil améliorerait la qualité et la vitesse du projet

Inclus 2-6 profils selon la complexité du projet.`
      : "";

    const systemPrompt = `Tu es un expert en gestion de projet. L'utilisateur te décrit son projet et tu dois générer un plan d'action structuré.

IMPORTANT: Tu dois répondre UNIQUEMENT avec un JSON valide, sans aucun texte avant ou après. Pas de markdown, pas de backticks.

Le format JSON doit être exactement:
{
  "title": "Titre court du projet (max 60 caractères)",
  "phases": [
    {
      "name": "Phase 1 — Nom de la phase",
      "tasks": [
        {
          "title": "Titre de la tâche",
          "description": "Description courte",
          "priority": "P0",
          "duration_hours": 8,
          "subtasks": [
            { "title": "Sous-tâche 1", "duration_hours": 2 },
            { "title": "Sous-tâche 2", "duration_hours": 2 }
          ]
        }
      ]
    }
  ]${isProfessional ? `,
  "team_recommendations": []` : ""}
}
${recruitmentBlock}

Règles:
- Génère 3-5 phases
- 2-4 tâches par phase  
- 2-5 sous-tâches par tâche
- Priorités: P0 (critique), P1 (haute), P2 (normale)
- Durées réalistes en heures
- Adapte le plan au niveau d'avancement du projet
- Les noms de phases doivent être numérotés (Phase 1, Phase 2, etc.)
- Type de projet: ${isProfessional ? "PROFESSIONNEL - inclure les recommandations d'équipe" : "PERSONNEL - pas de recommandations d'équipe"}`;

    const userPrompt = `Projet: ${description}
Type: ${isProfessional ? "Professionnel" : "Personnel"}
État d'avancement: ${status || "nouveau"}${statusDetails ? `\nDétails: ${statusDetails}` : ""}`;

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

    let plan;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      plan = JSON.parse(jsonStr);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(JSON.stringify({ plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-plan error:", e);
    return new Response(
      JSON.stringify({ error: "Une erreur est survenue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
