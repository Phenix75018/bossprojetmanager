import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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
    const { projectDescription, title, horizonMonths, categories, sectionCategory, projectId } = await req.json();
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

    const bpContext = await fetchStrategicContext(authHeader, projectId);

    const systemPrompt = `Tu es un expert-comptable et analyste financier. Tu génères des budgets prévisionnels professionnels et réalistes.
Tu dois répondre UNIQUEMENT en JSON valide, sans texte avant/après.

Format attendu :
{
  "lines": [
    {
      "category": "revenue|fixed_charges|variable_charges|treasury|investments",
      "subcategory": "sous-catégorie optionnelle",
      "label": "Libellé de la ligne",
      "monthly_values": [nombre pour chaque mois],
      "is_total": false
    }
  ],
  "coherence_justifications": [
    "Phrase courte expliquant comment un montant/structure du budget découle d'un élément précis du Business Plan ou du Business Model lié (cite le nom de la section/bloc et l'élément concerné)."
  ]
}

Règles :
- Génère des lignes détaillées pour chaque catégorie demandée
- Les monthly_values doivent contenir exactement ${horizonMonths} valeurs numériques
- Ajoute des lignes de total (is_total: true) pour chaque catégorie
- Les montants doivent être réalistes et cohérents
- Inclus des variations saisonnières réalistes
- Pour les charges, utilise des valeurs négatives
- Pour la trésorerie, calcule le solde cumulé
- Pour les investissements, inclus les amortissements
- "coherence_justifications" : 4 à 8 puces concrètes liant des montants/lignes à des éléments précis du BP/BM (ex: pricing, segments, structure de coûts, sources de revenus, jalons financiers). Si aucun BP/BM n'est fourni, retourne un tableau vide [].`;

    const userPrompt = `Génère un budget prévisionnel professionnel sur ${horizonMonths} mois pour les catégories suivantes : ${categoryList}.

Projet : "${title}"
Description : "${projectDescription || "Non spécifiée"}"${bpContext}

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

    return new Response(JSON.stringify({ ...parsed, usedBusinessPlanContext: !!bpContext }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
