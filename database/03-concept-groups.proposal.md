# Concept groups — the missing middle tier

**Status: proposal. Nothing has been migrated. Edit this file, then hand it back.**

## Why

The dashboard ledger renders every attempted concept as one flat row. At 28
concepts that is already a wall of text, and the seeded taxonomy holds **126** —
so it only gets worse as a profile fills in. The fix is to group, but the level
to group by does not exist yet.

Today's taxonomy is three tables deep, and only two of them discriminate:

| Table | Rows | Examples |
| --- | --- | --- |
| `sections` | 1 | Quantitative Aptitude |
| `topics` | 5 | Arithmetic, Algebra, Geometry, Modern Mathematics, Number System |
| `subtopics` | 126 | Relative Speed, Logarithms, Surds, Basic Ratio |

`Relative Speed` hangs directly off `Arithmetic`. There is nothing in between —
no `Time, Speed & Distance` to gather it, `Trains`, `Boats & Streams`,
`Escalators` and `Circular Track` under one heading.

## Where the grouping comes from

It is not invented here. Every subtopic already carries a `concept_code` whose
prefix names the group it belongs to — `TSD_RELATIVE`, `TSD_TRAIN`,
`TSD_BOAT` are all `TSD`, Time Speed & Distance. The proposal below is those
prefixes, made explicit and given display names.

That means the mapping is mechanical and checkable: if a row looks wrong, its
`concept_code` is the thing to argue with.

**33 groups across the 5 topics.** Counts are verified against the seed — every
section's group counts sum to its subtopic total.

---

## Arithmetic — 31 subtopics → 9 groups

| Group | Prefix | Subtopics |
| --- | --- | --- |
| Percentages | `PERC_` | Percentage Basics · Successive Percentage · Reverse Percentage |
| Profit, Loss & Discount | `PL_` | Profit & Loss · Discount · Successive Discount · Dishonest Merchant |
| Ratio & Proportion | `RATIO_` | Basic Ratio · Direct Variation · Inverse Variation |
| Mixtures & Alligation | `MIX_` | Alligation · Replacement |
| Partnership | `PART_` | Basic Partnership · Time Partnership |
| Interest | `SI_` `CI_` `EMI_` | Simple Interest · Annual CI · Half-Yearly CI · EMI |
| Time & Work | `TW_` | Single Worker · Multiple Workers · Alternate Work · Work & Wages |
| Pipes & Cisterns | `PIPE_` | Filling · Leakage |
| Time, Speed & Distance | `TSD_` | Basic Motion · Average Speed · Relative Speed · Trains · Boats & Streams · Escalators · Circular Track |

## Algebra — 27 subtopics → 8 groups

| Group | Prefix | Subtopics |
| --- | --- | --- |
| Algebraic Foundations | `ALG_BASIC` `ALG_INDICES` `ALG_SURDS` `ALG_LOG` | Basic Algebra · Indices · Surds · Logarithms |
| Linear Equations | `ALG_LINEAR_` | Single Variable · Two Variables · Word Problems |
| Quadratic & Higher Equations | `ALG_QUAD_` `ALG_HIGHER_DEGREE` | Roots · Factorization · Higher Degree Equations |
| Functions | `ALG_FUNC_` | Domain & Range · Composite & Inverse · Graphs · Maxima & Minima |
| Inequalities | `ALG_INEQ_` | Linear Inequalities · Quadratic Inequalities · Modulus Inequalities |
| Progressions & Series | `ALG_AP` `ALG_GP` `ALG_AGP` `ALG_HP` `ALG_SERIES_SPECIAL` `ALG_RECURRENCE` | Arithmetic Progression (AP) · Geometric Progression (GP) · Arithmetic-Geometric Progression (AGP) · Harmonic Progression (HP) · Special Series · Recurrence Relations |
| Exponential & Logarithmic Equations | `ALG_EXP` `ALG_LOG_EQ` | Exponential Equations · Logarithmic Equations |
| Mixed Algebra | `ALG_SPECIAL` `ALG_MISC` | Mixed Algebra · Mixed Practice |

## Geometry — 31 subtopics → 7 groups

| Group | Prefix | Subtopics |
| --- | --- | --- |
| Triangles | `GEO_TRI_` | Basic Properties · Similarity · Congruency · Special Triangles · Area · Triangle Centres |
| Circles | `GEO_CIRCLE_` `GEO_CYCLIC` | Chords · Tangents · Secants · Cyclic Quadrilateral |
| Quadrilaterals & Polygons | `GEO_QUAD` `GEO_TRAP` `GEO_POLY` | Parallelogram Family · Trapezium · Regular Polygons |
| Coordinate Geometry | `GEO_COORD_` `GEO_LINE` `GEO_LOCUS` | Distance & Midpoint · Straight Line · Circle · Locus & Family |
| Mensuration — 2D | `GEO_MENS_2D` `GEO_SECTOR` `GEO_COMP` | Plane Figures · Circle Measures · Composite Figures |
| Mensuration — 3D | `GEO_CUBE` `GEO_CYL` `GEO_CONE` `GEO_SPHERE` | Cube & Cuboid · Cylinder · Cone & Frustum · Sphere |
| Trigonometry | `GEO_TRIG_` | Trigonometric Ratios · Standard Angles · Trigonometric Identities · Height & Distance · Right Triangle Applications · Angle Calculation · Geometry + Trigonometry |

