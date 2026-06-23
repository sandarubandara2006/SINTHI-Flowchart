// Tokenizer for the expression language used in assignments, conditions and
// output. Kept deliberately small — the language is arithmetic, comparison,
// logic, string literals, variables and function calls.

export type TokenType =
  | 'number'
  | 'string'
  | 'ident'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'lbracket'
  | 'rbracket'
  | 'comma'
  | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  /** Start column in the source, for error highlighting. */
  pos: number;
}

export class TokenizeError extends Error {
  constructor(
    message: string,
    public pos: number,
  ) {
    super(message);
  }
}

// Multi-character operators must be tested before single-character ones.
const MULTI_OPS = ['<=', '>=', '!=', '/=', '==', '<>'];
const SINGLE_OPS = ['+', '-', '*', '/', '^', '<', '>', '=', '%'];

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch, pos: i++ });
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch, pos: i++ });
      continue;
    }
    if (ch === '[') {
      tokens.push({ type: 'lbracket', value: ch, pos: i++ });
      continue;
    }
    if (ch === ']') {
      tokens.push({ type: 'rbracket', value: ch, pos: i++ });
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ch, pos: i++ });
      continue;
    }

    // String literal — single or double quoted, no escapes needed for students.
    if (ch === '"' || ch === "'") {
      const start = i;
      const quote = ch;
      i++;
      let value = '';
      while (i < src.length && src[i] !== quote) {
        value += src[i++];
      }
      if (i >= src.length) {
        throw new TokenizeError('Unterminated text in quotes.', start);
      }
      i++; // closing quote
      tokens.push({ type: 'string', value, pos: start });
      continue;
    }

    // Number — integer or decimal.
    if (isDigit(ch) || (ch === '.' && isDigit(src[i + 1] ?? ''))) {
      const start = i;
      while (i < src.length && isDigit(src[i])) i++;
      if (src[i] === '.') {
        i++;
        while (i < src.length && isDigit(src[i])) i++;
      }
      tokens.push({ type: 'number', value: src.slice(start, i), pos: start });
      continue;
    }

    // Identifier / keyword — letters, digits, underscore (must start non-digit).
    if (isIdentStart(ch)) {
      const start = i;
      while (i < src.length && isIdentPart(src[i])) i++;
      tokens.push({ type: 'ident', value: src.slice(start, i), pos: start });
      continue;
    }

    // Operators.
    const two = src.slice(i, i + 2);
    if (MULTI_OPS.includes(two)) {
      tokens.push({ type: 'op', value: two, pos: i });
      i += 2;
      continue;
    }
    if (SINGLE_OPS.includes(ch)) {
      tokens.push({ type: 'op', value: ch, pos: i++ });
      continue;
    }

    throw new TokenizeError(`Unexpected character "${ch}".`, i);
  }

  tokens.push({ type: 'eof', value: '', pos: src.length });
  return tokens;
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}
function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}
function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}
