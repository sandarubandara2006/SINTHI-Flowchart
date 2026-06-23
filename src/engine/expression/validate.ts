// Static checks used by the symbol editors to give live feedback before a chart
// is ever run.

import { parse, ParseError } from './parser';

export interface ValidationResult {
  ok: boolean;
  /** Error message when not ok. */
  message?: string;
  /** Source column of the problem, when known. */
  pos?: number;
}

const VALID: ValidationResult = { ok: true };

/** Validate that `src` is a syntactically well-formed expression. */
export function validateExpression(src: string): ValidationResult {
  if (src.trim() === '') {
    return { ok: false, message: 'This expression is empty.' };
  }
  try {
    parse(src);
    return VALID;
  } catch (e) {
    if (e instanceof ParseError) return { ok: false, message: e.message, pos: e.pos };
    return { ok: false, message: 'This expression could not be understood.' };
  }
}

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = new Set([
  'and',
  'or',
  'not',
  'xor',
  'mod',
  'rem',
  'true',
  'false',
  'pi',
  'e',
]);

/** Validate a variable name for an Input or the target of an Assignment. */
export function validateVariableName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (trimmed === '') return { ok: false, message: 'Please enter a variable name.' };
  if (!IDENT_RE.test(trimmed)) {
    return {
      ok: false,
      message: 'Use letters, digits and underscores; start with a letter.',
    };
  }
  if (RESERVED.has(trimmed.toLowerCase())) {
    return { ok: false, message: `"${trimmed}" is a reserved word.` };
  }
  return VALID;
}

/**
 * Validate an assignment *target* — a plain variable or an array element such
 * as `scores[i]`. Returns ok plus the base variable name when valid.
 */
export function validateAssignTarget(
  src: string,
): ValidationResult & { baseName?: string } {
  const trimmed = src.trim();
  const bracket = trimmed.indexOf('[');
  if (bracket === -1) {
    const base = validateVariableName(trimmed);
    return base.ok ? { ok: true, baseName: trimmed } : base;
  }
  const base = trimmed.slice(0, bracket);
  const nameResult = validateVariableName(base);
  if (!nameResult.ok) return nameResult;
  // The index part must parse as an expression: e.g. `[i]`, `[i][j]`.
  const indexPart = trimmed.slice(bracket);
  if (!/^(\[[^\]]*\])+$/.test(indexPart)) {
    return { ok: false, message: 'Array index must look like name[expression].' };
  }
  for (const m of indexPart.matchAll(/\[([^\]]*)\]/g)) {
    const inner = validateExpression(m[1]);
    if (!inner.ok) return inner;
  }
  return { ok: true, baseName: base };
}
