// Versioned JSON serialization for save/load. Keeping this isolated means the
// on-disk format can evolve (via `migrate`) without touching the editor.

import { createProgram } from './nodes';
import type { FlowchartProgram } from './types';

export const CURRENT_SCHEMA_VERSION = 1 as const;
export const FILE_EXTENSION = '.sinthi.json';

export function serialize(program: FlowchartProgram): string {
  return JSON.stringify(program, null, 2);
}

export class DeserializeError extends Error {}

/** Parse and validate a saved program, migrating older schema versions. */
export function deserialize(text: string): FlowchartProgram {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DeserializeError('File is not valid JSON.');
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new DeserializeError('File does not contain a flowchart.');
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.schemaVersion !== 'number') {
    throw new DeserializeError('File is missing a schema version.');
  }
  if (!Array.isArray(obj.body)) {
    throw new DeserializeError('File is missing the flowchart body.');
  }
  const migrated = migrate(obj);
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: typeof migrated.name === 'string' ? migrated.name : 'Untitled',
    body: migrated.body as FlowchartProgram['body'],
  };
}

/** Hook for future schema upgrades. Currently a pass-through for v1. */
function migrate(obj: Record<string, unknown>): Record<string, unknown> {
  if ((obj.schemaVersion as number) > CURRENT_SCHEMA_VERSION) {
    throw new DeserializeError(
      'This file was saved by a newer version of SINTHI. Please update.',
    );
  }
  return obj;
}

/** A fresh empty program, used by "New" and as the autosave fallback. */
export function blankProgram(): FlowchartProgram {
  return createProgram();
}
