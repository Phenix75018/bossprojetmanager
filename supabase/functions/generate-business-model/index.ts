import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchAssumptions,
  formatAssumptionsBlock,
  mergeAssumptions,
  type BusinessAssumptions,
} from "../_shared/businessAssumptions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BMC_BLOCKS = [
  { type: "key_partners", title: "Partenaires clés", desc: "Fournisseurs, alliances stratégiques, réseaux" },
  { type: "key_activities", title: "Activités clés", desc: "Actions essentielles pour créer et délivrer la valeur" },
  { type: "key_resources", title: "Ressources clés", desc: "Actifs nécessaires (humains, financiers, physiques, intellectuels)" },
  { type: "value_propositions", title: "Propositions de valeur", desc: "Problèmes résolus, besoins satisfaits, valeur unique" },
  { type: "customer_relationships", title: "Relations clients", desc: "Types de relations établies avec chaque segment" },
  { type: "channels", title: "Canaux", desc: "Comment atteindre et communiquer avec les clients" },
  { type: "customer_segments", title: "Segments de clientèle", desc: "Groupes ciblés, personas, marchés" },
  { type: "cost_structure", title: "Structure des coûts", desc: "Coûts fixes, variables, économies d'échelle" },
  { type: "revenue_streams", title: "Sources de revenus", desc: "Modèle de monétisation, pricing, flux financiers" },
];

