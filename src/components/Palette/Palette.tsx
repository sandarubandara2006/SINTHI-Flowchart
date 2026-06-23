// The symbol palette. Each tile is draggable onto an insertion '+' on the
// canvas. (Clicking a '+' also opens a quick picker, so drag is optional.)

import { DRAG_MIME, SYMBOLS, type SymbolMeta } from '../symbols';

export function Palette() {
  return (
    <aside className="flex w-56 flex-col gap-2 overflow-y-auto border-r border-slate-200 bg-white p-3">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Symbols
      </h2>
      {SYMBOLS.map((s) => (
        <PaletteTile key={s.kind} meta={s} />
      ))}
      <p className="mt-2 px-1 text-xs leading-relaxed text-slate-400">
        Drag a symbol onto a <span className="font-semibold">+</span> on the chart,
        or click a <span className="font-semibold">+</span> to pick one.
      </p>
    </aside>
  );
}

function PaletteTile({ meta }: { meta: SymbolMeta }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, meta.kind);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className="flex cursor-grab items-start gap-2 rounded-md border border-slate-200 p-2 transition hover:border-slate-300 hover:shadow-sm active:cursor-grabbing"
    >
      <span
        className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-sm"
        style={{ background: meta.fill, border: `2px solid ${meta.stroke}` }}
      />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-700">{meta.title}</div>
        <div className="text-xs leading-snug text-slate-500">{meta.blurb}</div>
      </div>
    </div>
  );
}
