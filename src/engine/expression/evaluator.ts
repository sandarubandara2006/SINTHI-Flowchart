// Evaluates an expression AST against a variable scope. Pure with respect to the
// scope (reads only); the interpreter handles assignment.

import type { BinaryOp, Expr } from './ast';
import { BUILTINS, CONSTANTS } from './builtins';
import { parse } from './parser';
import { RuntimeError, type RuntimeValue, typeName } from './values';

/** A read-only view of variables for the evaluator. */
export interface Scope {
  has(name: string): boolean;
  get(name: string): RuntimeValue | undefined;
}

export function evaluate(expr: Expr, scope: Scope): RuntimeValue {
  switch (expr.type) {
    case 'num':
      return expr.value;
    case 'str':
      return expr.value;
    case 'bool':
      return expr.value;
    case 'var':
      return readVar(expr.name, scope);
    case 'index':
      return readIndex(expr, scope);
    case 'unary':
      return evalUnary(expr.op, evaluate(expr.operand, scope));
    case 'binary':
      return evalBinary(expr, scope);
    case 'call':
      return evalCall(expr.name, expr.args.map((a) => evaluate(a, scope)));
  }
}

/** Convenience: parse + evaluate a source string. Used by the interpreter. */
export function evaluateSource(src: string, scope: Scope): RuntimeValue {
  return evaluate(parse(src), scope);
}

function evalCall(name: string, args: RuntimeValue[]): RuntimeValue {
  const fn = BUILTINS[name.toLowerCase()];
  if (!fn) {
    throw new RuntimeError(`There is no function called "${name}".`);
  }
  return fn(args);
}

function readVar(name: string, scope: Scope): RuntimeValue {
  const lower = name.toLowerCase();
  if (lower in CONSTANTS) return CONSTANTS[lower];
  if (scope.has(name)) return scope.get(name)!;
  throw new RuntimeError(`Variable "${name}" has not been given a value yet.`);
}

function readIndex(
  expr: Extract<Expr, { type: 'index' }>,
  scope: Scope,
): RuntimeValue {
  const target = evaluate(expr.target, scope);
  const index = evaluate(expr.index, scope);
  if (!Array.isArray(target)) {
    throw new RuntimeError(`Cannot index a ${typeName(target)} with [].`);
  }
  if (typeof index !== 'number' || !Number.isInteger(index)) {
    throw new RuntimeError('Array indexes must be whole numbers.');
  }
  // RAPTOR arrays are 1-based.
  const elem = target[index - 1];
  if (elem === undefined) {
    throw new RuntimeError(`Array index ${index} is out of range.`);
  }
  return elem;
}

function evalUnary(op: 'neg' | 'not', v: RuntimeValue): RuntimeValue {
  if (op === 'neg') {
    if (typeof v !== 'number') {
      throw new RuntimeError(`Cannot negate a ${typeName(v)}.`);
    }
    return -v;
  }
  if (typeof v !== 'boolean') {
    throw new RuntimeError(`"not" expects true/false but got a ${typeName(v)}.`);
  }
  return !v;
}

function evalBinary(
  expr: Extract<Expr, { type: 'binary' }>,
  scope: Scope,
): RuntimeValue {
  const { op } = expr;
  // Short-circuit logical operators.
  if (op === 'and' || op === 'or') {
    const left = asBool(evaluate(expr.left, scope), op);
    if (op === 'and' && !left) return false;
    if (op === 'or' && left) return true;
    return asBool(evaluate(expr.right, scope), op);
  }

  const l = evaluate(expr.left, scope);
  const r = evaluate(expr.right, scope);
  return applyBinary(op, l, r);
}

function applyBinary(op: BinaryOp, l: RuntimeValue, r: RuntimeValue): RuntimeValue {
  switch (op) {
    case '+':
      // String concatenation if either side is text.
      if (typeof l === 'string' || typeof r === 'string') {
        return stringify(l) + stringify(r);
      }
      return arith(op, l, r);
    case '-':
    case '*':
    case '/':
    case '^':
    case 'mod':
    case 'rem':
      return arith(op, l, r);
    case '=':
      return equal(l, r);
    case '!=':
      return !equal(l, r);
    case '<':
    case '<=':
    case '>':
    case '>=':
      return compare(op, l, r);
    case 'xor':
      return asBool(l, op) !== asBool(r, op);
    default:
      throw new RuntimeError(`Unknown operator "${op}".`);
  }
}

function arith(op: BinaryOp, l: RuntimeValue, r: RuntimeValue): number {
  if (typeof l !== 'number' || typeof r !== 'number') {
    throw new RuntimeError(
      `Cannot use "${op}" on a ${typeName(l)} and a ${typeName(r)}.`,
    );
  }
  switch (op) {
    case '+':
      return l + r;
    case '-':
      return l - r;
    case '*':
      return l * r;
    case '/':
      if (r === 0) throw new RuntimeError('Cannot divide by zero.');
      return l / r;
    case '^':
      return Math.pow(l, r);
    case 'mod':
      if (r === 0) throw new RuntimeError('Cannot take mod by zero.');
      return ((l % r) + r) % r; // mathematical modulo (non-negative)
    case 'rem':
      if (r === 0) throw new RuntimeError('Cannot take remainder by zero.');
      return l % r; // sign follows the dividend
    default:
      throw new RuntimeError(`"${op}" is not an arithmetic operator.`);
  }
}

function compare(op: BinaryOp, l: RuntimeValue, r: RuntimeValue): boolean {
  if (typeof l === 'number' && typeof r === 'number') {
    return numCompare(op, l, r);
  }
  if (typeof l === 'string' && typeof r === 'string') {
    return op === '<'
      ? l < r
      : op === '<='
        ? l <= r
        : op === '>'
          ? l > r
          : l >= r;
  }
  throw new RuntimeError(
    `Cannot compare a ${typeName(l)} with a ${typeName(r)} using "${op}".`,
  );
}

function numCompare(op: BinaryOp, l: number, r: number): boolean {
  switch (op) {
    case '<':
      return l < r;
    case '<=':
      return l <= r;
    case '>':
      return l > r;
    case '>=':
      return l >= r;
    default:
      return false;
  }
}

function equal(l: RuntimeValue, r: RuntimeValue): boolean {
  if (Array.isArray(l) || Array.isArray(r)) {
    if (!Array.isArray(l) || !Array.isArray(r) || l.length !== r.length) return false;
    return l.every((x, i) => equal(x, r[i]));
  }
  return l === r;
}

function asBool(v: RuntimeValue, op: string): boolean {
  if (typeof v !== 'boolean') {
    throw new RuntimeError(`"${op}" expects true/false but got a ${typeName(v)}.`);
  }
  return v;
}

function stringify(v: RuntimeValue): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `[${v.map(stringify).join(', ')}]`;
}

export { BUILTINS };
