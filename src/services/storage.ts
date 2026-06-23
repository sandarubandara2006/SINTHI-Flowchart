// Saving, opening and autosaving flowcharts. Pure browser APIs — no backend.
// Uses the File System Access API where available, with a download/upload
// fallback for browsers that lack it (e.g. Firefox, Safari).

import {
  deserialize,
  FILE_EXTENSION,
  serialize,
} from '../model/serialize';
import type { FlowchartProgram } from '../model/types';

const AUTOSAVE_KEY = 'sinthi.autosave.v1';

type WindowWithFsAccess = Window & {
  showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle[]>;
};

function fileName(program: FlowchartProgram): string {
  const base = program.name.trim().replace(/[^\w-]+/g, '_') || 'flowchart';
  return base + FILE_EXTENSION;
}

/** Save the program to disk. Returns true if saved (false if user cancelled). */
export async function saveProgram(program: FlowchartProgram): Promise<boolean> {
  const text = serialize(program);
  const w = window as WindowWithFsAccess;
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: fileName(program),
        types: [
          {
            description: 'SINTHI Flowchart',
            accept: { 'application/json': [FILE_EXTENSION] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return true;
    } catch (e) {
      if (isAbort(e)) return false;
      // Fall through to download on any other error.
    }
  }
  downloadText(text, fileName(program));
  return true;
}

/** Open a program from disk. Returns null if the user cancelled. */
export async function openProgram(): Promise<FlowchartProgram | null> {
  const w = window as WindowWithFsAccess;
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({
        types: [
          {
            description: 'SINTHI Flowchart',
            accept: { 'application/json': [FILE_EXTENSION, '.json'] },
          },
        ],
        multiple: false,
      });
      const file = await handle.getFile();
      return deserialize(await file.text());
    } catch (e) {
      if (isAbort(e)) return null;
      throw e;
    }
  }
  return openViaInput();
}

function openViaInput(): Promise<FlowchartProgram | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${FILE_EXTENSION},.json,application/json`;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(deserialize(await file.text()));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}

function downloadText(text: string, name: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Autosave ---------------------------------------------------------------

export function writeAutosave(program: FlowchartProgram): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, serialize(program));
  } catch {
    // Storage full or blocked — autosave is best-effort.
  }
}

export function readAutosave(): FlowchartProgram | null {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY);
    if (!text) return null;
    return deserialize(text);
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}
