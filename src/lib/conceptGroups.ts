// The middle tier of the taxonomy.
//
// The seeded schema is sections → topics → subtopics, but only two levels
// discriminate: one section (Quantitative Aptitude), five topics (Arithmetic,
// Algebra, Geometry, Modern Mathematics, Number System) and 126 subtopics.
// `Relative Speed` hangs directly off `Arithmetic`, with nothing in between to
// gather it, `Trains`, `Boats & Streams` and `Circular Track` under one
// heading — so the dashboard had no choice but to list all 126 flat.
//
// The grouping is not invented here. Every subtopic already carries a
// `concept_code` whose prefix names its family: TSD_RELATIVE, TSD_TRAIN and
// TSD_BOAT are all TSD. This file makes those prefixes explicit and names them.
//
// Deliberately resolved in the client rather than migrated into the database.
// A `topic_groups` table is the better long-term home (display_order, i18n, no
// string parsing) — see database/03-concept-groups.proposal.md — but the codes
// already encode the answer, so shipping the tier needs no schema change, no
// backfill, and no migration of anyone's existing mastery state.

export interface ConceptGroup {
  slug: string;
  name: string;
  /** Parent topic name, exactly as the taxonomy spells it. */
  section: string;
  /**
   * concept_code prefixes that land in this group. Matched longest-first, so
   * `ALG_LOG_EQ` reaches Exponential & Logarithmic Equations rather than being
   * swallowed by `ALG_LOG`.
   */
  prefixes: string[];
}

export const CONCEPT_GROUPS: ConceptGroup[] = [
  // ---- Arithmetic — 31 subtopics ------------------------------------
  { slug: 'percentages', name: 'Percentages', section: 'Arithmetic', prefixes: ['PERC_'] },
  { slug: 'profit-loss-discount', name: 'Profit, Loss & Discount', section: 'Arithmetic', prefixes: ['PL_'] },
  { slug: 'ratio-proportion', name: 'Ratio & Proportion', section: 'Arithmetic', prefixes: ['RATIO_'] },
  { slug: 'mixtures-alligation', name: 'Mixtures & Alligation', section: 'Arithmetic', prefixes: ['MIX_'] },
  { slug: 'partnership', name: 'Partnership', section: 'Arithmetic', prefixes: ['PART_'] },
  { slug: 'interest', name: 'Interest', section: 'Arithmetic', prefixes: ['SI_', 'CI_', 'EMI_'] },
  { slug: 'time-work', name: 'Time & Work', section: 'Arithmetic', prefixes: ['TW_'] },
  { slug: 'pipes-cisterns', name: 'Pipes & Cisterns', section: 'Arithmetic', prefixes: ['PIPE_'] },
  { slug: 'time-speed-distance', name: 'Time, Speed & Distance', section: 'Arithmetic', prefixes: ['TSD_'] },
  { slug: 'averages', name: 'Averages', section: 'Arithmetic', prefixes: ['AVG_'] },

  // ---- Algebra — 27 subtopics ---------------------------------------
  { slug: 'algebraic-foundations', name: 'Algebraic Foundations', section: 'Algebra', prefixes: ['ALG_BASIC', 'ALG_INDICES', 'ALG_SURDS', 'ALG_LOG'] },
  { slug: 'linear-equations', name: 'Linear Equations', section: 'Algebra', prefixes: ['ALG_LINEAR_'] },
  { slug: 'quadratic-equations', name: 'Quadratic & Higher Equations', section: 'Algebra', prefixes: ['ALG_QUAD_', 'ALG_HIGHER_DEGREE'] },
  { slug: 'functions', name: 'Functions', section: 'Algebra', prefixes: ['ALG_FUNC_'] },
  { slug: 'inequalities', name: 'Inequalities', section: 'Algebra', prefixes: ['ALG_INEQ_'] },
  { slug: 'progressions-series', name: 'Progressions & Series', section: 'Algebra', prefixes: ['ALG_AP', 'ALG_GP', 'ALG_AGP', 'ALG_HP', 'ALG_SERIES_SPECIAL', 'ALG_RECURRENCE'] },
  { slug: 'exponential-logarithmic', name: 'Exponential & Logarithmic Equations', section: 'Algebra', prefixes: ['ALG_EXP', 'ALG_LOG_EQ'] },
  { slug: 'mixed-algebra', name: 'Mixed Algebra', section: 'Algebra', prefixes: ['ALG_SPECIAL', 'ALG_MISC'] },

  // ---- Geometry — 31 subtopics --------------------------------------
  { slug: 'triangles', name: 'Triangles', section: 'Geometry', prefixes: ['GEO_TRI_'] },
  { slug: 'circles', name: 'Circles', section: 'Geometry', prefixes: ['GEO_CIRCLE_', 'GEO_CYCLIC'] },
  { slug: 'quadrilaterals-polygons', name: 'Quadrilaterals & Polygons', section: 'Geometry', prefixes: ['GEO_QUAD', 'GEO_TRAP', 'GEO_POLY'] },
  { slug: 'coordinate-geometry', name: 'Coordinate Geometry', section: 'Geometry', prefixes: ['GEO_COORD_', 'GEO_LINE', 'GEO_LOCUS'] },
  { slug: 'mensuration-2d', name: 'Mensuration — 2D', section: 'Geometry', prefixes: ['GEO_MENS_2D', 'GEO_SECTOR', 'GEO_COMP'] },
  { slug: 'mensuration-3d', name: 'Mensuration — 3D', section: 'Geometry', prefixes: ['GEO_CUBE', 'GEO_CYL', 'GEO_CONE', 'GEO_SPHERE'] },
  { slug: 'trigonometry', name: 'Trigonometry', section: 'Geometry', prefixes: ['GEO_TRIG_'] },

  // ---- Modern Mathematics — 23 subtopics ------------------------------
  { slug: 'set-theory', name: 'Set Theory', section: 'Modern Mathematics', prefixes: ['SET_'] },
  { slug: 'permutations-combinations', name: 'Permutations & Combinations', section: 'Modern Mathematics', prefixes: ['MOD_COUNT', 'MOD_LINEAR', 'MOD_CIRCULAR', 'MOD_SELECT', 'MOD_DISTRIBUTION', 'MOD_RANK', 'MOD_CONDITION', 'MOD_ADVANCED'] },
  { slug: 'probability', name: 'Probability', section: 'Modern Mathematics', prefixes: ['MOD_PROB_', 'MOD_COND_PROB', 'MOD_INDEPENDENT', 'MOD_DEPENDENT', 'MOD_EXCLUSIVE', 'MOD_GEOMETRIC'] },
  { slug: 'binomial-theorem', name: 'Binomial Theorem', section: 'Modern Mathematics', prefixes: ['BINOMIAL_'] },

  // ---- Number System — 14 subtopics -----------------------------------
  { slug: 'divisibility-remainders', name: 'Divisibility & Remainders', section: 'Number System', prefixes: ['NS_DIVISIBILITY', 'NS_REMAINDER', 'NS_SUCCESSIVE_DIV'] },
  { slug: 'hcf-lcm', name: 'HCF & LCM', section: 'Number System', prefixes: ['NS_HCF', 'NS_LCM'] },
  { slug: 'factors-primes', name: 'Factors & Primes', section: 'Number System', prefixes: ['NS_FACTORS', 'NS_PRIME', 'NS_FACTORIAL'] },
  { slug: 'digits-cyclicity', name: 'Digits & Cyclicity', section: 'Number System', prefixes: ['NS_LAST_DIGIT', 'NS_LAST_DIGITS', 'NS_CYCLICITY'] },
  { slug: 'number-types-bases', name: 'Number Types & Bases', section: 'Number System', prefixes: ['NS_BASE', 'NS_INTEGER', 'NS_MISC'] },
];

