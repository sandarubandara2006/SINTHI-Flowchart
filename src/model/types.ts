// The flowchart data model.
//
// A program is a *structured* flowchart: a sequence of statements that runs
// between an implicit Start and End. Branches (Selection) and loops (Loop) nest
// child sequences inside them. Because the structure is a tree by construction,
// it is always a valid, runnable program — there is no way to draw a dangling or
// crossed arrow.

export type NodeId = string;

export type StatementKind =
  | 'input'
  | 'output'
  | 'assignment'
  | 'call'
  | 'selection'
  | 'loop';

interface BaseNode {
  id: NodeId;
}

/** Read a value from the user into a variable (parallelogram). */
export interface InputNode extends BaseNode {
  kind: 'input';
  prompt: string;
  variable: string;
}

/** Print an expression to the console (parallelogram). */
export interface OutputNode extends BaseNode {
  kind: 'output';
  expression: string;
  newline: boolean;
}

/** Assign an expression to a variable: `variable <- expression` (rectangle). */
export interface AssignmentNode extends BaseNode {
  kind: 'assignment';
  variable: string;
  expression: string;
}

/** Call a built-in procedure or sub-chart (rectangle with side bars). */
export interface CallNode extends BaseNode {
  kind: 'call';
  expression: string;
}

/** If/else branch (diamond). `yes` runs when the condition is true. */
export interface SelectionNode extends BaseNode {
  kind: 'selection';
  condition: string;
  yes: Statement[];
  no: Statement[];
}

/**
 * Loop (oval + diamond). RAPTOR-exact semantics:
 *   enter -> run `preTest` -> evaluate `condition`
 *     true  => exit the loop
 *     false => run `postTest`, then back to the top of `preTest`
 * Either body half may be empty, giving while-style, do-until-style, or
 * mid-test loops from the one structure.
 */
export interface LoopNode extends BaseNode {
  kind: 'loop';
  preTest: Statement[];
  condition: string;
  postTest: Statement[];
}

export type Statement =
  | InputNode
  | OutputNode
  | AssignmentNode
  | CallNode
  | SelectionNode
  | LoopNode;

// A partial update to one statement. `Partial<Statement>` over a union only
// keeps the keys common to every member (id, kind), so we distribute Partial
// across the union to allow patching kind-specific fields like `prompt`.
type DistributePartial<T> = T extends unknown ? Partial<T> : never;
export type StatementPatch = DistributePartial<Statement>;

export interface FlowchartProgram {
  schemaVersion: 1;
  name: string;
  /** Statements between the implicit Start and End symbols. */
  body: Statement[];
}

/**
 * Addresses a child sequence (a `Statement[]`) anywhere in the tree. Used to
 * locate where a symbol should be inserted or which list a node lives in.
 */
export type SequenceLocation =
  | { type: 'root' }
  | { type: 'branch'; nodeId: NodeId; branch: 'yes' | 'no' }
  | { type: 'loop'; nodeId: NodeId; slot: 'preTest' | 'postTest' };

/** A concrete insertion point: index `index` within sequence `location`. */
export interface InsertionPoint {
  location: SequenceLocation;
  index: number;
}
