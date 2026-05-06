const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const LOVABLE_API_URL = "https://api.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { projectDescription, title, horizonMonths, categories, sectionCategory } = await req.json();

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
- Pour les investissements, inclus les amortissements`;

    const userPrompt = `Génère un budget prévisionnel professionnel sur ${horizonMonths} mois pour les catégories suivantes : ${categoryList}.

Projet : "${title}"
Description : "${projectDescription || "Non spécifiée"}"

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

    // Extract JSON from possible markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) content = jsonMatch[1].trim();

    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
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
