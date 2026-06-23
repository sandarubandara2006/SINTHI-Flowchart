// Top toolbar: file actions, run controls, speed, and undo/redo.

import { useDocument } from '../../store/useDocument';
import { openProgram, saveProgram } from '../../services/storage';
import { exportSvgToPng } from '../../services/exportImage';

export function Toolbar({ svgRef }: { svgRef: React.RefObject<SVGSVGElement> }) {
  const program = useDocument((s) => s.program);
  const dirty = useDocument((s) => s.dirty);
  const mode = useDocument((s) => s.mode);
  const speedMs = useDocument((s) => s.speedMs);
  const past = useDocument((s) => s.past);
  const future = useDocument((s) => s.future);

  const newProgram = useDocument((s) => s.newProgram);
  const loadProgram = useDocument((s) => s.loadProgram);
  const renameProgram = useDocument((s) => s.renameProgram);
  const markSaved = useDocument((s) => s.markSaved);
  const undo = useDocument((s) => s.undo);
  const redo = useDocument((s) => s.redo);
  const run = useDocument((s) => s.run);
  const step = useDocument((s) => s.step);
  const pause = useDocument((s) => s.pause);
  const stop = useDocument((s) => s.stop);
  const setSpeed = useDocument((s) => s.setSpeed);

  const running = mode === 'running';

  const onNew = () => {
    if (dirty && !confirm('Start a new flowchart? Unsaved changes will be lost.')) return;
    newProgram();
  };

  const onOpen = async () => {
    if (dirty && !confirm('Open another file? Unsaved changes will be lost.')) return;
    try {
      const opened = await openProgram();
      if (opened) loadProgram(opened);
    } catch (e) {
      alert(`Could not open that file.\n${(e as Error).message}`);
    }
  };

  const onSave = async () => {
    const ok = await saveProgram(program);
    if (ok) markSaved();
  };

  const onExport = async () => {
    if (svgRef.current) {
      await exportSvgToPng(svgRef.current, program.name);
    }
  };

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1.5 pr-2">
        <span className="text-lg font-bold text-blue-600">SINTHI</span>
        <span className="text-xs text-slate-400">Flowchart</span>
      </div>

      <input
        value={program.name}
        onChange={(e) => renameProgram(e.target.value)}
        className="w-44 rounded border border-transparent px-2 py-1 text-sm font-medium hover:border-slate-200 focus:border-blue-400 focus:outline-none"
        aria-label="Flowchart name"
      />
      {dirty && <span className="text-xs text-amber-500" title="Unsaved changes">●</span>}

      <Divider />

      <Btn onClick={onNew}>New</Btn>
      <Btn onClick={onOpen}>Open</Btn>
      <Btn onClick={onSave}>Save</Btn>
      <Btn onClick={onExport}>Export PNG</Btn>

      <Divider />

      <Btn onClick={undo} disabled={past.length === 0} title="Undo">
        ↶
      </Btn>
      <Btn onClick={redo} disabled={future.length === 0} title="Redo">
        ↷
      </Btn>

      <Divider />

      {!running ? (
        <Btn onClick={run} variant="primary" title="Run (continuous)">
          ▶ Run
        </Btn>
      ) : (
        <Btn onClick={pause} variant="primary" title="Pause">
          ⏸ Pause
        </Btn>
      )}
      <Btn onClick={step} title="Run one step">
        ⏭ Step
      </Btn>
      <Btn onClick={stop} disabled={mode === 'idle'} title="Stop">
        ⏹ Stop
      </Btn>

      <label className="ml-1 flex items-center gap-1.5 text-xs text-slate-500">
        Speed
        <input
          type="range"
          min={0}
          max={1000}
          step={50}
          // Slider left = slow (large delay), right = fast (small delay).
          value={1000 - speedMs}
          onChange={(e) => setSpeed(1000 - Number(e.target.value))}
          className="w-24"
        />
      </label>

      <span className="ml-auto text-xs text-slate-400">{statusText(mode)}</span>
    </header>
  );
}

function statusText(mode: string): string {
  switch (mode) {
    case 'running':
      return 'Running…';
    case 'paused':
      return 'Paused';
    case 'awaitingInput':
      return 'Waiting for input';
    case 'finished':
      return 'Finished';
    case 'error':
      return 'Error';
    default:
      return 'Ready';
  }
}

function Divider() {
  return <span className="mx-1 h-6 w-px bg-slate-200" />;
}

function Btn({
  children,
  onClick,
  disabled,
  title,
  variant = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  variant?: 'default' | 'primary';
}) {
  const base =
    'rounded-md px-2.5 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40';
  const styles =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'text-slate-700 hover:bg-slate-100';
  return (
    <button className={`${base} ${styles}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}
