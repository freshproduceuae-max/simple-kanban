import { describe, it, expect } from 'vitest';
import { extractPlanFrame } from '../plan-extract';

describe('extractPlanFrame', () => {
  it('returns empty when the text has no fence', () => {
    expect(extractPlanFrame('no fence here')).toEqual({ tasks: [], chips: [] });
    expect(extractPlanFrame('')).toEqual({ tasks: [], chips: [] });
  });

  it('parses a well-formed json-plan fence with explicit columns', () => {
    const text =
      'here is the plan:\n\n' +
      '```json-plan\n' +
      '{"tasks":[{"title":"write the spec","column":"todo"},{"title":"pick a colour","column":"backlog"}],"chips":["scope?","by when?"]}\n' +
      '```';
    expect(extractPlanFrame(text)).toEqual({
      tasks: [
        { title: 'write the spec', column: 'todo' },
        { title: 'pick a colour', column: 'backlog' },
      ],
      chips: ['scope?', 'by when?'],
    });
  });

  it('defaults a task with no column to backlog', () => {
    const text = '```json-plan\n{"tasks":[{"title":"only task"}]}\n```';
    expect(extractPlanFrame(text).tasks).toEqual([
      { title: 'only task', column: 'backlog' },
    ]);
  });

  it('defaults a task with an invalid column to backlog', () => {
    const text =
      '```json-plan\n{"tasks":[{"title":"bad column","column":"someday"}]}\n```';
    expect(extractPlanFrame(text).tasks).toEqual([
      { title: 'bad column', column: 'backlog' },
    ]);
  });

  it('accepts a plain string task for backward-compatibility, defaulting to backlog', () => {
    const text = '```json-plan\n{"tasks":["plain string title"]}\n```';
    expect(extractPlanFrame(text).tasks).toEqual([
      { title: 'plain string title', column: 'backlog' },
    ]);
  });

  it('allows the chips field to be omitted', () => {
    const text = '```json-plan\n{"tasks":[{"title":"only task"}]}\n```';
    expect(extractPlanFrame(text)).toEqual({
      tasks: [{ title: 'only task', column: 'backlog' }],
      chips: [],
    });
  });

  it('takes the LAST json-plan fence when multiple are present', () => {
    const text =
      '```json-plan\n{"tasks":[{"title":"first draft"}]}\n```\n\nthen on reflection:\n' +
      '```json-plan\n{"tasks":[{"title":"final draft"}]}\n```';
    expect(extractPlanFrame(text).tasks).toEqual([
      { title: 'final draft', column: 'backlog' },
    ]);
  });

  it('returns empty on malformed JSON (lenient, not throwing)', () => {
    const text = '```json-plan\n{"tasks":[bad json\n```';
    expect(extractPlanFrame(text)).toEqual({ tasks: [], chips: [] });
  });

  it('ignores non-string, non-object task entries and objects with no title', () => {
    const text =
      '```json-plan\n{"tasks":[{"title":"keep me"}, 42, null, {"column":"todo"}, {"title":"me too"}]}\n```';
    expect(extractPlanFrame(text).tasks).toEqual([
      { title: 'keep me', column: 'backlog' },
      { title: 'me too', column: 'backlog' },
    ]);
  });

  it('trims whitespace from task titles and chips and drops empties', () => {
    const text =
      '```json-plan\n' +
      '{"tasks":[{"title":"  spaced  "},{"title":""},{"title":"    "}],"chips":["  chip  ",""]}\n' +
      '```';
    expect(extractPlanFrame(text)).toEqual({
      tasks: [{ title: 'spaced', column: 'backlog' }],
      chips: ['chip'],
    });
  });

  it('returns empty when the parsed payload is not an object', () => {
    const text = '```json-plan\n["not","an","object"]\n```';
    expect(extractPlanFrame(text)).toEqual({ tasks: [], chips: [] });
  });
});