## Modern Mathematics — 23 subtopics → 4 groups

| Group | Prefix | Subtopics |
| --- | --- | --- |
| Set Theory | `SET_` | Basic Sets · Set Operations · Venn Diagrams · Inclusion-Exclusion · Cardinality · Applications |
| Permutations & Combinations | `MOD_COUNT` `MOD_LINEAR` `MOD_CIRCULAR` `MOD_SELECT` `MOD_DISTRIBUTION` `MOD_RANK` `MOD_CONDITION` `MOD_ADVANCED` | Counting Principle · Linear Arrangement · Circular Arrangement · Selection · Distribution · Ranking & Ordering · Conditional Arrangement · Advanced P&C |
| Probability | `MOD_PROB_` `MOD_COND_PROB` `MOD_INDEPENDENT` `MOD_DEPENDENT` `MOD_EXCLUSIVE` `MOD_GEOMETRIC` | Basic Probability · Conditional Probability · Independent Events · Dependent Events · Mutually Exclusive · Geometric Probability · Advanced Probability |
| Binomial Theorem | `BINOMIAL_` | Expansion · Coefficients |

## Number System — 14 subtopics → 5 groups

| Group | Prefix | Subtopics |
| --- | --- | --- |
| Divisibility & Remainders | `NS_DIVISIBILITY` `NS_REMAINDER` `NS_SUCCESSIVE_DIV` | Divisibility Rules · Remainders · Successive Division |
| HCF & LCM | `NS_HCF` `NS_LCM` | HCF · LCM |
| Factors & Primes | `NS_FACTORS` `NS_PRIME` `NS_FACTORIAL` | Factors · Prime Numbers · Factorials |
| Digits & Cyclicity | `NS_LAST_DIGIT` `NS_LAST_DIGITS` `NS_CYCLICITY` | Last Digit · Last Two / Three Digits · Cyclicity |
| Number Types & Bases | `NS_BASE` `NS_INTEGER` `NS_MISC` | Base System · Integers · Miscellaneous |

---

## Judgement calls worth your eye

These are the rows where the prefix did not decide it on its own:

1. **`Interest` merges three prefixes** (`SI_`, `CI_`, `EMI_`). Splitting Simple
   and Compound Interest into separate groups is defensible — CAT treats them as
   one family, so they are together here. Say if you want them apart.
2. **`Mixed Algebra` is a junk drawer** (`ALG_SPECIAL`, `ALG_MISC`). Two
   subtopics that mean "everything else". Could be folded into Algebraic
   Foundations, or left as its own group so it stays visibly unsorted.
3. **`Number Types & Bases`** gathers `NS_BASE`, `NS_INTEGER` and `NS_MISC` —
   the last is explicitly Miscellaneous. Same question as above.
4. **Mensuration is split 2D / 3D.** It could be one group of 7 instead. Split
   because they are different skills under time pressure.
5. **`Geometry + Trigonometry`** (`GEO_TRIG_MIXED`) sits under Trigonometry, but
   it is by definition a crossover. It stays where its prefix puts it.
6. **Probability holds 7 and P&C holds 8** — the two biggest groups. If you want
   nothing over 6, `Advanced P&C` and `Advanced Probability` could split off
   into an `Advanced Counting` group.

## Naming, once this lands

The vocabulary shifts, and the DB tables will not match the UI labels:

| DB table | Shown in the app as | Example |
| --- | --- | --- |
| `topics` | **Section** | Arithmetic |
| *new table* | **Topic** | Time, Speed & Distance |
| `subtopics` | **Subtopic** | Relative Speed |

Renaming the tables themselves would touch the engine, the seed, every service
and the RLS policies, so the mapping is proposed to live in the read model
instead. Flag it if you would rather pay for the rename now.

## What this unblocks, once approved

1. `topic_groups` table (`id`, `topic_id`, `name`, `slug`, `display_order`) and
   a nullable `group_id` on `subtopics`.
2. Seed the 33 groups; backfill `subtopics.group_id` from the `concept_code`
   prefixes above. Nullable so an unmapped concept degrades to ungrouped rather
   than disappearing.
3. Carry the group through `questionPool`'s join → `MockQuestion` → the engine's
   `ConceptMastery` → `weakness.service`. The mock bank needs the same field so
   demo mode does not lose the tier.
4. Dashboard shows sections; a section drills to a group page; a group drills to
   its concepts.
