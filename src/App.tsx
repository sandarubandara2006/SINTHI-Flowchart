// Application shell: toolbar on top, palette on the left, canvas in the middle,
// and the watch window + console on the right. Handles autosave and a few
// keyboard shortcuts.

import { useEffect, useRef } from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Palette } from './components/Palette/Palette';
import { Canvas } from './components/Canvas/Canvas';
import { SymbolEditor } from './components/SymbolEditor/SymbolEditor';
import { WatchWindow } from './components/WatchWindow/WatchWindow';
import { Console } from './components/Console/Console';
import { useDocument } from './store/useDocument';
import { readAutosave, writeAutosave } from './services/storage';

export function App() {
  const svgRef = useRef<SVGSVGElement>(null);
  const program = useDocument((s) => s.program);
  const loadProgram = useDocument((s) => s.loadProgram);

  // Restore the autosaved chart once, on first load.
  useEffect(() => {
    const saved = readAutosave();
    if (saved && saved.body.length > 0) loadProgram(saved, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave whenever the program changes.
  useEffect(() => {
    const handle = setTimeout(() => writeAutosave(program), 400);
    return () => clearTimeout(handle);
  }, [program]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useDocument.getState();
      const typing =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        s.undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        s.redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && s.selectedId) {
        e.preventDefault();
        s.deleteNode(s.selectedId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <Toolbar svgRef={svgRef} />
      <div className="flex min-h-0 flex-1">
        <Palette />
        <main className="min-w-0 flex-1">
          <Canvas svgRef={svgRef} />
        </main>
        <aside className="flex w-80 flex-col border-l border-slate-200 bg-white">
          <WatchWindow />
          <Console />
        </aside>
      </div>
      <SymbolEditor />
    </div>
  );
}