const LEAN_BLOCKS = [
  { type: "problem", title: "Problème", desc: "Les 3 problèmes principaux que vous résolvez" },
  { type: "solution", title: "Solution", desc: "Les 3 fonctionnalités clés de votre solution" },
  { type: "unique_value", title: "Proposition de valeur unique", desc: "Message clair et convaincant, différenciateur" },
  { type: "unfair_advantage", title: "Avantage compétitif", desc: "Ce qui ne peut pas être copié ou acheté facilement" },
  { type: "customer_segments", title: "Segments de clientèle", desc: "Utilisateurs cibles, early adopters" },
  { type: "key_metrics", title: "Métriques clés", desc: "KPIs, indicateurs de succès mesurables" },
  { type: "channels", title: "Canaux", desc: "Moyens d'atteindre vos clients" },
  { type: "cost_structure", title: "Structure des coûts", desc: "Coûts d'acquisition, distribution, hébergement, personnel" },
  { type: "revenue_streams", title: "Sources de revenus", desc: "Modèle de revenus, valeur à vie, marge" },
];

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
    const { projectDescription, projectTitle, framework, blockType, mode, existingBlocks, projectId, assumptions: bodyAssumptions } = body;

    const dbAssumptions = await fetchAssumptions(authHeader, projectId);
    const assumptions: BusinessAssumptions | null = mergeAssumptions(
      bodyAssumptions as BusinessAssumptions | undefined,
      dbAssumptions,
    );
    const assumptionsBlock = formatAssumptionsBlock(assumptions);

    // Fetch linked Business Plan for cross-module coherence
    let bpContext = "";
    if (projectId) {
      try {
        const { data: bps } = await supabase
          .from("business_plans")
          .select("id, title")
          .eq("project_id", projectId)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (bps?.length) {
          const { data: sections } = await supabase
            .from("business_plan_sections")
            .select("title, content")
            .eq("business_plan_id", bps[0].id)
            .order("sort_order");
          if (sections?.length) {
            const summary = sections
              .map((s: { title: string; content: string }) => `### ${s.title}\n${(s.content || "").substring(0, 1000)}`)
              .join("\n\n");
            bpContext = `\n\n=== CONTEXTE — Business Plan lié "${bps[0].title}" ===\n${summary}\n=== FIN CONTEXTE ===\n\nIMPORTANT: Ton business model DOIT être cohérent avec ce business plan (proposition de valeur, segments, modèle économique).`;
          }
        }
      } catch (e) {
        console.error("BP context error:", e);
      }
    }

    if (!projectDescription || typeof projectDescription !== "string" || projectDescription.length > 15000) {
      return new Response(JSON.stringify({ error: "Description invalide (max 15000 caractères)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!framework || !["bmc", "lean"].includes(framework)) {
      return new Response(JSON.stringify({ error: "Framework invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const blocks = framework === "bmc" ? BMC_BLOCKS : LEAN_BLOCKS;
    const frameworkName = framework === "bmc" ? "Business Model Canvas (Osterwalder)" : "Lean Canvas (Ash Maurya)";

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "full") {
      const blockList = blocks.map(b => `- "${b.type}": ${b.title} (${b.desc})`).join("\n");
      systemPrompt = `Tu es un consultant senior en stratégie et modélisation d'affaires (formé à la méthode Osterwalder & Pigneur / Ash Maurya), spécialisé dans la préparation de dossiers présentés à des investisseurs (VCs, business angels, BPI) ou des partenaires stratégiques. Tu utilises le framework ${frameworkName} avec une rigueur "investor-ready".

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide.

Format:
{
  "blocks": [
${blocks.map(b => `    { "type": "${b.type}", "title": "${b.title}", "content": "Contenu détaillé en markdown..." }`).join(",\n")}
  ]
}

Blocs à remplir:
${blockList}

EXIGENCES DE QUALITÉ — niveau présentation à un financeur ou partenaire :
- Chaque bloc : 250-450 mots, ton professionnel, factuel, sans jargon creux.
- Markdown structuré : ###, listes à puces, gras pour les chiffres et noms propres, tableaux quand pertinent.
- Concret, spécifique au secteur et à la géographie du projet — pas de réponses génériques applicables à n'importe quelle entreprise.
- Pour chaque affirmation quantitative, donner une hypothèse explicite ("Hypothèse : ...") ou citer un benchmark sectoriel plausible (Xerfi, INSEE, Statista, études sectorielles).
- Mentionner explicitement les risques, limites ou points de validation à tester (logique Lean Startup : "à valider via interview client / MVP / A-B test").

EXIGENCES SPÉCIFIQUES PAR BLOC :
- Segments de clientèle : 2-3 personas nommés avec démographie, douleurs, jobs-to-be-done, budget, parcours d'achat, taille du segment estimée.
- Propositions de valeur : 1 phrase UVP claire, puis gains/soulagements/produits-services (canevas Value Proposition Canvas), différenciation face à 2-3 concurrents nommés.
- Canaux : étapes AIDA (sensibilisation → évaluation → achat → livraison → après-vente), CAC estimé par canal, ratio acquis/payé.
- Relations clients : type (self-service, communauté, co-création...), outils (CRM, support), NPS/CSAT cible.
- Sources de revenus : modèle (transactionnel, récurrent, freemium, licence...), pricing chiffré, prévision de mix revenus à 24 mois, LTV par segment, ratio LTV/CAC cible.
- Ressources clés : humaines (rôles, ETP), techniques (stack, IP, brevets), financières (montant à lever, runway visé), partenariales.
- Activités clés : top 5 activités critiques avec niveau de criticité, internalisation vs externalisation.
- Partenaires clés : 3-6 partenaires nommés ou typés, nature de l'accord, contrepartie échangée, risque de dépendance.
- Structure des coûts : split fixe/variable en %, top 5 postes chiffrés, économies d'échelle attendues, point mort en CA et en mois.

Si Lean Canvas :
- Problème : 3 problèmes hiérarchisés + alternatives existantes utilisées par les clients aujourd'hui.
- Solution : 3 features clés mappées 1:1 aux problèmes.
- Métriques clés : 3-5 KPIs AARRR (Acquisition, Activation, Rétention, Revenu, Recommandation) avec valeurs cibles.
- Avantage déloyal : ce qui ne peut pas être copié à court terme (effet réseau, IP, accès exclusif, équipe).

CONTRAINTES DE COHÉRENCE :
- Les chiffres (pricing, CAC, LTV, coûts) doivent être cohérents entre tous les blocs.
- Si un business plan est fourni en contexte, aligner segments, UVP et modèle économique avec celui-ci.
- Adapter devise, marché et réglementation au pays du projet.`;

      userPrompt = `Projet: ${projectTitle || "Sans titre"}\nDescription: ${projectDescription}${assumptionsBlock}${bpContext}`;
    } else {
      const blockInfo = blocks.find(b => b.type === blockType);
      if (!blockInfo) {
        return new Response(JSON.stringify({ error: "Type de bloc invalide" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const context = existingBlocks?.length
        ? `\n\nContexte - Blocs déjà rédigés:\n${existingBlocks.map((b: any) => `### ${b.title}\n${b.content?.substring(0, 300)}...`).join("\n\n")}`
        : "";

      systemPrompt = `Tu es un consultant senior en stratégie (méthode ${frameworkName}) spécialisé dans les dossiers présentés à des investisseurs ou partenaires. Génère UN SEUL bloc de qualité "investor-ready".

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide:
{ "title": "${blockInfo.title}", "content": "Contenu en markdown..." }

Bloc: ${blockInfo.title}
Contenu attendu: ${blockInfo.desc}

EXIGENCES :
- 250-450 mots, ton professionnel et factuel, pas de généralités.
- Markdown structuré : ###, listes, gras, tableaux si pertinent.
- Hypothèses explicites ("Hypothèse : ...") ou benchmarks sectoriels cités pour chaque chiffre.
- Mentionner risques, limites, points à valider (logique Lean : interview client, MVP, A-B test).
- Spécifique au secteur, à la géographie et à la maturité du projet décrit.
- Cohérence avec les blocs déjà rédigés (mêmes chiffres, mêmes personas, mêmes concurrents).
- Estimations chiffrées obligatoires pour : pricing, CAC, LTV, coûts, parts de marché, taille de segments, ratio LTV/CAC, point mort.`;

      userPrompt = `Projet: ${projectTitle || "Sans titre"}\nDescription: ${projectDescription}${context}${assumptionsBlock}${bpContext}`;
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
        return new Response(JSON.stringify({ error: "Trop de requêtes, veuillez réessayer." }), {
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
    console.error("generate-business-model error:", e);
    return new Response(
      JSON.stringify({ error: "Une erreur est survenue lors de la génération" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
