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
    const { taskTitle, taskDescription, subtasks, projectDescription, phaseName, isSubtask } = body;

    // Input validation
    if (!taskTitle || typeof taskTitle !== "string" || taskTitle.length > 500) {
      return new Response(JSON.stringify({ error: "Titre de tâche invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (taskDescription && (typeof taskDescription !== "string" || taskDescription.length > 2000)) {
      return new Response(JSON.stringify({ error: "Description trop longue" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!projectDescription || typeof projectDescription !== "string" || projectDescription.length > 5000) {
      return new Response(JSON.stringify({ error: "Description du projet invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!phaseName || typeof phaseName !== "string" || phaseName.length > 200) {
      return new Response(JSON.stringify({ error: "Nom de phase invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const subtasksList = (subtasks || []).slice(0, 20).map((s: any) => `- ${String(s.title || "").substring(0, 200)} (${Number(s.duration_hours) || 0}h)`).join("\n");

    const prompt = isSubtask
      ? `Tu es un coach de projet expert. Explique en détail comment réaliser cette sous-tâche.

Contexte du projet : ${projectDescription}
Phase : ${phaseName}
Sous-tâche : "${taskTitle}"

Fournis une explication détaillée et actionnable :
1. **Objectif** : Ce que cette sous-tâche doit accomplir
2. **Étapes concrètes** : Les étapes précises à suivre (3-6 étapes)
3. **Outils & ressources** : Outils, logiciels ou ressources recommandés
4. **Conseils pratiques** : Astuces pour bien réaliser cette sous-tâche
5. **Critères de réussite** : Comment savoir que c'est bien fait

Réponds en français, de manière claire et structurée en utilisant du markdown.`
      : `Tu es un coach de projet expert. Explique en détail comment réaliser cette tâche.

Contexte du projet : ${projectDescription}
Phase : ${phaseName}
Tâche : "${taskTitle}"
${taskDescription ? `Description : ${taskDescription}` : ""}
${subtasksList ? `Sous-tâches :\n${subtasksList}` : ""}

Fournis une explication détaillée et actionnable :
1. **Objectif** : Ce que cette tâche doit accomplir
2. **Approche recommandée** : La méthodologie ou l'approche à suivre
3. **Étapes concrètes** : Les étapes précises à suivre (5-8 étapes)
4. **Outils & ressources** : Outils, logiciels ou ressources recommandés
5. **Conseils pratiques** : Astuces et bonnes pratiques
6. **Pièges à éviter** : Erreurs courantes à ne pas commettre
7. **Critères de réussite** : Comment savoir que la tâche est bien réalisée

Réponds en français, de manière claire et structurée en utilisant du markdown.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, veuillez réessayer dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants. Veuillez recharger votre compte." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erreur du service IA");
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content || "Aucune explication générée.";

    return new Response(JSON.stringify({ explanation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("explain-task error:", e);
    return new Response(JSON.stringify({ error: "Une erreur est survenue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
