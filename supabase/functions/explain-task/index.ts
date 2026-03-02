import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { taskTitle, taskDescription, subtasks, projectDescription, phaseName, isSubtask } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const subtasksList = (subtasks || []).map((s: any) => `- ${s.title} (${s.duration_hours}h)`).join("\n");

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
        messages: [
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, veuillez réessayer dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants. Veuillez recharger votre compte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
      throw new Error("Erreur du service IA");
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content || "Aucune explication générée.";

    return new Response(JSON.stringify({ explanation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("explain-task error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
