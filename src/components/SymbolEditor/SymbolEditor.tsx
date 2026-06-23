// Modal editor for a single symbol. Opens when `editingId` is set (on insert or
// double-click). Fields validate live against the expression engine; changes are
// committed to the document once, on Done.

import { useEffect, useMemo, useState } from 'react';
import { findNode } from '../../model/nodes';
import type { Statement, StatementPatch } from '../../model/types';
import { useDocument } from '../../store/useDocument';
import {
  validateAssignTarget,
  validateExpression,
  validateVariableName,
  type ValidationResult,
} from '../../engine/expression/validate';
import { SYMBOL_BY_KIND } from '../symbols';

export function SymbolEditor() {
  const editingId = useDocument((s) => s.editingId);
  const program = useDocument((s) => s.program);
  const updateNode = useDocument((s) => s.updateNode);
  const deleteNode = useDocument((s) => s.deleteNode);
  const beginEdit = useDocument((s) => s.beginEdit);

  const node = useMemo(
    () => (editingId ? findNode(program, editingId)?.node ?? null : null),
    [editingId, program],
  );

  if (!node) return null;
  return (
    <EditorForm
      key={node.id}
      node={node}
      onSave={(patch) => {
        updateNode(node.id, patch);
        beginEdit(null);
      }}
      onCancel={() => beginEdit(null)}
      onDelete={() => {
        deleteNode(node.id);
        beginEdit(null);
      }}
    />
  );
}

function EditorForm({
  node,
  onSave,
  onCancel,
  onDelete,
}: {
  node: Statement;
  onSave: (patch: StatementPatch) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Statement>(node);
  const meta = SYMBOL_BY_KIND[node.kind];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const set = (patch: StatementPatch) =>
    setDraft((d) => ({ ...d, ...patch }) as Statement);

  const { fields, valid } = describe(draft, set);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-2 rounded-t-xl px-4 py-3"
          style={{ background: meta.fill, borderBottom: `2px solid ${meta.stroke}` }}
        >
          <span
            className="inline-block h-4 w-4 rounded-sm"
            style={{ background: '#fff', border: `2px solid ${meta.stroke}` }}
          />
          <h2 className="text-base font-semibold text-slate-800">{meta.title}</h2>
        </div>

        <form
          className="space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSave(draft);
          }}
        >
          {fields}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!valid}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Done
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Build the per-kind fields and whether the form is valid to submit. */
function describe(
  draft: Statement,
  set: (patch: StatementPatch) => void,
): { fields: React.ReactNode; valid: boolean } {
  switch (draft.kind) {
    case 'input': {
      const nameCheck = validateVariableName(draft.variable);
      return {
        valid: nameCheck.ok,
        fields: (
          <>
            <TextField
              label="Prompt to show"
              value={draft.prompt}
              onChange={(v) => set({ prompt: v })}
              placeholder="Enter a number"
            />
            <ExprField
              label="Store the answer in variable"
              value={draft.variable}
              onChange={(v) => set({ variable: v })}
              check={nameCheck}
              mono
              placeholder="age"
            />
          </>
        ),
      };
    }
    case 'output': {
      const check = validateExpression(draft.expression);
      return {
        valid: check.ok,
        fields: (
          <>
            <ExprField
              label="Print this expression"
              value={draft.expression}
              onChange={(v) => set({ expression: v })}
              check={check}
              mono
              placeholder={'"Hello, " + name'}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.newline}
                onChange={(e) => set({ newline: e.target.checked })}
              />
              Start a new line after
            </label>
          </>
        ),
      };
    }
    case 'assignment': {
      const targetCheck = validateAssignTarget(draft.variable);
      const exprCheck = validateExpression(draft.expression);
      return {
        valid: targetCheck.ok && exprCheck.ok,
        fields: (
          <>
            <ExprField
              label="Set variable"
              value={draft.variable}
              onChange={(v) => set({ variable: v })}
              check={targetCheck}
              mono
              placeholder="total"
            />
            <ExprField
              label="To the value"
              value={draft.expression}
              onChange={(v) => set({ expression: v })}
              check={exprCheck}
              mono
              placeholder="total + 1"
            />
          </>
        ),
      };
    }
    case 'call': {
      const check = validateExpression(draft.expression || '0');
      return {
        valid: draft.expression.trim() !== '' && check.ok,
        fields: (
          <ExprField
            label="Call expression"
            value={draft.expression}
            onChange={(v) => set({ expression: v })}
            check={draft.expression.trim() === '' ? { ok: false, message: 'Enter a call.' } : check}
            mono
            placeholder="beep()"
          />
        ),
      };
    }
    case 'selection': {
      const check = validateExpression(draft.condition);
      return {
        valid: check.ok,
        fields: (
          <ExprField
            label="Decision (yes / no question)"
            value={draft.condition}
            onChange={(v) => set({ condition: v })}
            check={check}
            mono
            placeholder="score >= 50"
            hint="The Yes branch runs when this is true."
          />
        ),
      };
    }
    case 'loop': {
      const check = validateExpression(draft.condition);
      return {
        valid: check.ok,
        fields: (
          <ExprField
            label="Exit the loop when…"
            value={draft.condition}
            onChange={(v) => set({ condition: v })}
            check={check}
            mono
            placeholder="i > 10"
            hint="The loop repeats while this is false, and stops when it becomes true."
          />
        ),
      };
    }
  }
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}

function ExprField({
  label,
  value,
  onChange,
  check,
  mono,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  check: ValidationResult;
  mono?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const showError = value.trim() !== '' && !check.ok;
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoFocus
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
          showError
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
        } ${mono ? 'font-mono' : ''}`}
      />
      {showError ? (
        <span className="mt-1 block text-xs text-red-600">{check.message}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}
