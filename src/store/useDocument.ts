// Central application store: the document (flowchart), selection, undo/redo, and
// the execution controller.
//
// The execution controller drives the interpreter generator. It lives partly in
// module scope (the generator, timer and variable store are mutable, non-React
// values) and partly in the store (the reactive snapshot the UI renders). See
// `engine/interpreter.ts` for how effects are produced.

import { produce } from 'immer';
import { create } from 'zustand';
import {
  createProgram,
  createStatement,
  findNode,
  insertStatement,
  removeStatement,
} from '../model/nodes';
import type {
  FlowchartProgram,
  InsertionPoint,
  NodeId,
  StatementKind,
  StatementPatch,
} from '../model/types';
import { blankProgram } from '../model/serialize';
import {
  execute,
  FlowchartRuntimeError,
  VariableStore,
  type Effect,
} from '../engine/interpreter';
import { formatValueDebug, type RuntimeValue } from '../engine/expression/values';

export type ExecMode =
  | 'idle'
  | 'running'
  | 'paused'
  | 'awaitingInput'
  | 'finished'
  | 'error';

export interface ConsoleLine {
  kind: 'output' | 'input' | 'error' | 'info';
  text: string;
}

export interface WatchEntry {
  name: string;
  value: string;
  type: string;
}

interface PendingInput {
  nodeId: NodeId;
  prompt: string;
  variable: string;
}

interface DocumentState {
  program: FlowchartProgram;
  selectedId: NodeId | null;
  editingId: NodeId | null;
  dirty: boolean;
  past: FlowchartProgram[];
  future: FlowchartProgram[];

  // Execution
  mode: ExecMode;
  currentNodeId: NodeId | null;
  consoleLines: ConsoleLine[];
  watch: WatchEntry[];
  pendingInput: PendingInput | null;
  speedMs: number;
  errorMessage: string | null;

  // Document actions
  newProgram: () => void;
  loadProgram: (program: FlowchartProgram, markClean?: boolean) => void;
  renameProgram: (name: string) => void;
  select: (id: NodeId | null) => void;
  insertNew: (kind: StatementKind, at: InsertionPoint) => void;
  updateNode: (id: NodeId, patch: StatementPatch) => void;
  deleteNode: (id: NodeId) => void;
  beginEdit: (id: NodeId | null) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;

  // Execution actions
  run: () => void;
  step: () => void;
  pause: () => void;
  stop: () => void;
  provideInput: (raw: string) => void;
  setSpeed: (ms: number) => void;
}

// ---- Module-scoped execution engine state (non-reactive) --------------------
let gen: Generator<Effect, void, string> | null = null;
let vars: VariableStore | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
// When an input pause happens, remember whether we were Running (so we resume
// running after input) or Stepping (so we stay paused at the next symbol).
let resumeRunning = false;

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

