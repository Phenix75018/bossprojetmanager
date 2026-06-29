import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Shared ref_type normalization — single source of truth used by both the
// client (src/lib/strategicRefs.ts re-exports) and edge functions.
import { normalizeRefWithFallback } from "../_shared/strategicRefs.ts";
import {
  fetchAssumptions,
  formatAssumptionsBlock,
  mergeAssumptions,
  validateAssumptions,
  validationErrorResponse,
  type BusinessAssumptions,
} from "../_shared/businessAssumptions.ts";

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
  return items
    .map((j) => {
      if (typeof j === "string") return { text: j };
      if (!j || typeof j !== "object") return null;
      const text = typeof j.text === "string" ? j.text : "";
      if (!text) return null;
      if (!j.ref || typeof j.ref !== "object") return { text };
      const docType = j.ref.doc_type === "bp" || j.ref.doc_type === "bm" ? j.ref.doc_type : null;
      if (!docType) return { text };
      const allowed = docType === "bp" ? bpRefs : bmRefs;
      const normalized = normalizeRef(j.ref.ref_type, docType, j.ref.ref_title, allowed);
      if (!normalized) {
        // Drop the broken ref so the UI doesn't render a dead link.
        return { text };
      }
      const titleFromAllowed = allowed.find((r) => r.ref_type === normalized)?.title;
      return {
        text,
        ref: {
          doc_type: docType,
          ref_type: normalized,
          ref_title: j.ref.ref_title || titleFromAllowed || normalized,
        },
      };
    })
    .filter(Boolean);
}

interface StratResult {
  context: string;
  bpId: string | null;
  bmId: string | null;
  bpRefs: { ref_type: string; title: string }[];
  bmRefs: { ref_type: string; title: string }[];
}