/**
 * Concept codes for the bundled mock bank.
 *
 * Demo sessions never touch Supabase, so their questions carry no
 * `concept_code` — without this the whole explore experience would collapse
 * into one "Ungrouped" pile. Keyed by the mock subtopic id, which is stable.
 */
export const MOCK_CONCEPT_CODES: Record<string, string> = {
  'sub-pl': 'PL_CP_SP',
  'sub-tsd': 'TSD_RELATIVE',
  'sub-work': 'TW_COMBINED',
  'sub-quad': 'ALG_QUAD_ROOT',
  'sub-ratio': 'RATIO_BASIC',
  'sub-ci': 'CI_ANNUAL',
  'sub-avg': 'AVG_BASIC',
  'sub-numsys': 'NS_DIVISIBILITY',
  'sub-pnc': 'MOD_SELECT',
  'sub-tri': 'GEO_TRI_BASIC',
};

/** Where anything unmatched lands. Visible on purpose — a silently dropped
 *  concept is worse than one sitting in a pile labelled "Other". */
export const UNGROUPED_SLUG = 'other';
export const UNGROUPED_NAME = 'Other';

// Longest prefix first: ALG_LOG_EQ must beat ALG_LOG, and MOD_COND_PROB must
// beat MOD_COUNT's shorter siblings. Built once at module load.
const INDEX: { prefix: string; group: ConceptGroup }[] = CONCEPT_GROUPS.flatMap((group) =>
  group.prefixes.map((prefix) => ({ prefix, group }))
).sort((a, b) => b.prefix.length - a.prefix.length);

const BY_SLUG = new Map(CONCEPT_GROUPS.map((g) => [g.slug, g]));

export const getGroupBySlug = (slug: string): ConceptGroup | undefined => BY_SLUG.get(slug);

/** URL-safe slug for a topic name — 'Modern Mathematics' → 'modern-mathematics'. */
export const sectionSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export interface ResolvedGroup {
  slug: string;
  name: string;
}

/**
 * The group a concept belongs to.
 *
 * `conceptCode` is authoritative. When it is missing or unrecognised the
 * concept falls into Other rather than vanishing — an unmapped concept is
 * still a weakness, and hiding it would quietly shrink the ranking.
 */
export const resolveGroup = (
  subtopicId: string,
  conceptCode?: string | null
): ResolvedGroup => {
  const code = conceptCode || MOCK_CONCEPT_CODES[subtopicId];
  if (code) {
    const hit = INDEX.find((entry) => code.startsWith(entry.prefix));
    if (hit) return { slug: hit.group.slug, name: hit.group.name };
  }
  return { slug: UNGROUPED_SLUG, name: UNGROUPED_NAME };
};
