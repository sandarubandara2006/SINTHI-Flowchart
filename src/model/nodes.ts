// Factories and tree-manipulation helpers for the flowchart model.
//
// The store wraps mutations with immer, so the helpers here are written to
// operate directly on a draft tree: `resolveSequence` returns the live array
// reference, and callers `.splice()` it.

import type {
  FlowchartProgram,
  InsertionPoint,
  NodeId,
  SequenceLocation,
  Statement,
  StatementKind,
} from './types';

let idCounter = 0;
/** Stable-enough unique id. crypto.randomUUID when available, else a counter. */
export function newId(): NodeId {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  idCounter += 1;
  return `n${idCounter}_${Date.now().toString(36)}`;
}

/** Create a blank statement of the given kind, ready for the user to edit. */
export function createStatement(kind: StatementKind): Statement {
  const id = newId();
  switch (kind) {
    case 'input':
      return { id, kind, prompt: 'Enter a value', variable: '' };
    case 'output':
      return { id, kind, expression: '""', newline: true };
    case 'assignment':
      return { id, kind, variable: '', expression: '' };
    case 'call':
      return { id, kind, expression: '' };
    case 'selection':
      return { id, kind, condition: '', yes: [], no: [] };
    case 'loop':
      return { id, kind, preTest: [], condition: '', postTest: [] };
  }
}

export function createProgram(name = 'Untitled'): FlowchartProgram {
  return { schemaVersion: 1, name, body: [] };
}

/** Return the live sequence array addressed by `location` (mutable on drafts). */
export function resolveSequence(
  program: FlowchartProgram,
  location: SequenceLocation,
): Statement[] | undefined {
  if (location.type === 'root') return program.body;
  const owner = findNode(program, location.nodeId)?.node;
  if (!owner) return undefined;
  if (location.type === 'branch' && owner.kind === 'selection') {
    return owner[location.branch];
  }
  if (location.type === 'loop' && owner.kind === 'loop') {
    return owner[location.slot];
  }
  return undefined;
}

export interface FoundNode {
  node: Statement;
  parent: Statement[];
  index: number;
  location: SequenceLocation;
}

/** Depth-first search for a node by id, returning it plus where it lives. */
export function findNode(
  program: FlowchartProgram,
  id: NodeId,
): FoundNode | undefined {
  return search(program.body, { type: 'root' });

  function search(
    seq: Statement[],
    location: SequenceLocation,
  ): FoundNode | undefined {
    for (let index = 0; index < seq.length; index++) {
      const node = seq[index];
      if (node.id === id) return { node, parent: seq, index, location };
      const child = searchChildren(node);
      if (child) return child;
    }
    return undefined;
  }

  function searchChildren(node: Statement): FoundNode | undefined {
    if (node.kind === 'selection') {
      return (
        search(node.yes, { type: 'branch', nodeId: node.id, branch: 'yes' }) ??
        search(node.no, { type: 'branch', nodeId: node.id, branch: 'no' })
      );
    }
    if (node.kind === 'loop') {
      return (
        search(node.preTest, {
          type: 'loop',
          nodeId: node.id,
          slot: 'preTest',
        }) ??
        search(node.postTest, {
          type: 'loop',
          nodeId: node.id,
          slot: 'postTest',
        })
      );
    }
    return undefined;
  }
}

/** Insert a statement at an insertion point. Mutates a draft program. */
export function insertStatement(
  program: FlowchartProgram,
  at: InsertionPoint,
  node: Statement,
): boolean {
  const seq = resolveSequence(program, at.location);
  if (!seq) return false;
  const index = Math.max(0, Math.min(at.index, seq.length));
  seq.splice(index, 0, node);
  return true;
}

/** Remove a statement (and its sub-tree) by id. Mutates a draft program. */
export function removeStatement(
  program: FlowchartProgram,
  id: NodeId,
): boolean {
  const found = findNode(program, id);
  if (!found) return false;
  found.parent.splice(found.index, 1);
  return true;
}

/** True if `ancestorId` contains `descendantId` (or they are the same node). */
export function isAncestor(
  program: FlowchartProgram,
  ancestorId: NodeId,
  descendantId: NodeId,
): boolean {
  if (ancestorId === descendantId) return true;
  const found = findNode(program, ancestorId);
  if (!found) return false;
  return !!findNode({ ...program, body: childSequences(found.node) }, descendantId);
}

function childSequences(node: Statement): Statement[] {
  if (node.kind === 'selection') return [...node.yes, ...node.no];
  if (node.kind === 'loop') return [...node.preTest, ...node.postTest];
  return [];
}
