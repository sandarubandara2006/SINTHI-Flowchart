// The flowchart canvas. Renders the auto-laid-out program as SVG, hosts the
// insertion '+' points (drop targets + click-to-add menu), and shows selection
// and execution highlighting. Pan via scroll; zoom via the +/- controls.

import { useMemo, useRef, useState } from 'react';
import {
  layoutProgram,
  type LaidOutConnector,
  type LaidOutInsertion,
} from '../../render/layout';
import type { StatementKind } from '../../model/types';
import { useDocument } from '../../store/useDocument';
import { DRAG_MIME, SYMBOLS } from '../symbols';
import { ShapeOutline } from './shapes';

interface MenuState {
  insertion: LaidOutInsertion;
  screenX: number;
  screenY: number;
}

export function Canvas({ svgRef }: { svgRef: React.RefObject<SVGSVGElement> }) {
  const program = useDocument((s) => s.program);
  const selectedId = useDocument((s) => s.selectedId);
  const currentNodeId = useDocument((s) => s.currentNodeId);
  const mode = useDocument((s) => s.mode);
  const select = useDocument((s) => s.select);
  const beginEdit = useDocument((s) => s.beginEdit);
  const insertNew = useDocument((s) => s.insertNew);

  const [zoom, setZoom] = useState(1);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => layoutProgram(program), [program]);
  const erroredId = mode === 'error' ? currentNodeId : null;

  const insertionKey = (i: LaidOutInsertion) =>
    `${JSON.stringify(i.location)}#${i.index}`;

  function doInsert(kind: StatementKind, i: LaidOutInsertion) {
    insertNew(kind, { location: i.location, index: i.index });
    setMenu(null);
  }

  const isEmpty = program.body.length === 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50">
      {/* Zoom controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
        <button
          className="px-2 py-1 text-lg leading-none hover:bg-slate-100"
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
          title="Zoom in"
        >
          +
        </button>
        <button
          className="border-t border-slate-200 px-2 py-1 text-lg leading-none hover:bg-slate-100"
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
          title="Zoom out"
        >
          −
        </button>
        <button
          className="border-t border-slate-200 px-2 py-1 text-xs hover:bg-slate-100"
          onClick={() => setZoom(1)}
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
      </div>

      <div
        ref={containerRef}
        className="h-full w-full overflow-auto p-6"
        onClick={() => {
          select(null);
          setMenu(null);
        }}
      >
        <svg
          ref={svgRef}
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="block"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
            </marker>
          </defs>

          {layout.connectors.map((c, i) => (
            <Connector key={i} connector={c} />
          ))}

          {layout.shapes.map((shape) => {
            const interactive = shape.nodeId !== 'start' && shape.nodeId !== 'end';
            return (
              <g
                key={shape.nodeId}
                style={{ cursor: interactive ? 'pointer' : 'default' }}
                onClick={(e) => {
                  if (!interactive) return;
                  e.stopPropagation();
                  setMenu(null);
                  select(shape.nodeId as string);
                }}
                onDoubleClick={(e) => {
                  if (!interactive) return;
                  e.stopPropagation();
                  beginEdit(shape.nodeId as string);
                }}
              >
                <ShapeOutline
                  shape={shape}
                  highlighted={shape.nodeId === currentNodeId && mode !== 'error'}
                  selected={shape.nodeId === selectedId}
                  errored={shape.nodeId === erroredId}
                />
                <text
                  className="flow-symbol-label"
                  x={shape.x + shape.w / 2}
                  y={shape.y + shape.h / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {shape.label}
                </text>
              </g>
            );
          })}

          {layout.insertions.map((ins) => {
            const key = insertionKey(ins);
            const hot = dragOverKey === key;
            return (
              <g key={key}>
                {/* Larger invisible hit area for easy dropping. */}
                <circle
                  cx={ins.x}
                  cy={ins.y}
                  r={16}
                  fill="transparent"
                  className="insertion-dot"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverKey(key);
                  }}
                  onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverKey(null);
                    const kind = e.dataTransfer.getData(DRAG_MIME) as StatementKind;
                    if (kind) doInsert(kind, ins);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = containerRef.current?.getBoundingClientRect();
                    setMenu({
                      insertion: ins,
                      screenX: e.clientX - (rect?.left ?? 0),
                      screenY: e.clientY - (rect?.top ?? 0),
                    });
                  }}
                />
                <circle
                  cx={ins.x}
                  cy={ins.y}
                  r={hot ? 11 : 8}
                  fill={hot ? '#2563eb' : '#cbd5e1'}
                  stroke="#fff"
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
                <text
                  x={ins.x}
                  y={ins.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={13}
                  fill="#fff"
                  pointerEvents="none"
                >
                  +
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg bg-white/80 px-4 py-2 text-sm text-slate-500 shadow">
            Click a <span className="font-semibold">+</span> between Start and End, or
            drag a symbol from the left, to begin.
          </p>
        </div>
      )}

      {menu && (
        <InsertionMenu
          menu={menu}
          onPick={(kind) => doInsert(kind, menu.insertion)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

function Connector({ connector }: { connector: LaidOutConnector }) {
  const { points, arrow, label } = connector;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  return (
    <g>
      <path
        className="flow-connector"
        d={d}
        markerEnd={arrow ? 'url(#arrow)' : undefined}
      />
      {label && (
        <text
          className="flow-edge-label"
          x={(first[0] + last[0]) / 2 + 6}
          y={(first[1] + last[1]) / 2 - 4}
        >
          {label}
        </text>
      )}
    </g>
  );
}

function InsertionMenu({
  menu,
  onPick,
  onClose,
}: {
  menu: MenuState;
  onPick: (kind: StatementKind) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div
        className="absolute z-30 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        style={{
          left: Math.min(menu.screenX, window.innerWidth - 240),
          top: menu.screenY,
        }}
      >
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Add symbol
        </p>
        {SYMBOLS.map((s) => (
          <button
            key={s.kind}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100"
            onClick={() => onPick(s.kind)}
          >
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: s.fill, border: `1.5px solid ${s.stroke}` }}
            />
            <span className="font-medium">{s.title}</span>
          </button>
        ))}
      </div>
    </>
  );
}
