// Steppable interpreter for a flowchart program.
//
// `execute` is a generator that yields an Effect *before* running each symbol
// (for highlighting) and whenever it needs to print output or read input. The
// driver (the store) pulls effects one at a time, which makes Step, Run-at-speed
// and Pause fall out naturally: it simply decides how long to wait between
// pulls. Input is handled by resuming the generator with the typed text.

import { parse } from './expression/parser';
import { evaluate, type Scope } from './expression/evaluator';
import { CONSTANTS } from './expression/builtins';
import { formatValue, RuntimeError, type RuntimeValue } from './expression/values';
import type { FlowchartProgram, NodeId, Statement } from '../model/types';

export type Effect =
  | { type: 'highlight'; nodeId: NodeId }
  | { type: 'output'; text: string }
  | { type: 'input'; nodeId: NodeId; prompt: string; variable: string };

/** Live variable store; the watch window renders this after each step. */
export class VariableStore implements Scope {
  private map = new Map<string, RuntimeValue>();

  has(name: string): boolean {
    return this.map.has(name.toLowerCase());
  }
  get(name: string): RuntimeValue | undefined {
    return this.map.get(name.toLowerCase());
  }
  set(name: string, value: RuntimeValue): void {
    this.map.set(name.toLowerCase(), value);
  }
  /** Snapshot for the watch window: original-cased not needed, names are lower. */
  entries(): Array<[string, RuntimeValue]> {
    return [...this.map.entries()];
  }
  clear(): void {
    this.map.clear();
  }
}

export class FlowchartRuntimeError extends Error {
  constructor(
    message: string,
    public nodeId: NodeId,
  ) {
    super(message);
  }
}

export function execute(
  program: FlowchartProgram,
  vars: VariableStore,
): Generator<Effect, void, string> {
  return execSequence(program.body, vars);
}

function* execSequence(
  seq: Statement[],
  vars: VariableStore,
): Generator<Effect, void, string> {
  for (const node of seq) {
    yield* execStatement(node, vars);
  }
}

function* execStatement(
  node: Statement,
  vars: VariableStore,
): Generator<Effect, void, string> {
  yield { type: 'highlight', nodeId: node.id };

  switch (node.kind) {
    case 'output': {
      const value = evalOrThrow(node.expression, vars, node.id);
      const text = formatValue(value) + (node.newline ? '\n' : '');
      yield { type: 'output', text };
      return;
    }

    case 'input': {
      const raw = yield {
        type: 'input',
        nodeId: node.id,
        prompt: node.prompt,
        variable: node.variable,
      };
      assign(node.variable, parseInputValue(raw), vars, node.id);
      return;
    }

    case 'assignment': {
      const value = evalOrThrow(node.expression, vars, node.id);
      assign(node.variable, value, vars, node.id);
      return;
    }

    case 'call': {
      // A bare call: evaluate for side effects / output is via Output symbols.
      evalOrThrow(node.expression, vars, node.id);
      return;
    }

    case 'selection': {
      const cond = asCondition(node.condition, vars, node.id);
      yield* execSequence(cond ? node.yes : node.no, vars);
      return;
    }

    case 'loop': {
      // RAPTOR loop: run preTest, test; true exits, false runs postTest & repeats.
      for (let guard = 0; ; guard++) {
        if (guard > 1_000_000) {
          throw new FlowchartRuntimeError(
            'The loop ran over a million times — is the condition ever true?',
            node.id,
          );
        }
        yield* execSequence(node.preTest, vars);
        yield { type: 'highlight', nodeId: node.id };
        if (asCondition(node.condition, vars, node.id)) break;
        yield* execSequence(node.postTest, vars);
      }
      return;
    }
  }
}

function evalOrThrow(src: string, vars: VariableStore, nodeId: NodeId): RuntimeValue {
  try {
    return evaluate(parse(src), vars);
  } catch (e) {
    throw new FlowchartRuntimeError(messageOf(e), nodeId);
  }
}

function asCondition(src: string, vars: VariableStore, nodeId: NodeId): boolean {
  const value = evalOrThrow(src, vars, nodeId);
  if (typeof value !== 'boolean') {
    throw new FlowchartRuntimeError(
      'A decision must be a yes/no (true/false) question.',
      nodeId,
    );
  }
  return value;
}

/** Assign to a plain variable or an array element such as `scores[i]`. */
function assign(
  targetSrc: string,
  value: RuntimeValue,
  vars: VariableStore,
  nodeId: NodeId,
): void {
  const trimmed = targetSrc.trim();
  if (trimmed === '') {
    throw new FlowchartRuntimeError('This symbol is missing a variable name.', nodeId);
  }
  if (CONSTANTS[trimmed.toLowerCase()] !== undefined) {
    throw new FlowchartRuntimeError(`"${trimmed}" is a constant and cannot change.`, nodeId);
  }

  const bracket = trimmed.indexOf('[');
  if (bracket === -1) {
    vars.set(trimmed, value);
    return;
  }

  // Indexed assignment — arrays are 1-based and auto-grow, RAPTOR-style.
  const base = trimmed.slice(0, bracket);
  let arr = vars.get(base);
  if (!Array.isArray(arr)) {
    arr = [];
    vars.set(base, arr);
  }
  const indexExpr = trimmed.slice(bracket + 1, trimmed.lastIndexOf(']'));
  let index: RuntimeValue;
  try {
    index = evaluate(parse(indexExpr), vars);
  } catch (e) {
    throw new FlowchartRuntimeError(messageOf(e), nodeId);
  }
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 1) {
    throw new FlowchartRuntimeError('Array index must be a whole number from 1 up.', nodeId);
  }
  while (arr.length < index) arr.push(0);
  arr[index - 1] = value;
}

/** Turn typed console text into a number when it looks like one, else a string. */
function parseInputValue(raw: string): RuntimeValue {
  const trimmed = raw.trim();
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return raw;
}

function messageOf(e: unknown): string {
  if (e instanceof RuntimeError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong evaluating this symbol.';
}
