import { Fragment, ReactNode } from 'react';

// Renders the plain-text maths the question bank is written in.
//
// Questions are stored as text, so an option reads literally as
// "(1003)*2^15 − 3". The caret, the asterisk and "sqrt" are authoring
// shorthand, not something a learner should have to decode mid-exam.
//
// Deliberately not a LaTeX renderer: the bank is not written in LaTeX, and
// pulling in a maths typesetting library to superscript a few exponents would
// cost more than it returns. This handles the three notations that actually
// appear in the data and leaves everything else untouched.
//
//   x^2            -> x²        (superscript run)
//   3^(n+1)        -> 3ⁿ⁺¹      (parenthesised exponent, parens dropped)
//   10^-3          -> 10⁻³      (signed exponent)
//   (997)*2^14     -> (997)×2¹⁴ (multiplication sign)
//   4sqrt6         -> 4√6
//   log10 2        -> log₁₀ 2   (subscripted base)
//   log_2 x        -> log₂ x

// Deciding whether an asterisk means multiplication.
//
// "3^a * 12^a" and "x * y" are products; "note * see below" is a bullet. The
// immediate neighbour cannot tell them apart once the author puts spaces
// around the operator, so look at the whole adjacent token instead: a product
// is flanked by operands — a number, a single-letter variable, or a bracket —
// while prose is flanked by words.

/** A number or a one-letter variable reads as something being multiplied. */
const isOperand = (token: string): boolean =>
  token.length > 0 && (/^[0-9]+$/.test(token) || token.length === 1);

const tokenBefore = (s: string, end: number): string => {
  let j = end;
  while (j > 0 && /[0-9A-Za-z]/.test(s[j - 1])) j--;
  return s.slice(j, end);
};

const tokenAfter = (s: string, start: number): string => {
  let j = start;
  while (j < s.length && /[0-9A-Za-z]/.test(s[j])) j++;
  return s.slice(start, j);
};

/** Looks left from an asterisk, tolerating one space, for something multiplied. */
const hasOperandLeft = (s: string, i: number): boolean => {
  let j = i - 1;
  if (s[j] === ' ') j--;
  if (j < 0) return false;
  if (s[j] === ')' || s[j] === ']') return true;
  if (!/[0-9A-Za-z]/.test(s[j])) return false;
  return isOperand(tokenBefore(s, j + 1));
};

const hasOperandRight = (s: string, i: number): boolean => {
  let j = i + 1;
  if (s[j] === ' ') j++;
  if (j >= s.length) return false;
  if (s[j] === '(' || s[j] === '[') return true;
  if (!/[0-9A-Za-z]/.test(s[j])) return false;
  return isOperand(tokenAfter(s, j));
};

/** An exponent run ends at the first character that cannot be part of it. */
const isExponentChar = (ch: string): boolean => /[0-9A-Za-z.]/.test(ch);

export const parseMathText = (input: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let buffer = '';
  let key = 0;

  const flush = () => {
    if (buffer) {
      nodes.push(buffer);
      buffer = '';
    }
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    // sqrt -> √, but only as a whole word so "sqrts" or a variable named
    // "sqrtx" is not mangled.
    if (
      (ch === 's' || ch === 'S') &&
      input.slice(i, i + 4).toLowerCase() === 'sqrt' &&
      !/[A-Za-z]/.test(input[i - 1] ?? '')
    ) {
      buffer += '√';
      i += 3;
      continue;
    }

    if (ch === '*' && hasOperandLeft(input, i) && hasOperandRight(input, i)) {
      buffer += '×';
      continue;
    }

    // log10 2 -> log₁₀ 2, log_2 x -> log₂ x.
    //
    // Only a digit run or an explicit underscore counts as a base. Bare
    // letters are left alone on purpose: "logs", "logic" and "logarithm"
    // would otherwise have their next letter torn off and subscripted. The
    // word-boundary check keeps "parallelogram" out of it too.
    if (
      (ch === 'l' || ch === 'L') &&
      input.slice(i, i + 3).toLowerCase() === 'log' &&
      !/[A-Za-z]/.test(input[i - 1] ?? '')
    ) {
      let j = i + 3;
      let base = '';
      if (/[0-9]/.test(input[j] ?? '')) {
        while (j < input.length && /[0-9]/.test(input[j])) base += input[j++];
      } else if (input[j] === '_') {
        j++;
        while (j < input.length && /[0-9A-Za-z]/.test(input[j])) base += input[j++];
      }
      if (base) {
        buffer += input.slice(i, i + 3); // keep the author's capitalisation
        flush();
        nodes.push(<sub key={key++}>{base}</sub>);
        i = j - 1;
        continue;
      }
      // No base to subscript — fall through and let "log" print normally.
    }

    if (ch === '^') {
      // Parenthesised exponent: take the balanced group and drop the parens,
      // so 3^(n+1) reads as 3ⁿ⁺¹ the way it would be printed.
      if (input[i + 1] === '(') {
        let depth = 0;
        let j = i + 1;
        for (; j < input.length; j++) {
          if (input[j] === '(') depth++;
          else if (input[j] === ')') {
            depth--;
            if (depth === 0) break;
          }
        }
        if (depth === 0 && j > i + 1) {
          const inner = input.slice(i + 2, j);
          flush();
          nodes.push(<sup key={key++}>{parseMathText(inner)}</sup>);
          i = j;
          continue;
        }
        // Unbalanced — fall through and treat the caret as literal text.
      }

      // Bare exponent, optionally signed: 10^-3, x^2, 2^15.
      let j = i + 1;
      if (input[j] === '-' || input[j] === '−' || input[j] === '+') j++;
      const start = j;
      while (j < input.length && isExponentChar(input[j])) j++;
      if (j > start) {
        flush();
        nodes.push(<sup key={key++}>{input.slice(i + 1, j)}</sup>);
        i = j - 1;
        continue;
      }

      // A caret with nothing usable after it stays as written.
      buffer += ch;
      continue;
    }

    buffer += ch;
  }

  flush();
  return nodes;
};

interface MathTextProps {
  children: string | null | undefined;
  className?: string;
}

/** Inline maths-aware text. Renders nothing for empty input. */
export const MathText = ({ children, className }: MathTextProps) => {
  if (!children) return null;
  const parsed = parseMathText(children);
  return (
    <span className={className}>
      {parsed.map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </span>
  );
};
