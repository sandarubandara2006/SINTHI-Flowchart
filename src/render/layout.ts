// Automatic layout for a structured flowchart.
//
// Layout is recursive. Each statement becomes a `Box` that knows its size, its
// connection axis `cx` (the x where the incoming arrow enters the top and the
// outgoing arrow leaves the bottom — they share one vertical line), and how to
// `emit` its absolute shapes/connectors at a given offset. A sequence stacks
// boxes and aligns them on a common axis; selection and loop arrange child
// sequences with elbow connectors. The Canvas just draws the flat result.

import type {
  FlowchartProgram,
  InsertionPoint,
  NodeId,
  SequenceLocation,
  Statement,
} from '../model/types';

// ---- Tunable geometry -------------------------------------------------------
export const SYMBOL_W = 150;
export const SYMBOL_H = 54;
export const DIAMOND_W = 160;
export const DIAMOND_H = 84;
export const TERMINAL_W = 110;
export const TERMINAL_H = 44;
const V_GAP = 38; // vertical space between stacked symbols (holds an arrow + '+')
const BRANCH_GAP = 36; // horizontal gap between the two columns of a selection
const LOOP_LEFT = 34; // room on the left for the loop-back line
const LOOP_RIGHT = 44; // room on the right for the loop-exit line
const EMPTY_W = 70; // width of an empty branch/body stub
const EMPTY_H = 30;
const PAD = 24; // outer padding around the whole chart

export type ShapeKind =
  | 'start'
  | 'end'
  | 'input'
  | 'output'
  | 'assignment'
  | 'call'
  | 'selection'
  | 'loop';

