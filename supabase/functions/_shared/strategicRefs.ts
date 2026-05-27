// Canonical ref_type identifiers and normalization logic for Business Plan
// sections and Business Model blocks. Shared between the client
// (src/lib/strategicRefs.ts re-exports from here) and edge functions, so the
// normalization rules cannot diverge between the two environments.
//
// IMPORTANT: keep this file dependency-free (no Deno-only or browser-only
// imports) so it can be consumed by both Vite/React and Deno edge functions.

export const BP_SECTION_TYPES = [
  "executive_summary",
  "market_analysis",
  "business_strategy",
  "financial_plan",
  "best_practices",
] as const;

export const BM_BLOCK_TYPES = [
  // BMC
  "key_partners",
  "key_activities",
  "key_resources",
  "value_propositions",
  "customer_relationships",
  "channels",
  "customer_segments",
  "cost_structure",
  "revenue_streams",
  // Lean (delta)
  "problem",
  "solution",
  "unique_value",
  "unfair_advantage",
  "key_metrics",
] as const;

export type BPSectionType = (typeof BP_SECTION_TYPES)[number];
export type BMBlockType = (typeof BM_BLOCK_TYPES)[number];

const BP_SET = new Set<string>(BP_SECTION_TYPES);
const BM_SET = new Set<string>(BM_BLOCK_TYPES);

/** Lowercase, strip accents, replace separators by `_`, collapse repeats. */
export function slugifyRefType(raw: string | undefined | null): string {
  return (raw || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s\-./]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Normalize a raw ref_type to a canonical BP section_type or BM block_type.
 * Returns null when no canonical match is found.
 * `extraAllowed` lets callers (e.g. components with access to live DB data)
 * accept additional valid identifiers beyond the static canonical list.
 */
export function normalizeRefType(
  refType: string | undefined | null,
  docType: "bp" | "bm",
  extraAllowed?: Iterable<string>,
): string | null {
  if (!refType) return null;
  const slug = slugifyRefType(refType);
  if (!slug) return null;

  const canonical = docType === "bp" ? BP_SET : BM_SET;
  if (canonical.has(slug)) return slug;
  if (extraAllowed) {
    for (const v of extraAllowed) {
      if (slugifyRefType(v) === slug) return v;
    }
  }
  return null;
}

/**
 * Server-side helper that normalizes a ref against:
 *  1. the canonical static list,
 *  2. the live DB refs (`allowed[].ref_type`),
 *  3. a fuzzy fallback on `ref_title` matching `allowed[].title`.
 * Returns the canonical/live ref_type, or null when unresolved.
 */
export function normalizeRefWithFallback(
  refType: string | undefined | null,
  docType: "bp" | "bm",
  refTitle: string | undefined | null,
  allowed: { ref_type: string; title: string }[],
): string | null {
  const liveTypes = allowed.map((r) => r.ref_type);
  const direct = normalizeRefType(refType, docType, liveTypes);
  if (direct) return direct;

  // Fuzzy fallback: match the human-provided title against live refs' titles.
  const titleSlug = slugifyRefType(refTitle || "");
  if (titleSlug) {
    for (const r of allowed) {
      if (slugifyRefType(r.title) === titleSlug) return r.ref_type;
    }
  }
  return null;
}
