// The input/output console. Shows program output, echoes input, surfaces errors,
// and hosts the input box when the running program asks for a value.

import { useEffect, useRef, useState } from 'react';
import { useDocument } from '../../store/useDocument';

export function Console() {
  const lines = useDocument((s) => s.consoleLines);
  const pendingInput = useDocument((s) => s.pendingInput);
  const provideInput = useDocument((s) => s.provideInput);
  const [value, setValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, pendingInput]);

  useEffect(() => {
    if (pendingInput) inputRef.current?.focus();
  }, [pendingInput]);

  const submit = () => {
    provideInput(value);
    setValue('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-slate-200">
      <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Console
      </h2>
      <div
        ref={scrollRef}
        className="console-mono min-h-0 flex-1 overflow-y-auto bg-slate-900 px-3 py-2 text-slate-100"
      >
        {lines.length === 0 && (
          <p className="text-slate-500">Output from your program shows here.</p>
        )}
        {lines.map((line, i) => (
          <div key={i} className={lineClass(line.kind)}>
            {line.text}
          </div>
        ))}
      </div>

      {pendingInput && (
        <div className="flex items-center gap-2 border-t border-slate-700 bg-slate-800 px-3 py-2">
          <span className="console-mono text-xs text-slate-300">
            {pendingInput.prompt}
          </span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            className="console-mono flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white focus:border-blue-400 focus:outline-none"
            placeholder="Type a value and press Enter"
          />
          <button
            onClick={submit}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
          >
            Enter
          </button>
        </div>
      )}
    </div>
  );
}

function lineClass(kind: string): string {
  switch (kind) {
    case 'error':
      return 'text-red-400 whitespace-pre-wrap';
    case 'input':
      return 'text-emerald-300 whitespace-pre-wrap';
    case 'info':
      return 'text-slate-400 italic whitespace-pre-wrap';
    default:
      return 'text-slate-100 whitespace-pre-wrap';
  }
}
