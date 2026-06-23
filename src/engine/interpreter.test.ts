import { describe, expect, it } from 'vitest';
import { execute, VariableStore, type Effect } from './interpreter';
import { createStatement } from '../model/nodes';
import type { FlowchartProgram, LoopNode } from '../model/types';

/**
 * Drive the generator to completion. `inputs` are fed in order to input
 * symbols; all output text is concatenated and returned.
 */
function run(program: FlowchartProgram, inputs: string[] = []) {
  const vars = new VariableStore();
  const gen = execute(program, vars);
  const effects: Effect[] = [];
  let output = '';
  let inputIdx = 0;

  let result = gen.next();
  while (!result.done) {
    const effect = result.value;
    effects.push(effect);
    if (effect.type === 'output') {
      output += effect.text;
      result = gen.next();
    } else if (effect.type === 'input') {
      result = gen.next(inputs[inputIdx++] ?? '');
    } else {
      result = gen.next();
    }
  }
  return { output, effects, vars };
}

/** Build: Input N; sum<-0; i<-1; Loop[ test i>N, body sum<-sum+i; i<-i+1 ]; Output. */
function sumProgram(): FlowchartProgram {
  const input = createStatement('input');
  Object.assign(input, { prompt: 'Enter N', variable: 'N' });
  const initSum = createStatement('assignment');
  Object.assign(initSum, { variable: 'sum', expression: '0' });
  const initI = createStatement('assignment');
  Object.assign(initI, { variable: 'i', expression: '1' });

  const addSum = createStatement('assignment');
  Object.assign(addSum, { variable: 'sum', expression: 'sum + i' });
  const incI = createStatement('assignment');
  Object.assign(incI, { variable: 'i', expression: 'i + 1' });

  const loop = createStatement('loop') as LoopNode;
  loop.condition = 'i > N';
  loop.postTest = [addSum, incI];

  const output = createStatement('output');
  Object.assign(output, { expression: '"Sum = " + sum', newline: true });

  return {
    schemaVersion: 1,
    name: 'Sum 1..N',
    body: [input, initSum, initI, loop, output],
  };
}

describe('interpreter', () => {
  it('runs the sum 1..N program (the RAPTOR smoke test)', () => {
    const { output, vars } = run(sumProgram(), ['5']);
    expect(output).toBe('Sum = 15\n');
    expect(vars.get('sum')).toBe(15);
  });

  it('takes the correct branch in a selection', () => {
    const sel = createStatement('selection');
    const yes = createStatement('output');
    Object.assign(yes, { expression: '"big"', newline: false });
    const no = createStatement('output');
    Object.assign(no, { expression: '"small"', newline: false });
    Object.assign(sel, { condition: 'x > 10', yes: [yes], no: [no] });
    const assign = createStatement('assignment');
    Object.assign(assign, { variable: 'x', expression: '3' });

    const program: FlowchartProgram = {
      schemaVersion: 1,
      name: 't',
      body: [assign, sel],
    };
    expect(run(program).output).toBe('small');
  });

  it('highlights every symbol it runs', () => {
    const { effects } = run(sumProgram(), ['3']);
    const highlights = effects.filter((e) => e.type === 'highlight');
    expect(highlights.length).toBeGreaterThan(5);
  });

  it('reports runtime errors with the offending node', () => {
    const bad = createStatement('output');
    Object.assign(bad, { expression: 'mystery + 1', newline: false });
    const program: FlowchartProgram = { schemaVersion: 1, name: 't', body: [bad] };
    expect(() => run(program)).toThrow('has not been given a value');
  });
});