export const useDocument = create<DocumentState>((set, get) => {
  /** Push the current program onto the undo stack before a structural edit. */
  function commit(mutator: (draft: FlowchartProgram) => void) {
    const { program, past } = get();
    const next = produce(program, mutator);
    set({
      program: next,
      past: [...past, program].slice(-100),
      future: [],
      dirty: true,
    });
  }

  function snapshotWatch(): WatchEntry[] {
    if (!vars) return [];
    return vars
      .entries()
      .map(([name, value]) => ({
        name,
        value: formatValueDebug(value as RuntimeValue),
        type: Array.isArray(value)
          ? 'array'
          : typeof value === 'number'
            ? 'number'
            : typeof value === 'string'
              ? 'string'
              : 'boolean',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function appendConsole(line: ConsoleLine) {
    set((s) => ({ consoleLines: [...s.consoleLines, line] }));
  }

  type Signal = 'continue' | 'pause' | 'await' | 'stop';

  /** Pull one effect from the generator and apply it. */
  function advance(inputValue?: string): Signal {
    if (!gen) return 'stop';
    let result: IteratorResult<Effect, void>;
    try {
      result = inputValue === undefined ? gen.next() : gen.next(inputValue);
    } catch (e) {
      handleError(e);
      return 'stop';
    }
    if (result.done) {
      finish();
      return 'stop';
    }
    const effect = result.value;
    switch (effect.type) {
      case 'output':
        appendConsole({ kind: 'output', text: effect.text.replace(/\n$/, '') });
        return 'continue';
      case 'highlight':
        set({ currentNodeId: effect.nodeId, watch: snapshotWatch() });
        return 'pause';
      case 'input':
        set({
          currentNodeId: effect.nodeId,
          mode: 'awaitingInput',
          pendingInput: {
            nodeId: effect.nodeId,
            prompt: effect.prompt,
            variable: effect.variable,
          },
          watch: snapshotWatch(),
        });
        return 'await';
    }
  }

  function finish() {
    clearTimer();
    set({
      mode: 'finished',
      currentNodeId: null,
      pendingInput: null,
      watch: snapshotWatch(),
    });
    appendConsole({ kind: 'info', text: '— Program finished —' });
    gen = null;
  }

  function handleError(e: unknown) {
    clearTimer();
    const nodeId = e instanceof FlowchartRuntimeError ? e.nodeId : null;
    const message = e instanceof Error ? e.message : 'Unexpected error.';
    set({
      mode: 'error',
      errorMessage: message,
      currentNodeId: nodeId,
      pendingInput: null,
      watch: snapshotWatch(),
    });
    appendConsole({ kind: 'error', text: `⚠ ${message}` });
    gen = null;
  }

  /** Run effects until we hit a highlight (one step) or stop. */
  function stepToNextHighlight(): Signal {
    let signal = advance();
    while (signal === 'continue') signal = advance();
    return signal;
  }

  /** Continuously run, pausing `speedMs` at each highlight, until done/await. */
  function runLoop() {
    let signal = advance();
    while (signal === 'continue') signal = advance();
    if (signal === 'pause') {
      if (get().mode === 'running') {
        timer = setTimeout(runLoop, get().speedMs);
      }
    } else if (signal === 'await') {
      resumeRunning = true;
    }
    // 'stop' simply ends the loop.
  }

  function startEngine() {
    const program = get().program;
    vars = new VariableStore();
    gen = execute(program, vars);
    set({
      consoleLines: [{ kind: 'info', text: '— Running —' }],
      watch: [],
      errorMessage: null,
      currentNodeId: null,
      pendingInput: null,
    });
  }

  function isRunnable(mode: ExecMode): boolean {
    return mode === 'running' || mode === 'paused' || mode === 'awaitingInput';
  }

  return {
    program: createProgram('My Flowchart'),
    selectedId: null,
    editingId: null,
    dirty: false,
    past: [],
    future: [],

    mode: 'idle',
    currentNodeId: null,
    consoleLines: [],
    watch: [],
    pendingInput: null,
    speedMs: 600,
    errorMessage: null,

    newProgram: () => {
      get().stop();
      set({
        program: blankProgram(),
        selectedId: null,
        past: [],
        future: [],
        dirty: false,
      });
    },

    loadProgram: (program, markClean = true) => {
      get().stop();
      set({
        program,
        selectedId: null,
        past: [],
        future: [],
        dirty: !markClean,
      });
    },

    renameProgram: (name) => commit((d) => void (d.name = name)),

    select: (id) => set({ selectedId: id }),

    insertNew: (kind, at) => {
      const node = createStatement(kind);
      commit((d) => {
        insertStatement(d, at, node);
      });
      // Open the editor immediately so the student fills in the new symbol.
      set({ selectedId: node.id, editingId: node.id });
    },

    beginEdit: (id) => set({ editingId: id, selectedId: id ?? get().selectedId }),

    updateNode: (id, patch) =>
      commit((d) => {
        const found = findNode(d, id);
        if (found) Object.assign(found.node, patch);
      }),

    deleteNode: (id) => {
      commit((d) => {
        removeStatement(d, id);
      });
      if (get().selectedId === id) set({ selectedId: null });
    },

    undo: () => {
      const { past, program, future } = get();
      if (past.length === 0) return;
      const previous = past[past.length - 1];
      set({
        program: previous,
        past: past.slice(0, -1),
        future: [program, ...future],
        dirty: true,
        selectedId: null,
      });
    },

    redo: () => {
      const { future, program, past } = get();
      if (future.length === 0) return;
      const next = future[0];
      set({
        program: next,
        future: future.slice(1),
        past: [...past, program],
        dirty: true,
        selectedId: null,
      });
    },

    markSaved: () => set({ dirty: false }),

    run: () => {
      const { mode } = get();
      if (mode === 'awaitingInput') return; // wait for input first
      if (!isRunnable(mode)) startEngine();
      clearTimer();
      set({ mode: 'running' });
      runLoop();
    },

    step: () => {
      const { mode } = get();
      if (mode === 'awaitingInput') return;
      if (!isRunnable(mode)) startEngine();
      clearTimer();
      set({ mode: 'paused' });
      const signal = stepToNextHighlight();
      if (signal === 'await') resumeRunning = false;
      // 'stop' / 'pause' state already updated by advance/finish.
    },

    pause: () => {
      clearTimer();
      if (get().mode === 'running') set({ mode: 'paused' });
    },

    stop: () => {
      clearTimer();
      gen = null;
      vars = null;
      set({
        mode: 'idle',
        currentNodeId: null,
        pendingInput: null,
        errorMessage: null,
      });
    },

    provideInput: (raw) => {
      const pending = get().pendingInput;
      if (!pending) return;
      appendConsole({ kind: 'input', text: `${pending.prompt} ▸ ${raw}` });
      set({ pendingInput: null, mode: resumeRunning ? 'running' : 'paused' });
      // Feed the value, then continue past any output to the next pause point.
      let signal = advance(raw);
      while (signal === 'continue') signal = advance();
      if (signal === 'await') {
        // Another input symbol immediately follows; keep the same resume mode.
        return;
      }
      if (signal === 'pause' && resumeRunning) {
        timer = setTimeout(runLoop, get().speedMs);
      }
      // If stepping, we stop here (paused at the next highlighted symbol).
    },

    setSpeed: (ms) => set({ speedMs: ms }),
  };
});
