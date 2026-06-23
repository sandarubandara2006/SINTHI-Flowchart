// Expression AST shared by the parser and evaluator.

export type Expr =
  | { type: 'num'; value: number }
  | { type: 'str'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'var'; name: string }
  | { type: 'index'; target: Expr; index: Expr } // array element: a[i]
  | { type: 'unary'; op: UnaryOp; operand: Expr }
  | { type: 'binary'; op: BinaryOp; left: Expr; right: Expr }
  | { type: 'call'; name: string; args: Expr[] };

export type UnaryOp = 'neg' | 'not';

export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '^'
  | 'mod'
  | 'rem'
  | '='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'and'
  | 'or'
  | 'xor';
