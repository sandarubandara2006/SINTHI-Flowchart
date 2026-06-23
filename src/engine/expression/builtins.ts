// Built-in functions and constants available in expressions. Mirrors the common
// RAPTOR set so coursework written for RAPTOR behaves the same here.

import { RuntimeError, type RuntimeValue, typeName } from './values';

export const CONSTANTS: Record<string, RuntimeValue> = {
  pi: Math.PI,
  e: Math.E,
  true: true,
  false: false,
};

type Fn = (args: RuntimeValue[]) => RuntimeValue;

function num(v: RuntimeValue, fn: string): number {
  if (typeof v !== 'number') {
    throw new RuntimeError(`${fn} expects a number but got a ${typeName(v)}.`);
  }
  return v;
}

function arity(name: string, args: RuntimeValue[], n: number): void {
  if (args.length !== n) {
    throw new RuntimeError(
      `${name} expects ${n} argument${n === 1 ? '' : 's'}, got ${args.length}.`,
    );
  }
}

export const BUILTINS: Record<string, Fn> = {
  // Math
  sqrt: (a) => (arity('sqrt', a, 1), Math.sqrt(num(a[0], 'sqrt'))),
  abs: (a) => (arity('abs', a, 1), Math.abs(num(a[0], 'abs'))),
  floor: (a) => (arity('floor', a, 1), Math.floor(num(a[0], 'floor'))),
  ceiling: (a) => (arity('ceiling', a, 1), Math.ceil(num(a[0], 'ceiling'))),
  round: (a) => (arity('round', a, 1), Math.round(num(a[0], 'round'))),
  log: (a) => (arity('log', a, 1), Math.log(num(a[0], 'log'))), // natural log
  log10: (a) => (arity('log10', a, 1), Math.log10(num(a[0], 'log10'))),
  exp: (a) => (arity('exp', a, 1), Math.exp(num(a[0], 'exp'))),
  sin: (a) => (arity('sin', a, 1), Math.sin(num(a[0], 'sin'))),
  cos: (a) => (arity('cos', a, 1), Math.cos(num(a[0], 'cos'))),
  tan: (a) => (arity('tan', a, 1), Math.tan(num(a[0], 'tan'))),
  arcsin: (a) => (arity('arcsin', a, 1), Math.asin(num(a[0], 'arcsin'))),
  arccos: (a) => (arity('arccos', a, 1), Math.acos(num(a[0], 'arccos'))),
  arctan: (a) => (arity('arctan', a, 1), Math.atan(num(a[0], 'arctan'))),
  power: (a) => (arity('power', a, 2), Math.pow(num(a[0], 'power'), num(a[1], 'power'))),
  max: (a) => (arity('max', a, 2), Math.max(num(a[0], 'max'), num(a[1], 'max'))),
  min: (a) => (arity('min', a, 2), Math.min(num(a[0], 'min'), num(a[1], 'min'))),

  // A random integer in [0, n) like RAPTOR's Random function; no arg gives [0,1).
  random: (a) => {
    if (a.length === 0) return Math.random();
    arity('random', a, 1);
    return Math.floor(Math.random() * num(a[0], 'random'));
  },

  // String / collection helpers
  length_of: (a) => {
    arity('length_of', a, 1);
    const v = a[0];
    if (typeof v === 'string' || Array.isArray(v)) return v.length;
    throw new RuntimeError(`length_of expects text or an array, got a ${typeName(v)}.`);
  },
  to_number: (a) => {
    arity('to_number', a, 1);
    const v = a[0];
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v.trim());
      if (Number.isNaN(n)) throw new RuntimeError(`Cannot convert "${v}" to a number.`);
      return n;
    }
    throw new RuntimeError(`to_number cannot convert a ${typeName(v)}.`);
  },
};

export function isBuiltin(name: string): boolean {
  return name.toLowerCase() in BUILTINS;
}
export function isConstant(name: string): boolean {
  return name.toLowerCase() in CONSTANTS;
}
