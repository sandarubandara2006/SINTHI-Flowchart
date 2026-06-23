// Live view of every variable and its current value during a run — RAPTOR's
// "watch window". Updates after each step.

import { useDocument } from '../../store/useDocument';

export function WatchWindow() {
  const watch = useDocument((s) => s.watch);
  const mode = useDocument((s) => s.mode);
  const active = mode !== 'idle';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Variables
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {!active ? (
          <p className="text-xs text-slate-400">
            Variables appear here while the chart runs.
          </p>
        ) : watch.length === 0 ? (
          <p className="text-xs text-slate-400">No variables yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {watch.map((v) => (
                <tr key={v.name} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 pr-2 font-mono font-medium text-slate-700">
                    {v.name}
                  </td>
                  <td className="py-1 font-mono text-slate-900">{v.value}</td>
                  <td className="py-1 pl-2 text-right text-xs text-slate-400">
                    {v.type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
