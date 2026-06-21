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
      systemPrompt = `Tu es un consultant senior en stratégie (ex-Big Four / banque d'affaires) spécialisé dans la rédaction de business plans destinés à des demandes de financement (banques, BPI, business angels, VCs) ou de partenariats stratégiques. Tu rédiges des documents de qualité "investor-ready" qui peuvent être présentés tels quels en comité de crédit ou en due diligence.

IMPORTANT: Tu dois répondre UNIQUEMENT avec un JSON valide, sans aucun texte avant ou après.

Le format JSON doit être:
{
  "sections": [
    { "type": "executive_summary", "title": "Résumé exécutif", "content": "Contenu détaillé en markdown..." },
    { "type": "market_analysis", "title": "Analyse de marché", "content": "Contenu détaillé en markdown..." },
    { "type": "business_strategy", "title": "Stratégie commerciale", "content": "Contenu détaillé en markdown..." },
    { "type": "financial_plan", "title": "Plan financier", "content": "Contenu détaillé en markdown avec tableaux..." },
    { "type": "best_practices", "title": "Meilleures pratiques du secteur", "content": "Contenu détaillé en markdown..." }
  ]
}

EXIGENCES DE QUALITÉ — niveau présentation à un financeur ou partenaire :
- Chaque section : minimum 700 mots, structurée avec titres (##), sous-titres (###), listes, tableaux markdown, gras pour les chiffres clés.
- Ton : professionnel, neutre, factuel, sans superlatifs creux ("révolutionnaire", "incroyable"). Privilégier la précision et la nuance.
- Chaque affirmation chiffrée doit être justifiée par une hypothèse explicite ("Hypothèse : ...") ou une référence sectorielle plausible (rapport type Xerfi, INSEE, Statista, études sectorielles).
- Mentionner les limites et risques de chaque analyse — un financeur attend de l'honnêteté intellectuelle.

CONTENU OBLIGATOIRE PAR SECTION :

1. Résumé exécutif (executive_summary) :
   - Pitch en 3 lignes maximum (problème → solution → traction)
   - Mission, vision, valeurs
   - Proposition de valeur unique (UVP) avec différenciation claire
   - Équipe fondatrice (compétences clés, complémentarité)
   - Demande de financement chiffrée (montant, usage des fonds, durée, contrepartie envisagée si equity)
   - Indicateurs financiers clés (CA Année 3, EBITDA, point mort, ROI)

2. Analyse de marché (market_analysis) :
   - Tailles de marché chiffrées : TAM / SAM / SOM (avec méthode de calcul top-down ET bottom-up)
   - Segmentation clients + personas détaillés (3 personas minimum avec démographie, douleurs, parcours d'achat)
   - Tendances macro (PESTEL synthétique : Politique, Économique, Social, Technologique, Environnemental, Légal)
   - Matrice SWOT en tableau markdown 2x2 (5 éléments minimum par quadrant)
   - Analyse concurrentielle : tableau comparatif (3-5 concurrents directs/indirects, axes : prix, positionnement, parts de marché estimées, forces, faiblesses)
   - 5 forces de Porter (intensité notée /5 pour chaque force, justification)
   - Barrières à l'entrée et avantages concurrentiels durables (moat)

3. Stratégie commerciale (business_strategy) :
   - Modèle économique détaillé (mécanique de monétisation, unit economics : CAC, LTV, ratio LTV/CAC cible >3)
   - Stratégie de pricing (méthode : cost-plus, value-based, competitive ; tableau des offres/forfaits)
   - Mix marketing 4P (Produit, Prix, Place, Promotion) en sections distinctes
   - Funnel d'acquisition (canaux : SEO, SEA, social, partenariats, direct ; CAC par canal estimé)
   - Stratégie de rétention et de cross-sell/up-sell
   - Roadmap commerciale 12-18 mois avec jalons trimestriels
   - Partenariats stratégiques cibles (logos, type d'accord, valeur attendue)

4. Plan financier (financial_plan) :
   - Hypothèses clés en tableau (taux de conversion, panier moyen, churn, croissance MoM, marges)
   - Compte de résultat prévisionnel sur 3 à 5 ans en tableau markdown (CA, COGS, marge brute %, OPEX détaillés, EBITDA, EBITDA %, résultat net)
   - Plan de trésorerie mensuel sur Année 1 puis trimestriel Années 2-3 (encaissements, décaissements, BFR, solde cumulé)
   - Bilan prévisionnel synthétique fin d'année (actif/passif, capitaux propres, dette)
   - Seuil de rentabilité (point mort en CA et en mois)
   - Besoin de financement détaillé : usage des fonds en %, runway en mois
   - Scénarios pessimiste / réaliste / optimiste avec écarts chiffrés
   - KPIs financiers : CAC, LTV, churn, MRR/ARR si SaaS, gross margin, burn rate, runway
   - Stratégie de sortie / ROI investisseur sur 5 ans (multiples, TRI cible)

5. Meilleures pratiques du secteur (best_practices) :
   - Benchmarks chiffrés (KPIs médians du secteur)
   - Facteurs clés de succès (FCS) identifiés et plan d'action pour chacun
   - Pièges classiques et plan de mitigation
   - Cadre réglementaire applicable (RGPD, normes sectorielles, licences, agréments)
   - Recommandations de gouvernance, reporting investisseurs, ESG/RSE
   - Citations de standards sectoriels (ex. : "Selon le rapport sectoriel X...")

CONTRAINTES TECHNIQUES :
- Tous les tableaux financiers en markdown avec en-têtes alignés et totaux en gras.
- Cohérence chiffrée entre sections (le CA du résumé exécutif = celui du plan financier).
- Adapter le secteur, la géographie, la maturité du projet et la devise pertinente à la description fournie.
- Si une donnée est manquante, faire une hypothèse explicite plutôt qu'inventer un chiffre flou.`;

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

      systemPrompt = `Tu es un consultant senior en stratégie spécialisé dans les business plans destinés à des demandes de financement (banques, BPI, business angels, VCs) ou de partenariats. Tu génères UNE SEULE section de qualité "investor-ready", présentable en comité de crédit.

IMPORTANT: Tu dois répondre UNIQUEMENT avec un JSON valide:
{
  "title": "${sectionInfo.title}",
  "content": "Contenu détaillé en markdown..."
}

Section à générer: ${sectionInfo.title}
Ce qu'elle doit contenir: ${sectionInfo.description}

EXIGENCES DE QUALITÉ :
- Minimum 700 mots, ton professionnel et factuel (pas de superlatifs creux).
- Markdown riche : ##, ###, listes, tableaux, gras pour les chiffres clés.
- Hypothèses explicites ("Hypothèse : ...") et références sectorielles plausibles (Xerfi, INSEE, Statista).
- Mentionner risques et limites.
- Cohérence avec les sections déjà rédigées (reprendre les mêmes chiffres et personas).

Exigences spécifiques selon la section :
- executive_summary : pitch 3 lignes, UVP, équipe, demande de financement chiffrée, KPIs financiers clés (CA An 3, EBITDA, point mort, ROI).
- market_analysis : TAM/SAM/SOM avec méthode top-down ET bottom-up, 3 personas, PESTEL, SWOT en tableau 2x2, tableau concurrentiel, 5 forces de Porter notées /5, barrières à l'entrée.
- business_strategy : unit economics (CAC, LTV, ratio LTV/CAC), pricing détaillé, mix 4P, funnel d'acquisition par canal, roadmap commerciale 12-18 mois, partenariats cibles.
- financial_plan : hypothèses chiffrées, compte de résultat 3-5 ans, plan de trésorerie mensuel An1 puis trimestriel, bilan synthétique, seuil de rentabilité, usage des fonds, scénarios pessimiste/réaliste/optimiste, TRI cible.
- best_practices : benchmarks chiffrés sectoriels, FCS avec plan d'action, pièges et mitigation, cadre réglementaire, gouvernance/reporting/ESG.

Tous les tableaux financiers en markdown avec totaux en gras. Si une donnée manque, formuler une hypothèse explicite plutôt qu'un chiffre flou.`;

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
