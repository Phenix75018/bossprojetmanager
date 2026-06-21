import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Shared ref_type normalization — single source of truth used by both the
// client (src/lib/strategicRefs.ts re-exports) and edge functions.
import { normalizeRefWithFallback } from "../_shared/strategicRefs.ts";

function normalizeRef(
  refType: string | undefined,
  docType: "bp" | "bm",
  refTitle: string | undefined,
  allowed: { ref_type: string; title: string }[],
): string | null {
  return normalizeRefWithFallback(refType, docType, refTitle, allowed);
}

function normalizeJustifications(items: any, bpRefs: { ref_type: string; title: string }[], bmRefs: { ref_type: string; title: string }[]): any[] {
  if (!Array.isArray(items)) return [];
  return items.map((j) => {
    if (typeof j === "string") return { text: j };
    if (!j || typeof j !== "object") return null;
    const text = typeof j.text === "string" ? j.text : "";
    if (!text) return null;
    if (!j.ref || typeof j.ref !== "object") return { text };
    const docType = j.ref.doc_type === "bp" || j.ref.doc_type === "bm" ? j.ref.doc_type : null;
    if (!docType) return { text };
    const allowed = docType === "bp" ? bpRefs : bmRefs;
    const normalized = normalizeRef(j.ref.ref_type, docType, j.ref.ref_title, allowed);
    if (!normalized) return { text };
    const titleFromAllowed = allowed.find((r) => r.ref_type === normalized)?.title;
    return { text, ref: { doc_type: docType, ref_type: normalized, ref_title: j.ref.ref_title || titleFromAllowed || normalized } };
  }).filter(Boolean);
}

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
    const { description, projectType, status, statusDetails, projectId } = body;

    // Fetch BP + BM context for cross-module coherence (optional)
    let strategicContext = "";
    let bpId: string | null = null;
    let bmId: string | null = null;
    const bpRefs: { ref_type: string; title: string }[] = [];
    const bmRefs: { ref_type: string; title: string }[] = [];
    if (projectId && typeof projectId === "string") {
      try {
        const { data: bps } = await supabase
          .from("business_plans")
          .select("id, title")
          .eq("project_id", projectId)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (bps?.length) {
          bpId = bps[0].id;
          const { data: sections } = await supabase
            .from("business_plan_sections")
            .select("section_type, title, content")
            .eq("business_plan_id", bps[0].id)
            .order("sort_order");
          if (sections?.length) {
            sections.forEach((s: any) => bpRefs.push({ ref_type: s.section_type, title: s.title }));
            const summary = sections
              .map((s: any) => `### [ref_type="${s.section_type}"] ${s.title}\n${(s.content || "").substring(0, 800)}`)
              .join("\n\n");
            strategicContext += `\n\n=== Business Plan lié "${bps[0].title}" ===\n${summary}`;
          }
        }
        const { data: bms } = await supabase
          .from("business_models")
          .select("id, title, framework")
          .eq("project_id", projectId)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (bms?.length) {
          bmId = bms[0].id;
          const { data: blocks } = await supabase
            .from("business_model_blocks")
            .select("block_type, title, content")
            .eq("business_model_id", bms[0].id)
            .order("sort_order");
          if (blocks?.length) {
            blocks.forEach((b: any) => bmRefs.push({ ref_type: b.block_type, title: b.title }));
            const summary = blocks
              .map((b: any) => `### [ref_type="${b.block_type}"] ${b.title}\n${(b.content || "").substring(0, 500)}`)
              .join("\n\n");
            strategicContext += `\n\n=== Business Model lié "${bms[0].title}" (${bms[0].framework}) ===\n${summary}`;
          }
        }
        if (strategicContext) {
          strategicContext = `\n\n=== CONTEXTE STRATÉGIQUE ===${strategicContext}\n=== FIN CONTEXTE ===\n\nIMPORTANT: Le plan d'action DOIT être cohérent avec ces documents stratégiques (livrables, jalons, ressources, priorités alignées sur la stratégie et le modèle économique).`;
        }
      } catch (e) {
        console.error("Strategic context error:", e);
      }
    }

    const refsHelp = (bpRefs.length || bmRefs.length)
      ? `\n\nValeurs autorisées pour "ref" dans coherence_justifications :\n` +
        (bpRefs.length ? `- Business Plan (doc_type="bp") ref_type ∈ {${bpRefs.map(r => `"${r.ref_type}"`).join(", ")}}\n` : "") +
        (bmRefs.length ? `- Business Model (doc_type="bm") ref_type ∈ {${bmRefs.map(r => `"${r.ref_type}"`).join(", ")}}` : "")
      : "";

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

    const systemPrompt = `Tu es un Chef de Projet senior certifié (PMP / PRINCE2 / Agile) ayant piloté des programmes de lancement présentés à des comités d'investissement, à BPI France ou à des partenaires stratégiques. Tu produis des plans d'action "investor-ready" : précis, chiffrés, jalonnés, défendables en due diligence opérationnelle.

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
          "description": "Description courte mais précise (livrable attendu + critère d'acceptation)",
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
  "team_recommendations": []` : ""},
  "coherence_justifications": [
    {
      "text": "Phrase courte expliquant comment une priorité, une durée ou un coût d'une tâche découle d'un élément précis du BP/BM.",
      "ref": { "doc_type": "bp" | "bm", "ref_type": "<id de section ou de bloc>", "ref_title": "Titre lisible de la section/bloc" }
    }
  ]
}
${recruitmentBlock}

