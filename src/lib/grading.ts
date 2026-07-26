// Answer grading.
//
// MCQ answers are option letters and compare cleanly as strings. TITA answers
// are numbers typed by hand, and a raw string comparison marked "12.0", "1,200"
// and " .5 " wrong against "12", "1200" and "0.5". Every one of those false
// negatives fed straight into consecutiveIncorrect and the weakness engine, so
// the grader is the first link that has to be right.

const CLEAN = /[\s,₹$%]/g;

/** Loose textual normalisation shared by both question types. */
export const normalizeAnswer = (value: string): string =>
  value.trim().toLowerCase().replace(CLEAN, '').replace(/^\+/, '');

/** Parse a typed answer as a number, accepting fractions like `3/4`. */
export const parseNumericAnswer = (value: string): number | null => {
  const cleaned = normalizeAnswer(value);
  if (cleaned.length === 0) return null;

  const fraction = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(cleaned);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }

  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Relative tolerance, so 0.333333 matches 1/3 without matching 0.34. */
const TOLERANCE = 1e-4;

export const isAnswerCorrect = (given: string | null, expected: string): boolean => {
  if (given === null) return false;

  const a = normalizeAnswer(given);
  const b = normalizeAnswer(expected);
  if (a.length === 0) return false;
  if (a === b) return true;

  const na = parseNumericAnswer(given);
  const nb = parseNumericAnswer(expected);
  if (na === null || nb === null) return false;

  return Math.abs(na - nb) <= TOLERANCE * Math.max(1, Math.abs(nb));
};