export interface LaidOutShape {
  nodeId: NodeId | 'start' | 'end';
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface LaidOutConnector {
  points: Array<[number, number]>;
  arrow: boolean;
  label?: string;
}

export interface LaidOutInsertion {
  location: SequenceLocation;
  index: number;
  x: number;
  y: number;
}

export interface LayoutResult {
  width: number;
  height: number;
  shapes: LaidOutShape[];
  connectors: LaidOutConnector[];
  insertions: LaidOutInsertion[];
}

interface Box {
  width: number;
  height: number;
  cx: number;
  emit: (ox: number, oy: number, out: LayoutResult) => void;
}

const emptyResult = (): LayoutResult => ({
  width: 0,
  height: 0,
  shapes: [],
  connectors: [],
  insertions: [],
});

/** Compute the full layout of a program, including Start/End terminals. */
export function layoutProgram(program: FlowchartProgram): LayoutResult {
  const body = layoutSequence(program.body, { type: 'root' });

  const start: Box = terminalBox('start', 'Start');
  const end: Box = terminalBox('end', 'End');

  // Stack: Start -> body -> End, aligned on the body axis.
  const cx = Math.max(start.cx, body.cx, end.cx);
  const width = Math.max(start.width, body.width, end.width) + PAD * 2;
  const out = emptyResult();

  let y = PAD;
  const place = (box: Box) => {
    const ox = PAD + cx - box.cx;
    box.emit(ox, y, out);
    return { topY: y, bottomY: y + box.height, axisX: PAD + cx };
  };

  const startPos = place(start);
  y = startPos.bottomY + V_GAP;
  connectV(out, startPos.axisX, startPos.bottomY, y, false);
  const bodyPos = place(body);
  y = bodyPos.bottomY + V_GAP;
  connectV(out, bodyPos.axisX, bodyPos.bottomY, y, false);
  const endPos = place(end);

  out.width = width;
  out.height = endPos.bottomY + PAD;
  return out;
}

// ---- Sequence ---------------------------------------------------------------

function layoutSequence(seq: Statement[], location: SequenceLocation): Box {
  if (seq.length === 0) return emptySequenceBox(location);

  const boxes = seq.map((s) => layoutStatement(s));
  const leftMax = Math.max(...boxes.map((b) => b.cx));
  const rightMax = Math.max(...boxes.map((b) => b.width - b.cx));
  const cx = leftMax;
  const width = leftMax + rightMax;

  // Total height: boxes plus a V_GAP between each (the gaps hold insertion '+'s).
  const height =
    boxes.reduce((h, b) => h + b.height, 0) + V_GAP * (boxes.length + 1);

  return {
    width,
    height,
    cx,
    emit(ox, oy, out) {
      const axis = ox + cx;
      let y = oy;
      // Insertion point before the first symbol.
      addInsertion(out, location, 0, axis, y + V_GAP / 2);
      boxes.forEach((box, i) => {
        const top = y + V_GAP;
        box.emit(ox + cx - box.cx, top, out);
        // Arrow into this box.
        connectV(out, axis, y, top, i === 0 ? false : true);
        y = top + box.height;
        // Insertion point after this symbol.
        addInsertion(out, location, i + 1, axis, y + V_GAP / 2);
      });
      // Arrow leaving the sequence.
      connectV(out, axis, y, y + V_GAP, true);
    },
  };
}

function emptySequenceBox(location: SequenceLocation): Box {
  return {
    width: EMPTY_W,
    height: EMPTY_H,
    cx: EMPTY_W / 2,
    emit(ox, oy, out) {
      const axis = ox + EMPTY_W / 2;
      connectV(out, axis, oy, oy + EMPTY_H, false);
      addInsertion(out, location, 0, axis, oy + EMPTY_H / 2);
    },
  };
}

// ---- Individual statements --------------------------------------------------

function layoutStatement(node: Statement): Box {
  switch (node.kind) {
    case 'selection':
      return layoutSelection(node);
    case 'loop':
      return layoutLoop(node);
    default:
      return simpleBox(node);
  }
}

function simpleBox(node: Statement): Box {
  return {
    width: SYMBOL_W,
    height: SYMBOL_H,
    cx: SYMBOL_W / 2,
    emit(ox, oy, out) {
      out.shapes.push({
        nodeId: node.id,
        kind: node.kind as ShapeKind,
        x: ox,
        y: oy,
        w: SYMBOL_W,
        h: SYMBOL_H,
        label: labelFor(node),
      });
    },
  };
}

function terminalBox(kind: 'start' | 'end', label: string): Box {
  return {
    width: TERMINAL_W,
    height: TERMINAL_H,
    cx: TERMINAL_W / 2,
    emit(ox, oy, out) {
      out.shapes.push({
        nodeId: kind,
        kind,
        x: ox,
        y: oy,
        w: TERMINAL_W,
        h: TERMINAL_H,
        label,
      });
    },
  };
}

function layoutSelection(node: Statement & { kind: 'selection' }): Box {
  const yes = layoutSequence(node.yes, {
    type: 'branch',
    nodeId: node.id,
    branch: 'yes',
  });
  const no = layoutSequence(node.no, {
    type: 'branch',
    nodeId: node.id,
    branch: 'no',
  });

  // Two columns side by side; diamond centered above the pair.
  const yesOriginX = 0;
  const noOriginX = yes.width + BRANCH_GAP;
  const yesAxis = yesOriginX + yes.cx;
  const noAxis = noOriginX + no.cx;

  const columnsWidth = no.width + noOriginX;
  const axis = (yesAxis + noAxis) / 2; // diamond centered between the two columns
  const width = Math.max(columnsWidth, axis + DIAMOND_W / 2, DIAMOND_W);
  const branchTop = DIAMOND_H + V_GAP;
  const columnsHeight = Math.max(yes.height, no.height);
  const height = branchTop + columnsHeight + V_GAP; // + rejoin gap

  return {
    width,
    height,
    cx: axis,
    emit(ox, oy, out) {
      const dx = ox + axis;
      // Diamond.
      out.shapes.push({
        nodeId: node.id,
        kind: 'selection',
        x: dx - DIAMOND_W / 2,
        y: oy,
        w: DIAMOND_W,
        h: DIAMOND_H,
        label: labelFor(node),
      });

      const colY = oy + branchTop;
      const yesAxisAbs = ox + yesAxis;
      const noAxisAbs = ox + noAxis;

      // Branch connectors from diamond left/right vertices.
      out.connectors.push({
        points: [
          [dx - DIAMOND_W / 2, oy + DIAMOND_H / 2],
          [yesAxisAbs, oy + DIAMOND_H / 2],
          [yesAxisAbs, colY],
        ],
        arrow: true,
        label: 'Yes',
      });
      out.connectors.push({
        points: [
          [dx + DIAMOND_W / 2, oy + DIAMOND_H / 2],
          [noAxisAbs, oy + DIAMOND_H / 2],
          [noAxisAbs, colY],
        ],
        arrow: true,
        label: 'No',
      });

      yes.emit(ox + yesOriginX, colY, out);
      no.emit(ox + noOriginX, colY, out);

      // Rejoin: both columns drop to the rejoin line and merge at the axis.
      const rejoinY = oy + height;
      const yesBottom = colY + yes.height;
      const noBottom = colY + no.height;
      out.connectors.push({
        points: [
          [yesAxisAbs, yesBottom],
          [yesAxisAbs, rejoinY],
          [dx, rejoinY],
        ],
        arrow: false,
      });
      out.connectors.push({
        points: [
          [noAxisAbs, noBottom],
          [noAxisAbs, rejoinY],
          [dx, rejoinY],
        ],
        arrow: false,
      });
    },
  };
}

function layoutLoop(node: Statement & { kind: 'loop' }): Box {
  const pre = layoutSequence(node.preTest, {
    type: 'loop',
    nodeId: node.id,
    slot: 'preTest',
  });
  const post = layoutSequence(node.postTest, {
    type: 'loop',
    nodeId: node.id,
    slot: 'postTest',
  });

  const innerW = Math.max(pre.width, post.width, DIAMOND_W);
  const innerCx = innerW / 2;
  const width = LOOP_LEFT + innerW + LOOP_RIGHT;
  const cx = LOOP_LEFT + innerCx;

  const preTop = V_GAP; // small gap below entry junction for the loop-back arrow
  const diamondTop = preTop + pre.height + V_GAP;
  const postTop = diamondTop + DIAMOND_H + V_GAP;
  const height = postTop + post.height + V_GAP;

  return {
    width,
    height,
    cx,
    emit(ox, oy, out) {
      const axis = ox + cx;
      const entryY = oy;

      // preTest
      const preY = oy + preTop;
      connectV(out, axis, entryY, preY, false);
      pre.emit(ox + cx - pre.cx, preY, out);
      const preBottom = preY + pre.height;

      // diamond test
      const dy = oy + diamondTop;
      connectV(out, axis, preBottom, dy, true);
      out.shapes.push({
        nodeId: node.id,
        kind: 'loop',
        x: axis - DIAMOND_W / 2,
        y: dy,
        w: DIAMOND_W,
        h: DIAMOND_H,
        label: labelFor(node),
      });

      // "Yes" exits to the right, down the right margin, to the bottom exit.
      const exitX = ox + width - LOOP_RIGHT / 2;
      const exitY = oy + height;
      out.connectors.push({
        points: [
          [axis + DIAMOND_W / 2, dy + DIAMOND_H / 2],
          [exitX, dy + DIAMOND_H / 2],
          [exitX, exitY],
          [axis, exitY],
        ],
        arrow: true,
        label: 'Yes',
      });

      // "No" continues down into postTest.
      const postY = oy + postTop;
      connectV(out, axis, dy + DIAMOND_H, postY, true);
      out.connectors.push({
        points: [[axis, dy + DIAMOND_H - 6]],
        arrow: false,
        label: 'No',
      });
      post.emit(ox + cx - post.cx, postY, out);
      const postBottom = postY + post.height;

      // Loop-back: from below postTest, left to the loop margin, up to entry.
      const backX = ox + LOOP_LEFT / 2;
      out.connectors.push({
        points: [
          [axis, postBottom],
          [axis, postBottom + V_GAP / 2],
          [backX, postBottom + V_GAP / 2],
          [backX, entryY],
          [axis, entryY],
        ],
        arrow: true,
      });
    },
  };
}

// ---- Helpers ----------------------------------------------------------------

function connectV(
  out: LayoutResult,
  x: number,
  y1: number,
  y2: number,
  arrow: boolean,
) {
  if (Math.abs(y2 - y1) < 0.5) return;
  out.connectors.push({ points: [[x, y1], [x, y2]], arrow });
}

function addInsertion(
  out: LayoutResult,
  location: SequenceLocation,
  index: number,
  x: number,
  y: number,
) {
  out.insertions.push({ location, index, x, y });
}

/** Build the insertion-point descriptor used for drag-drop targets. */
export function insertionPointOf(i: LaidOutInsertion): InsertionPoint {
  return { location: i.location, index: i.index };
}

/** Human-readable label shown inside each symbol. */
export function labelFor(node: Statement): string {
  switch (node.kind) {
    case 'input':
      return node.variable
        ? `Input ${node.variable}`
        : node.prompt || 'Input';
    case 'output':
      return truncate(node.expression || '...');
    case 'assignment':
      return node.variable && node.expression
        ? `${node.variable} ← ${truncate(node.expression)}`
        : 'Set …';
    case 'call':
      return node.expression ? truncate(node.expression) : 'Call …';
    case 'selection':
      return node.condition ? truncate(node.condition, 20) : 'Is …?';
    case 'loop':
      return node.condition ? `Until ${truncate(node.condition, 16)}` : 'Loop until …';
  }
}

function truncate(text: string, max = 22): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
