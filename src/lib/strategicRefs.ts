// Re-export the canonical strategic refs module shared with edge functions.
// The single source of truth lives in supabase/functions/_shared/strategicRefs.ts
// so client and server normalization can never diverge.
export {
  BP_SECTION_TYPES,
  BM_BLOCK_TYPES,
  slugifyRefType,
  normalizeRefType,
  normalizeRefWithFallback,
} from "../../supabase/functions/_shared/strategicRefs";
export type {
  BPSectionType,
  BMBlockType,
} from "../../supabase/functions/_shared/strategicRefs";
