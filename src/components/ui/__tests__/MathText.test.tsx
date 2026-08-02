import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MathText } from '@/components/ui/MathText';

const render = (s: string) => renderToStaticMarkup(<MathText>{s}</MathText>);

describe('MathText', () => {
  it('superscripts a bare exponent', () => {
    expect(render('x^2')).toContain('x<sup>2</sup>');
  });

  it('superscripts multi-digit exponents', () => {
    expect(render('2^15')).toContain('2<sup>15</sup>');
  });

  // The option from the screenshot.
  it('renders the reported option correctly', () => {
    const out = render('(1003)*2^15 − 3');
    expect(out).toContain('×');
    expect(out).toContain('2<sup>15</sup>');
    expect(out).not.toContain('^');
    expect(out).not.toContain('*');
  });

  it('drops the parens on a parenthesised exponent', () => {
    const out = render('3^(n+1)');
    expect(out).toContain('3<sup>n+1</sup>');
    expect(out).not.toContain('(n+1)');
  });

  it('handles a fractional exponent', () => {
    expect(render('x^(7/2)')).toContain('<sup>7/2</sup>');
  });

  it('handles signed exponents', () => {
    expect(render('10^-3')).toContain('10<sup>-3</sup>');
  });

  it('stops the exponent at an operator', () => {
    const out = render('p^2+q^2=2');
    expect(out).toContain('p<sup>2</sup>');
    expect(out).toContain('q<sup>2</sup>');
    expect(out).toContain('+');
    expect(out).toContain('=2');
  });

  it('stops the exponent at a comparison', () => {
    const out = render('b^2<4ac');
    expect(out).toContain('b<sup>2</sup>');
    expect(out).toContain('4ac');
  });

  it('converts sqrt to a radical', () => {
    expect(render('4sqrt6')).toContain('4√6');
  });

  it('leaves a word merely starting with sqrt-like letters alone', () => {
    // No false positive on an identifier that embeds the letters.
    expect(render('xsqrt')).toContain('xsqrt');
  });

  it('does not turn a lone asterisk into a times sign', () => {
    // Not flanked by maths, so it is not multiplication.
    expect(render('note * see below')).toContain('*');
  });

  it('leaves a caret with nothing after it as written', () => {
    expect(render('x^')).toContain('^');
  });

  it('leaves ordinary prose untouched', () => {
    const prose = 'A shopkeeper marks up an item by 40% and offers a discount.';
    expect(render(prose)).toContain(prose);
  });

  it('renders nothing for empty input', () => {
    expect(renderToStaticMarkup(<MathText>{''}</MathText>)).toBe('');
    expect(renderToStaticMarkup(<MathText>{null}</MathText>)).toBe('');
  });
});
