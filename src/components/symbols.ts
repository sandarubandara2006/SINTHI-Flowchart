// Shared presentation metadata for the six statement symbols.

import type { StatementKind } from '../model/types';

export interface SymbolMeta {
  kind: StatementKind;
  title: string;
  blurb: string;
  fill: string;
  stroke: string;
}

export const SYMBOLS: SymbolMeta[] = [
  {
    kind: 'input',
    title: 'Input',
    blurb: 'Read a value typed by the user into a variable.',
    fill: '#dbeafe',
    stroke: '#3b82f6',
  },
  {
    kind: 'output',
    title: 'Output',
    blurb: 'Print text or a value to the console.',
    fill: '#dbeafe',
    stroke: '#3b82f6',
  },
  {
    kind: 'assignment',
    title: 'Assignment',
    blurb: 'Give a variable a value, e.g. total ← total + 1.',
    fill: '#dcfce7',
    stroke: '#22c55e',
  },
  {
    kind: 'call',
    title: 'Call',
    blurb: 'Run a procedure for its effect.',
    fill: '#fef9c3',
    stroke: '#eab308',
  },
  {
    kind: 'selection',
    title: 'Selection',
    blurb: 'Choose between two paths (if / else).',
    fill: '#fae8ff',
    stroke: '#d946ef',
  },
  {
    kind: 'loop',
    title: 'Loop',
    blurb: 'Repeat until a condition becomes true.',
    fill: '#ffedd5',
    stroke: '#f97316',
  },
];

export const SYMBOL_BY_KIND: Record<StatementKind, SymbolMeta> = Object.fromEntries(
  SYMBOLS.map((s) => [s.kind, s]),
) as Record<StatementKind, SymbolMeta>;

/** dataTransfer MIME type used for palette drag-and-drop. */
export const DRAG_MIME = 'application/x-sinthi-symbol';