EXIGENCES DE QUALITÉ — niveau présentation à un financeur ou partenaire :

1. Structure du plan (méthodologie PMI / cycle de vie projet) :
   - 4 à 6 phases clairement séquencées et numérotées (ex. "Phase 1 — Cadrage & étude de faisabilité", "Phase 2 — Conception & MVP", "Phase 3 — Lancement pilote", "Phase 4 — Industrialisation & scale", "Phase 5 — Optimisation & croissance").
   - Chaque phase = un jalon majeur (milestone) avec livrable concret et critère de succès.
   - 3 à 6 tâches par phase, chacune avec un livrable identifiable.
   - 3 à 6 sous-tâches par tâche, chacune actionnable en moins d'une journée.

2. Priorisation rigoureuse (méthode MoSCoW / RICE) :
   - P0 (critique / Must-have) : bloque le projet ou la mise sur le marché, chemin critique.
   - P1 (haute / Should-have) : nécessaire pour la qualité ou le respect du planning.
   - P2 (normale / Could-have) : améliore le résultat sans bloquer.
   - Distribution équilibrée : ~30% P0, ~40% P1, ~30% P2.

3. Estimations de durée réalistes :
   - Basées sur PERT (optimiste + 4×probable + pessimiste) / 6 ou benchmarks sectoriels.
   - Inclure le temps de validation, de revue et de retravail (buffer ~20%).
   - Tâches macro : 4-40h. Sous-tâches : 1-8h. Pas de tâche > 40h sans découpage.
   - Total cohérent avec la phase (somme des tâches ≈ durée de la phase).

4. Précision des libellés et descriptions :
   - Titres orientés action et résultat ("Rédiger le cahier des charges fonctionnel V1" plutôt que "Spécifications").
   - Description = livrable attendu + critère d'acceptation ("Document validé par le sponsor, incluant les 12 user stories prioritaires").
   - Mentionner les dépendances implicites entre phases.

5. Adaptation au contexte :
   - Adapter la nature et la profondeur des phases au secteur (SaaS, retail, industrie, service, association).
   - Adapter au niveau d'avancement déclaré (idée / prototype / MVP / lancement / scale) : ne pas refaire des étapes déjà accomplies.
   - Intégrer les contraintes réglementaires sectorielles si pertinent (RGPD, CNIL, normes ISO, agréments, BPI).

6. Cohérence stratégique (si BP/BM fournis) :
   - Les phases reflètent la roadmap commerciale du BP.
   - Les priorités P0 correspondent aux activités clés du BM et aux jalons du plan financier (point mort, levée de fonds).
   - "coherence_justifications" : 5 à 10 objets précis liant priorités/durées/jalons à des sections BP ou blocs BM existants. Chaque objet DOIT contenir un "ref" valide. Si aucun BP/BM fourni, retourne [].${refsHelp}

7. ${isProfessional ? "Recommandations d'équipe (PROFESSIONNEL) : profils chiffrés en coût mensuel marché, justification du niveau de séniorité, articulation interne/externe (freelance, prestataire, salarié), 3 à 6 profils." : "Projet PERSONNEL : pas de recommandations d'équipe."}

Type de projet: ${isProfessional ? "PROFESSIONNEL - inclure les recommandations d'équipe" : "PERSONNEL - pas de recommandations d'équipe"}`;

    const userPrompt = `Projet: ${description}
Type: ${isProfessional ? "Professionnel" : "Personnel"}
État d'avancement: ${status || "nouveau"}${statusDetails ? `\nDétails: ${statusDetails}` : ""}${strategicContext}`;

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

    if (plan && Array.isArray(plan.coherence_justifications)) {
      plan.coherence_justifications = normalizeJustifications(plan.coherence_justifications, bpRefs, bmRefs);
    }

    return new Response(JSON.stringify({ plan, bp_id: bpId, bm_id: bmId }), {
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
