export interface MarketStudyConfig {
  sector: string;
  geography: string;
  targetType: "B2B" | "B2C" | "B2B2C" | "B2G";
  horizonYears: number;
  depth: "standard" | "approfondie" | "experte";
  currency: string;
  language: "fr" | "en";
  audience: string;
  competitors: string;
  objectives: string;
  frameworks: string[];
  sections: string[];
}

export interface MarketStudySection {
  key: string;
  title: string;
  content: string;
  generated_at?: string;
}

export const SECTION_CATALOG: { key: string; title: string; brief: string }[] = [
  { key: "executive_summary", title: "Synthèse exécutive", brief: "Résumé des conclusions clés, chiffres majeurs (taille du marché, croissance, opportunité), recommandation go/no-go argumentée." },
  { key: "methodology", title: "Méthodologie & sources", brief: "Périmètre, approche (desk research, top-down, bottom-up), sources (INSEE, Eurostat, Statista, Xerfi, rapports sectoriels), limites et niveau de confiance." },
  { key: "market_definition", title: "Définition & segmentation du marché", brief: "Définition précise, chaîne de valeur, segmentation (produit, client, géographie, canal) en tableau." },
  { key: "market_sizing", title: "Taille du marché (TAM / SAM / SOM)", brief: "TAM/SAM/SOM chiffrés avec méthodes top-down ET bottom-up, tableau de calcul détaillé, historique 5 ans et projection sur l'horizon, TCAC." },
  { key: "trends", title: "Tendances & moteurs de croissance", brief: "Tendances structurelles, technologiques, sociétales ; drivers et freins ; signaux faibles ; impact estimé." },
  { key: "pestel", title: "Analyse PESTEL", brief: "Tableau PESTEL (Politique, Économique, Social, Technologique, Environnemental, Légal) avec impact noté et horizon." },
  { key: "porter", title: "5 forces de Porter", brief: "Chaque force notée /5 en tableau, justification, intensité concurrentielle globale, barrières à l'entrée." },
  { key: "customers", title: "Analyse de la demande & personas", brief: "Profils clients, 3 à 5 personas détaillés (besoins, douleurs, critères d'achat, budget, parcours), volumes, propension à payer." },
  { key: "competition", title: "Paysage concurrentiel", brief: "Cartographie des concurrents directs/indirects/substituts, tableau comparatif (offre, prix, cible, forces, faiblesses, parts de marché estimées), mapping de positionnement." },
  { key: "pricing", title: "Analyse des prix & modèles économiques", brief: "Fourchettes de prix du marché, modèles de revenus observés, élasticité, recommandation de pricing chiffrée." },
  { key: "distribution", title: "Canaux de distribution & acquisition", brief: "Canaux existants, coûts d'acquisition typiques (CAC), partenaires clés, recommandations go-to-market." },
  { key: "regulation", title: "Cadre réglementaire & normes", brief: "Lois, normes, certifications, licences, contraintes RGPD/sectorielles, évolutions attendues." },
  { key: "swot", title: "SWOT & facteurs clés de succès", brief: "Matrice SWOT en tableau 2x2, facteurs clés de succès du marché, positionnement recommandé." },
  { key: "risks", title: "Risques & opportunités", brief: "Matrice des risques (probabilité × impact) en tableau, plan de mitigation, opportunités prioritaires." },
  { key: "forecast", title: "Prévisions & scénarios", brief: "Projection du marché et part atteignable sur l'horizon, scénarios pessimiste/réaliste/optimiste chiffrés en tableau, hypothèses explicites." },
  { key: "survey", title: "Questionnaire terrain & plan d'enquête", brief: "Questionnaire prêt à l'emploi (15-25 questions), échantillon recommandé, guide d'entretien qualitatif, plan de collecte." },
  { key: "recommendations", title: "Recommandations stratégiques & plan d'action", brief: "Recommandations priorisées, plan d'action 90 jours / 12 mois, KPIs de suivi, budget indicatif." },
];

export const FRAMEWORKS = ["PESTEL", "Porter", "SWOT", "TAM/SAM/SOM", "Personas", "Jobs-to-be-done", "Matrice BCG", "Océan bleu", "Analyse VRIO"];

export const DEFAULT_CONFIG: MarketStudyConfig = {
  sector: "",
  geography: "France",
  targetType: "B2C",
  horizonYears: 5,
  depth: "approfondie",
  currency: "EUR",
  language: "fr",
  audience: "Investisseurs et partenaires",
  competitors: "",
  objectives: "",
  frameworks: ["PESTEL", "Porter", "SWOT", "TAM/SAM/SOM", "Personas"],
  sections: SECTION_CATALOG.map((s) => s.key),
};

/** Keep only known sections, in catalog order. */
export function orderedSections(keys: string[]) {
  return SECTION_CATALOG.filter((s) => keys.includes(s.key));
}

/** Completion % of a study = generated selected sections / selected sections. */
export function completion(config: Partial<MarketStudyConfig>, sections: MarketStudySection[]) {
  const wanted = orderedSections(config.sections ?? []);
  if (wanted.length === 0) return 0;
  const done = wanted.filter((w) => sections.some((s) => s.key === w.key && s.content.trim())).length;
  return Math.round((done / wanted.length) * 100);
}
