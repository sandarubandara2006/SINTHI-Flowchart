// Runtime values and formatting shared by the evaluator, interpreter, watch
// window and console.

export type RuntimeValue = number | string | boolean | RuntimeValue[];

export class RuntimeError extends Error {}

export function typeName(v: RuntimeValue): string {
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string') return 'string';
  return 'boolean';
}

/** Format a value the way it should appear in the output console. */
export function formatValue(v: RuntimeValue): string {
  if (typeof v === 'number') return formatNumber(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return `[${v.map(formatValue).join(', ')}]`;
  return v;
}

/** Like formatValue, but quotes strings — for the watch window. */
export function formatValueDebug(v: RuntimeValue): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(formatValueDebug).join(', ')}]`;
  return formatValue(v);
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? 'Infinity' : n < 0 ? '-Infinity' : 'NaN';
  if (Number.isInteger(n)) return String(n);
  // Trim floating-point noise without forcing scientific notation.
  return String(Number(n.toFixed(10)));
}
