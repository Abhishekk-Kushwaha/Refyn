// Seed flashcards, one or two per concept — stand-in for the tricks→flashcards
// sync (Database doc §14.1). The engine queues these when a concept goes weak;
// the Phase 5 flashcards UI reviews them via SM-2.

export interface MockFlashcard {
  id: string;
  conceptId: string;
  front: string;
  backFormula?: string;
  backExplanation: string;
}

export const MOCK_FLASHCARDS: MockFlashcard[] = [
  {
    id: 'fc-pl-1',
    conceptId: 'sub-pl',
    front: 'Markup m% then discount d% — net effect?',
    backFormula: 'Net % = m − d − (m×d)/100',
    backExplanation: 'Mark 40%, discount 25%: 40 − 25 − 10 = 5% profit. One line, no CP assumption needed.',
  },
  {
    id: 'fc-tsd-1',
    conceptId: 'sub-tsd',
    front: 'Two trains crossing in opposite directions — time?',
    backFormula: 't = (L₁ + L₂) / (v₁ + v₂)',
    backExplanation: 'Add both lengths, add both speeds (opposite directions). Convert km/h → m/s by × 5/18 first.',
  },
  {
    id: 'fc-work-1',
    conceptId: 'sub-work',
    front: 'A and B together, then A leaves — how to split the work?',
    backFormula: 'Work done = t × (1/a + 1/b); remaining ÷ B\'s rate',
    backExplanation: 'Compute the joint fraction finished, subtract from 1, divide the remainder by the stayer\'s rate.',
  },
  {
    id: 'fc-quad-1',
    conceptId: 'sub-quad',
    front: 'Roots in ratio p:q for x² − Sx + P = 0 — fastest path?',
    backFormula: 'Roots pk, qk → (p+q)k = S; P = pq·k²',
    backExplanation: 'Let the roots be pk and qk. Sum pins k instantly; product gives the constant term.',
  },
  {
    id: 'fc-ratio-1',
    conceptId: 'sub-ratio',
    front: 'Age ratio then vs now — setup?',
    backFormula: '(ak + t)/(bk + t) = new ratio',
    backExplanation: 'Old ages ak, bk; add the elapsed years to BOTH before equating to the new ratio. Cross-multiply, solve k.',
  },
  {
    id: 'fc-tri-1',
    conceptId: 'sub-tri',
    front: 'Altitude to the hypotenuse of a right triangle?',
    backFormula: 'h = (leg₁ × leg₂) / hypotenuse',
    backExplanation: 'Both expressions for area: ½·leg₁·leg₂ = ½·hyp·h. Equate and solve — no trig needed.',
  },
  {
    id: 'fc-ci-1',
    conceptId: 'sub-ci',
    front: 'Spotting the CI rate from amount ratio?',
    backFormula: 'A/P = (1 + r)ⁿ — look for perfect nth powers',
    backExplanation: '9261/8000 = (21/20)³ → r = 1/20 = 5%. CAT amounts are usually built from clean powers.',
  },
  {
    id: 'fc-numsys-1',
    conceptId: 'sub-numsys',
    front: 'Last-two-digits / mod 100 of aᵇ?',
    backFormula: 'Find the cycle of aⁿ mod 100',
    backExplanation: '7ⁿ mod 100 cycles 07, 49, 43, 01 every 4. Reduce the exponent mod 4 and read off.',
  },
  {
    id: 'fc-avg-1',
    conceptId: 'sub-avg',
    front: 'One person replaced, average shifts by x?',
    backFormula: 'New weight = old weight + n·x',
    backExplanation: 'The whole shift times group size lands on the swapped person. 8 people, +2.5 → new = old + 20.',
  },
  {
    id: 'fc-pnc-1',
    conceptId: 'sub-pnc',
    front: 'Arrangements with vowels together?',
    backFormula: '(n−v+1)! × v!',
    backExplanation: 'Glue the vowels into one block, arrange the blocks, then arrange inside the block. MOBILE: 4!×3! = 144.',
  },
];
