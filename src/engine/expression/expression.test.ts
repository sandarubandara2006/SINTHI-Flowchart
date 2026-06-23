import { describe, expect, it } from 'vitest';
import { evaluateSource, type Scope } from './evaluator';
import { parse, ParseError } from './parser';
import { validateExpression, validateVariableName } from './validate';
import { formatValue, type RuntimeValue } from './values';

function scopeOf(vars: Record<string, RuntimeValue>): Scope {
  return {
    has: (n) => n in vars,
    get: (n) => vars[n],
  };
}

const evalStr = (src: string, vars: Record<string, RuntimeValue> = {}) =>
  evaluateSource(src, scopeOf(vars));

describe('arithmetic', () => {
  it('respects precedence and associativity', () => {
    expect(evalStr('2 + 3 * 4')).toBe(14);
    expect(evalStr('(2 + 3) * 4')).toBe(20);
    expect(evalStr('2 ^ 3 ^ 2')).toBe(512); // right associative
    expect(evalStr('-2 ^ 2')).toBe(-4); // unary minus binds looser than ^
  });

  it('handles mod and rem with sign rules', () => {
    expect(evalStr('7 mod 3')).toBe(1);
    expect(evalStr('-1 mod 3')).toBe(2); // mathematical modulo
    expect(evalStr('-1 rem 3')).toBe(-1); // sign of dividend
  });

  it('reports divide by zero', () => {
    expect(() => evalStr('5 / 0')).toThrow('Cannot divide by zero.');
  });
});

describe('strings and booleans', () => {
  it('concatenates with +', () => {
    expect(evalStr('"Sum = " + 15')).toBe('Sum = 15');
    expect(evalStr('"a" + "b" + "c"')).toBe('abc');
  });

  it('evaluates comparisons and logic with short-circuit', () => {
    expect(evalStr('3 < 5 and 5 <= 5')).toBe(true);
    expect(evalStr('not (1 = 2)')).toBe(true);
    expect(evalStr('false and undefined_var')).toBe(false); // short-circuits
    expect(evalStr('true or undefined_var')).toBe(true);
  });
});

describe('variables, builtins and arrays', () => {
  it('reads variables and constants', () => {
    expect(evalStr('n * 2', { n: 21 })).toBe(42);
    expect(Math.round(evalStr('pi') as number)).toBe(3);
  });

  it('calls built-in functions', () => {
    expect(evalStr('sqrt(16)')).toBe(4);
    expect(evalStr('floor(3.7) + ceiling(3.2)')).toBe(7);
    expect(evalStr('length_of("hello")')).toBe(5);
  });

  it('indexes 1-based arrays', () => {
    expect(evalStr('a[2]', { a: [10, 20, 30] })).toBe(20);
    expect(() => evalStr('a[9]', { a: [1] })).toThrow('out of range');
  });

  it('errors on undefined variables', () => {
    expect(() => evalStr('mystery + 1')).toThrow('has not been given a value');
  });
});

describe('formatValue', () => {
  it('prints values the way the console should', () => {
    expect(formatValue(15)).toBe('15');
    expect(formatValue(3.5)).toBe('3.5');
    expect(formatValue(true)).toBe('true');
    expect(formatValue([1, 2, 3])).toBe('[1, 2, 3]');
  });
});

describe('validation', () => {
  it('flags malformed expressions', () => {
    expect(validateExpression('2 +').ok).toBe(false);
    expect(validateExpression('(1 + 2').ok).toBe(false);
    expect(validateExpression('2 + 3').ok).toBe(true);
  });

  it('flags bad variable names', () => {
    expect(validateVariableName('1abc').ok).toBe(false);
    expect(validateVariableName('and').ok).toBe(false);
    expect(validateVariableName('total_sum').ok).toBe(true);
  });

  it('throws ParseError with a position', () => {
    try {
      parse('1 +');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
    }
  });
});
