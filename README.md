# SINTHI Flowchart

A free, cross-platform alternative to **RAPTOR** for building and *running*
flowcharts in your browser. Designed for students whose lecturers use RAPTOR but
who aren't on Windows — SINTHI runs anywhere (Mac, Windows, Chromebook, Linux).

Like RAPTOR, a flowchart here isn't just a drawing: you **run** it. Step through
the symbols, watch your variables change, and interact through an input/output
console.

## Features

- **Drag-and-drop authoring** of the six standard symbols: Input, Output,
  Assignment, Call, Selection (if/else) and Loop. Click a `+` on the chart, or
  drag a symbol from the palette.
- **Structured by construction** — branches and loops always nest correctly, so
  you can't draw an invalid program.
- **Real execution engine** with Run, Step, Pause and a speed control, a live
  **variable watch window**, and an I/O **console** (no `eval` — a safe built-in
  interpreter).
- **Expressions** with arithmetic (`+ - * / mod rem ^`), comparison, `and/or/not`,
  strings, 1-based arrays, and built-in functions (`sqrt`, `abs`, `floor`,
  `ceiling`, `random`, `length_of`, …).
- **Save / open** local `.sinthi.json` files, automatic browser autosave, and
  **Export to PNG** for reports.
- 100% client-side. No accounts, no backend — host it free on GitHub Pages.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm test         # run the unit tests (expression engine + interpreter)
npm run build    # produce a static build in dist/
```

> **University Wi-Fi note:** some campus networks (e.g. Fortinet firewalls) do
> SSL inspection that breaks `npm install`. If installs fail with
> `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, install dependencies on a normal network
> (e.g. a phone hotspot) once, then carry on as usual.

## How a Loop works (RAPTOR semantics)

The Loop symbol runs the statements above the diamond, checks the condition, and
**exits when the condition is true**; otherwise it runs the statements below the
diamond and repeats. Putting your body before or after the test gives you
while-style, until-style, or mid-test loops from one symbol.

## Try it: sum of 1..N

1. Add an **Input** (store in `N`).
2. Two **Assignments**: `sum ← 0`, then `i ← 1`.
3. A **Loop** with condition `i > N`, and inside the body (below the test):
   `sum ← sum + i` then `i ← i + 1`.
4. An **Output**: `"Sum = " + sum`.

Press **Run**, type `5`, and you should see `Sum = 15`.

## Tech

React + TypeScript + Vite, Zustand for state, a custom SVG renderer with
automatic layout, and a small hand-written expression interpreter. No flowchart
or graph libraries.

## Deployment

Pushing to `main` builds and deploys to GitHub Pages via
`.github/workflows/deploy.yml`. The Vite `base` defaults to `/SINTHI-Flowchart/`
for a project site; set `VITE_BASE=/` for a custom domain or local preview.