async function fetchStrategicContext(authHeader: string | null, projectId?: string): Promise<StratResult> {
  const empty: StratResult = { context: "", bpId: null, bmId: null, bpRefs: [], bmRefs: [] };
  if (!authHeader || !projectId) return empty;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    let bpBlock = "";
    let bpId: string | null = null;
    const bpRefs: { ref_type: string; title: string }[] = [];
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
          .map((s: any) => `### [ref_type="${s.section_type}"] ${s.title}\n${(s.content || "").substring(0, 1000)}`)
          .join("\n\n");
        bpBlock = `\n\n=== CONTEXTE — Business Plan lié "${bps[0].title}" ===\n${summary}\n=== FIN CONTEXTE ===`;
      }
    }

    let bmBlock = "";
    let bmId: string | null = null;
    const bmRefs: { ref_type: string; title: string }[] = [];
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
          .map((b: any) => `### [ref_type="${b.block_type}"] ${b.title}\n${(b.content || "").substring(0, 600)}`)
          .join("\n\n");
        bmBlock = `\n\n=== CONTEXTE — Business Model lié "${bms[0].title}" (${bms[0].framework}) ===\n${summary}\n=== FIN CONTEXTE ===`;
      }
    }

    if (!bpBlock && !bmBlock) return { ...empty, bpId, bmId };
    const context = `${bpBlock}${bmBlock}\n\nIMPORTANT: Tes projections budgétaires DOIVENT être cohérentes avec ces documents stratégiques (modèle économique, pricing, segments cibles, sources de revenus, structure de coûts, projections financières mentionnées).`;
    return { context, bpId, bmId, bpRefs, bmRefs };
  } catch (e) {
    console.error("Strategic context fetch error:", e);
    return empty;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { projectDescription, title, horizonMonths, categories, sectionCategory, projectId, assumptions: bodyAssumptions } = await req.json();
    const authHeader = req.headers.get("Authorization");

    const isPartial = !!sectionCategory;

    const categoryLabels: Record<string, string> = {
      revenue: "Revenus / Chiffre d'affaires",
      fixed_charges: "Charges fixes",
      variable_charges: "Charges variables",
      treasury: "Trésorerie",
      investments: "Investissements & Amortissements",
    };

    const targetCategories = isPartial
      ? [sectionCategory]
      : (categories || ["revenue", "fixed_charges", "variable_charges", "treasury", "investments"]);

    const categoryList = targetCategories.map((c: string) => categoryLabels[c] || c).join(", ");

    const strat = await fetchStrategicContext(authHeader, projectId);
    const bpContext = strat.context;
    const dbAssumptions = await fetchAssumptions(authHeader, projectId);
    const assumptions: BusinessAssumptions | null = mergeAssumptions(
      bodyAssumptions as BusinessAssumptions | undefined,
      dbAssumptions,
    );
    const assumptionsValidation = validateAssumptions(assumptions);
    if (!assumptionsValidation.ok) {
      return validationErrorResponse(assumptionsValidation, corsHeaders);
    }
    const assumptionsBlock = formatAssumptionsBlock(assumptions);

    const refsHelp = (strat.bpRefs.length || strat.bmRefs.length)
      ? `\n\nValeurs autorisées pour "ref" dans coherence_justifications :\n` +
        (strat.bpRefs.length ? `- Business Plan (doc_type="bp") ref_type ∈ {${strat.bpRefs.map(r => `"${r.ref_type}"`).join(", ")}}\n` : "") +
        (strat.bmRefs.length ? `- Business Model (doc_type="bm") ref_type ∈ {${strat.bmRefs.map(r => `"${r.ref_type}"`).join(", ")}}` : "")
      : "";

    const systemPrompt = `Tu es un Directeur Administratif et Financier (DAF) senior et expert-comptable, habitué à construire des budgets prévisionnels présentés en comité de crédit bancaire, à BPI France, à des investisseurs (business angels, VCs) ou à des partenaires stratégiques. Tu produis des prévisionnels "investor-ready", chiffrés, justifiés et défendables en due diligence.

Tu dois répondre UNIQUEMENT en JSON valide, sans texte avant/après.

Format attendu :
{
  "lines": [
    {
      "category": "revenue|fixed_charges|variable_charges|treasury|investments",
      "subcategory": "sous-catégorie optionnelle",
      "label": "Libellé précis de la ligne",
      "monthly_values": [nombre pour chaque mois],
      "is_total": false
    }
  ],
  "coherence_justifications": [
    {
      "text": "Phrase courte expliquant comment un montant/structure du budget découle d'un élément précis du BP/BM.",
      "ref": { "doc_type": "bp" | "bm", "ref_type": "<id de section ou de bloc>", "ref_title": "Titre lisible de la section/bloc" }
    }
  ]
}

EXIGENCES DE QUALITÉ — niveau présentation à un financeur :

1. Granularité & exhaustivité (chaque catégorie demandée) :
   - Revenus : décomposer par offre / segment / canal (ex. "Abonnement Pro - segment PME", "Setup fee", "Ventes one-shot"). Distinguer volume × prix unitaire dans la sous-catégorie quand possible. Inclure montée en charge réaliste (ramp-up).
   - Charges fixes : minimum — loyers, salaires bruts chargés (détail par poste), assurances, logiciels SaaS, services pro (compta, juridique), télécom, énergie, abonnements, frais bancaires.
   - Charges variables : COGS (coût des ventes), commissions, frais de transaction (Stripe ~1.4%+0.25€), logistique, hébergement scalable, marketing payant (Ads), affiliations.
   - Trésorerie : encaissements (avec délai de paiement client réaliste : 30j B2B, immédiat B2C), décaissements (TVA collectée/déductible, IS, charges sociales URSSAF trimestrielles), solde mensuel ET solde cumulé (lignes is_total).
   - Investissements & amortissements : CAPEX initial détaillé (matériel, dev, mobilier), amortissements linéaires sur durée fiscale (3 ans informatique, 5 ans mobilier, 7-10 ans agencements).

2. Réalisme & justification :
   - Tous les montants reposent sur des hypothèses sectorielles plausibles (benchmarks Xerfi, INSEE, observatoires sectoriels).
   - Saisonnalité explicite quand pertinent (commerce : pic Nov-Déc ; B2B : creux Juil-Août).
   - Inflation/indexation des charges (+2 à 3%/an pour les contrats pluriannuels).
   - Charges sociales patronales calculées à ~42% du brut en France (ajuster selon pays).
   - TVA explicite si applicable (20% standard France).

3. Présentation comptable :
   - Charges en valeurs NÉGATIVES, revenus en POSITIVES.
   - Une ligne is_total: true par catégorie ET par sous-catégorie majeure.
   - Une ligne de marge brute (Revenus − Charges variables) et d'EBITDA (Marge brute − Charges fixes) ajoutées en tant que totaux calculés.
   - Trésorerie : ligne "Solde de trésorerie cumulé" obligatoire en is_total.

4. KPIs financiers à faire ressortir (via sous-catégories ou totaux calculés) :
   - Taux de marge brute % par mois.
   - EBITDA mensuel et cumulé.
   - Burn rate mensuel et runway (mois de trésorerie restants).
   - Point mort (mois où l'EBITDA cumulé devient positif).
   - BFR estimé (créances clients - dettes fournisseurs).

5. Cohérence stratégique :
   - Tous les montants doivent s'aligner sur le pricing, les segments, le CAC/LTV et les hypothèses du Business Plan et du Business Model fournis.
   - "coherence_justifications" : 5 à 10 objets précis liant un poste budgétaire à une section BP ou un bloc BM existant. Chaque objet DOIT contenir un "ref" valide. Si aucun BP/BM fourni, retourne [].

6. Contraintes techniques :
   - "monthly_values" : exactement ${horizonMonths} valeurs numériques (entiers ou décimaux, pas de chaînes, pas de "N/A").
   - Devise implicite cohérente avec le projet (EUR par défaut si France).
   - Adapter le niveau de détail au secteur (SaaS ≠ restauration ≠ industrie).${refsHelp}`;

    const userPrompt = `Génère un budget prévisionnel professionnel sur ${horizonMonths} mois pour les catégories suivantes : ${categoryList}.

Projet : "${title}"
Description : "${projectDescription || "Non spécifiée"}"${assumptionsBlock}${bpContext}

Génère des lignes budgétaires détaillées et réalistes avec des montants cohérents.`;

    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      return new Response(JSON.stringify({ error: "Erreur IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    let content = aiData.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) content = jsonMatch[1].trim();

    const parsed = JSON.parse(content);

    if (parsed && Array.isArray(parsed.coherence_justifications)) {
      parsed.coherence_justifications = normalizeJustifications(parsed.coherence_justifications, strat.bpRefs, strat.bmRefs);
    }

    return new Response(
      JSON.stringify({
        ...parsed,
        usedBusinessPlanContext: !!bpContext,
        bp_id: strat.bpId,
        bm_id: strat.bmId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
