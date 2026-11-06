import { orderedSections, type MarketStudyConfig, type MarketStudySection } from "./marketStudy";

export type AuditCategory = "secteur" | "methodes" | "sections" | "sources" | "estimations";
export type AuditSeverity = "critical" | "warning" | "info";

export interface AuditIssue {
  category: AuditCategory;
  severity: AuditSeverity;
  message: string;
  recommendation: string;
  sectionKey?: string;
}

export interface StudyAudit {
  score: number;
  categoryScores: Record<AuditCategory, number>;
  issues: AuditIssue[];
}

export const PENALTY: Record<AuditSeverity, number> = { critical: 15, warning: 6, info: 2 };
export const MIN_WORDS: Record<MarketStudyConfig["depth"], number> = { standard: 150, approfondie: 300, experte: 500 };
export const ESSENTIAL_SECTIONS = ["executive_summary", "methodology", "market_sizing"];
/** Methods covered by a dedicated report section. */
export const FRAMEWORK_SECTION: Record<string, string> = {
  PESTEL: "pestel", Porter: "porter", SWOT: "swot", "TAM/SAM/SOM": "market_sizing", Personas: "customers",
};
const FRAMEWORK_PATTERN: Record<string, RegExp> = {
  PESTEL: /pestel/i, Porter: /porter/i, SWOT: /swot/i, "TAM/SAM/SOM": /\bTAM\b|\bSAM\b|\bSOM\b/,
  Personas: /persona/i, "Jobs-to-be-done": /jobs?[- ]to[- ]be[- ]done|jtbd/i, "Matrice BCG": /bcg/i,
  "Océan bleu": /oc[ée]an bleu|blue ocean/i, "Analyse VRIO": /vrio/i,
};
const SOURCE_RE = /source|insee|eurostat|statista|xerfi|oecd|ocde|banque mondiale|world bank|https?:\/\/|rapport|selon|d'après/i;
const ESTIMATE_RE = /estim|hypoth[èe]s|environ|approx|~|≈|fourchette|ordre de grandeur|projection|sc[ée]nario/i;
const FIGURE_RE = /\d[\d\s.,]*\s?(%|€|\$|m€|md€|k€|millions?|milliards?)/gi;
const NUMERIC_SECTIONS = ["market_sizing", "forecast", "pricing", "competition", "distribution"];

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
const tokens = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3);
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function auditMarketStudy(config: MarketStudyConfig, sections: MarketStudySection[]): StudyAudit {
  const issues: AuditIssue[] = [];
  const wanted = orderedSections(config.sections ?? []);
  const content = (k: string) => sections.find((s) => s.key === k)?.content?.trim() ?? "";
  const written = wanted.filter((w) => content(w.key));
  const all = written.map((w) => content(w.key)).join("\n");

  // Secteur
  const sectorTokens = tokens(config.sector ?? "");
  if (!sectorTokens.length) {
    issues.push({ category: "secteur", severity: "critical", message: "Aucun secteur renseigné.", recommendation: "Précisez le secteur ou domaine dans la configuration." });
  } else if (written.length) {
    const off = written.filter((w) => !sectorTokens.some((t) => norm(content(w.key)).includes(t)));
    if (off.length / written.length > 0.5)
      issues.push({ category: "secteur", severity: "warning", message: `${off.length} section(s) sur ${written.length} ne mentionnent pas le secteur « ${config.sector} ».`, recommendation: "Régénérez ces sections pour les recentrer sur le secteur." });
    else off.forEach((w) => issues.push({ category: "secteur", severity: "info", sectionKey: w.key, message: `« ${w.title} » ne cite pas le secteur.`, recommendation: "Vérifiez que le contenu reste spécifique au secteur." }));
  }
  if (written.length && config.geography && !tokens(config.geography).some((t) => norm(all).includes(t)))
    issues.push({ category: "secteur", severity: "warning", message: `La zone « ${config.geography} » n'est jamais citée.`, recommendation: "Précisez les chiffres pour la zone géographique choisie." });

  // Méthodes
  if (!config.frameworks?.length)
    issues.push({ category: "methodes", severity: "warning", message: "Aucune méthode d'analyse choisie.", recommendation: "Cochez au moins PESTEL, Porter ou SWOT." });
  for (const f of config.frameworks ?? []) {
    const sec = FRAMEWORK_SECTION[f];
    if (sec && !wanted.some((w) => w.key === sec)) {
      issues.push({ category: "methodes", severity: "warning", message: `La méthode ${f} est choisie mais sa section n'est pas incluse.`, recommendation: `Activez la section correspondante ou retirez ${f}.` });
    } else if (written.length && !FRAMEWORK_PATTERN[f]?.test(sec && content(sec) ? content(sec) : all)) {
      issues.push({ category: "methodes", severity: sec ? "warning" : "info", sectionKey: sec, message: `La méthode ${f} n'apparaît pas dans le rapport.`, recommendation: "Régénérez la section concernée pour appliquer cette méthode." });
    }
  }

  // Sections
  for (const k of ESSENTIAL_SECTIONS)
    if (!wanted.some((w) => w.key === k))
      issues.push({ category: "sections", severity: "warning", message: `Section essentielle exclue : ${orderedSections([k])[0]?.title}.`, recommendation: "Ajoutez-la : banques et investisseurs l'attendent." });
  const missing = wanted.filter((w) => !content(w.key));
  if (missing.length)
    issues.push({ category: "sections", severity: missing.length === wanted.length ? "critical" : "warning", message: `${missing.length} section(s) non rédigée(s) sur ${wanted.length}.`, recommendation: "Utilisez « Compléter les sections manquantes »." , sectionKey: missing[0].key });
  const min = MIN_WORDS[config.depth] ?? 300;
  written.filter((w) => words(content(w.key)) < min).forEach((w) =>
    issues.push({ category: "sections", severity: "info", sectionKey: w.key, message: `« ${w.title} » est courte (${words(content(w.key))} mots, ${min} attendus).`, recommendation: "Régénérez ou complétez cette section." }));

  // Sources
  const meth = content("methodology");
  if (meth && !SOURCE_RE.test(meth))
    issues.push({ category: "sources", severity: "warning", sectionKey: "methodology", message: "La méthodologie ne cite aucune source.", recommendation: "Ajoutez les sources utilisées (INSEE, Eurostat, rapports…)." });
  written.filter((w) => (content(w.key).match(FIGURE_RE)?.length ?? 0) >= 2 && !SOURCE_RE.test(content(w.key))).forEach((w) =>
    issues.push({ category: "sources", severity: "warning", sectionKey: w.key, message: `« ${w.title} » donne des chiffres sans source.`, recommendation: "Citez la source de chaque chiffre clé." }));

  // Estimations
  written.filter((w) => NUMERIC_SECTIONS.includes(w.key) && (content(w.key).match(FIGURE_RE)?.length ?? 0) >= 1 && !ESTIMATE_RE.test(content(w.key))).forEach((w) =>
    issues.push({ category: "estimations", severity: "warning", sectionKey: w.key, message: `« ${w.title} » présente des chiffres sans les signaler comme estimations.`, recommendation: "Indiquez les hypothèses et marquez les valeurs estimées." }));
  const fc = content("forecast");
  if (fc && !/pessimiste|optimiste|bear|bull/i.test(fc))
    issues.push({ category: "estimations", severity: "info", sectionKey: "forecast", message: "Les prévisions n'ont pas de scénarios pessimiste/optimiste.", recommendation: "Ajoutez au moins trois scénarios chiffrés." });

  const cats: AuditCategory[] = ["secteur", "methodes", "sections", "sources", "estimations"];
  const categoryScores = Object.fromEntries(cats.map((c) => [c, Math.max(0, 100 - issues.filter((i) => i.category === c).reduce((s, i) => s + PENALTY[i.severity] * 2, 0))])) as Record<AuditCategory, number>;
  const score = Math.max(0, 100 - issues.reduce((s, i) => s + PENALTY[i.severity], 0));
  return { score, categoryScores, issues };
}
