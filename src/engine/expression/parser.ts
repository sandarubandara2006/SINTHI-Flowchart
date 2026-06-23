// Pratt (precedence-climbing) parser turning tokens into an expression AST.
// Keyword operators (and/or/not/mod/rem/xor) arrive as identifiers and are
// recognised here.

import type { BinaryOp, Expr } from './ast';
import { tokenize, type Token, TokenizeError } from './tokenizer';

export class ParseError extends Error {
  constructor(
    message: string,
    public pos: number,
  ) {
    super(message);
  }
}

// Higher binds tighter. Logic < comparison < additive < multiplicative < power.
const BINARY_PRECEDENCE: Record<string, number> = {
  or: 1,
  xor: 1,
  and: 2,
  '=': 3,
  '!=': 3,
  '<': 3,
  '<=': 3,
  '>': 3,
  '>=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  mod: 5,
  rem: 5,
  '^': 6,
};
const RIGHT_ASSOC = new Set(['^']);

/** Normalize the surface spellings students may type to canonical operators. */
function normalizeBinaryOp(value: string): BinaryOp | undefined {
  switch (value) {
    case '==':
      return '=';
    case '<>':
    case '/=':
      return '!=';
    case '=':
    case '!=':
    case '<':
    case '<=':
    case '>':
    case '>=':
    case '+':
    case '-':
    case '*':
    case '/':
    case '^':
      return value;
    case '%':
      return 'mod';
    case 'mod':
    case 'rem':
    case 'and':
    case 'or':
    case 'xor':
      return value;
    default:
      return undefined;
  }
}

export function parse(src: string): Expr {
  let tokens: Token[];
  try {
    tokens = tokenize(src);
  } catch (e) {
    if (e instanceof TokenizeError) throw new ParseError(e.message, e.pos);
    throw e;
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function opName(t: Token): string | undefined {
    if (t.type === 'op') return normalizeBinaryOp(t.value);
    if (t.type === 'ident') {
      const lower = t.value.toLowerCase();
      if (lower in BINARY_PRECEDENCE) return lower;
    }
    return undefined;
  }

  function parseExpr(minPrec: number): Expr {
    let left = parsePrefix();

    for (;;) {
      const t = peek();
      const op = opName(t);
      if (op === undefined) break;
      const prec = BINARY_PRECEDENCE[op];
      if (prec < minPrec) break;
      next();
      const nextMin = RIGHT_ASSOC.has(op) ? prec : prec + 1;
      const right = parseExpr(nextMin);
      left = { type: 'binary', op: op as BinaryOp, left, right };
    }
    return left;
  }

  function parsePrefix(): Expr {
    const t = peek();
    if (t.type === 'op' && t.value === '-') {
      next();
      return { type: 'unary', op: 'neg', operand: parseExpr(6) };
    }
    if (t.type === 'op' && t.value === '+') {
      next();
      return parseExpr(6);
    }
    if (t.type === 'ident' && t.value.toLowerCase() === 'not') {
      next();
      return { type: 'unary', op: 'not', operand: parseExpr(2) };
    }
    return parsePostfix(parsePrimary());
  }

  // Array indexing: primary followed by [expr], chainable for 2-D arrays.
  function parsePostfix(target: Expr): Expr {
    let result = target;
    while (peek().type === 'lbracket') {
      next();
      const index = parseExpr(0);
      expect('rbracket', 'Expected "]" to close the array index.');
      result = { type: 'index', target: result, index };
    }
    return result;
  }

  function parsePrimary(): Expr {
    const t = next();
    switch (t.type) {
      case 'number':
        return { type: 'num', value: Number(t.value) };
      case 'string':
        return { type: 'str', value: t.value };
      case 'lparen': {
        const inner = parseExpr(0);
        expect('rparen', 'Expected a closing ")".');
        return inner;
      }
      case 'ident': {
        const lower = t.value.toLowerCase();
        if (lower === 'true') return { type: 'bool', value: true };
        if (lower === 'false') return { type: 'bool', value: false };
        if (peek().type === 'lparen') {
          next();
          const args = parseArgs();
          return { type: 'call', name: lower, args };
        }
        return { type: 'var', name: t.value };
      }
      case 'eof':
        throw new ParseError('The expression is incomplete.', t.pos);
      default:
        throw new ParseError(`Unexpected "${t.value}".`, t.pos);
    }
  }

  function parseArgs(): Expr[] {
    const args: Expr[] = [];
    if (peek().type === 'rparen') {
      next();
      return args;
    }
    for (;;) {
      args.push(parseExpr(0));
      const t = next();
      if (t.type === 'rparen') break;
      if (t.type !== 'comma') {
        throw new ParseError('Expected "," or ")" in the function call.', t.pos);
      }
    }
    return args;
  }

  function expect(type: Token['type'], message: string): Token {
    const t = next();
    if (t.type !== type) throw new ParseError(message, t.pos);
    return t;
  }

  const result = parseExpr(0);
  const trailing = peek();
  if (trailing.type !== 'eof') {
    throw new ParseError(`Unexpected "${trailing.value}".`, trailing.pos);
  }
  return result;
}
