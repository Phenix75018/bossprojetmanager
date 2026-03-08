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
    const { role, description, skills, importance, projectDescription } = body;

    // Input validation
    if (!role || typeof role !== "string" || role.length > 200) {
      return new Response(JSON.stringify({ error: "Rôle invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!description || typeof description !== "string" || description.length > 2000) {
      return new Response(JSON.stringify({ error: "Description invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!projectDescription || typeof projectDescription !== "string" || projectDescription.length > 5000) {
      return new Response(JSON.stringify({ error: "Description du projet invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const sanitizedSkills = (skills || []).slice(0, 20).map((s: any) => String(s).substring(0, 100));

    const systemPrompt = `Tu es un expert en développement professionnel et alternatives au recrutement. 
L'utilisateur a un projet professionnel et cherche des alternatives au recrutement d'un profil spécifique.

Tu dois proposer des alternatives concrètes: formations, coaching, outils, freelances, etc.

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, sans texte ni markdown.

Format:
{
  "has_alternatives": true,
  "summary": "Résumé court de la situation (1-2 phrases)",
  "alternatives": [
    {
      "type": "formation",
      "title": "Nom de la formation ou du programme",
      "description": "Description détaillée de l'alternative",
      "duration": "Durée estimée (ex: 3 mois)",
      "estimated_cost": "Coût estimé",
      "pros": ["Avantage 1", "Avantage 2"],
      "cons": ["Inconvénient 1"],
      "feasibility": "haute"
    }
  ],
  "no_alternative_reason": null
}

Types possibles: "formation", "coaching", "outil/logiciel", "freelance", "externalisation", "autoformation"
Niveaux de feasibility: "haute", "moyenne", "faible"

Si aucune alternative viable n'existe, mets has_alternatives à false et explique pourquoi dans no_alternative_reason.
Propose 2-4 alternatives quand c'est possible.`;

    const userPrompt = `Projet: ${projectDescription}

Profil à remplacer: ${role}
Description du rôle: ${description}
Compétences requises: ${sanitizedSkills.join(", ")}
Niveau d'importance: ${importance || "recommandé"}

Propose des alternatives au recrutement de ce profil.`;

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

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("explore-alternatives error:", e);
    return new Response(
      JSON.stringify({ error: "Une erreur est survenue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
