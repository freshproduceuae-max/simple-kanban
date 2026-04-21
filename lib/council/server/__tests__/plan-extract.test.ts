import { describe, it, expect } from 'vitest';
import { extractPlanFrame } from '../plan-extract';

describe('extractPlanFrame', () => {
  it('returns empty when the text has no fence', () => {
    expect(extractPlanFrame('no fence here')).toEqual({ tasks: [], chips: [] });
    expect(extractPlanFrame('')).toEqual({ tasks: [], chips: [] });
  });

  it('parses a well-formed json-plan fence', () => {
    const text =
      'here is the plan:\n\n' +
      '```json-plan\n' +
      '{"tasks":["write the spec","pick a colour"],"chips":["scope?","by when?"]}\n' +
      '```';
    expect(extractPlanFrame(text)).toEqual({
      tasks: ['write the spec', 'pick a colour'],
      chips: ['scope?', 'by when?'],
    });
  });

  it('allows the chips field to be omitted', () => {
    const text = '```json-plan\n{"tasks":["only task"]}\n```';
    expect(extractPlanFrame(text)).toEqual({
      tasks: ['only task'],
      chips: [],
    });
  });

  it('takes the LAST json-plan fence when multiple are present', () => {
    const text =
      '```json-plan\n{"tasks":["first draft"]}\n```\n\nthen on reflection:\n' +
      '```json-plan\n{"tasks":["final draft"]}\n```';
    expect(extractPlanFrame(text).tasks).toEqual(['final draft']);
  });

  it('returns empty on malformed JSON (lenient, not throwing)', () => {
    const text = '```json-plan\n{"tasks":[bad json\n```';
    expect(extractPlanFrame(text)).toEqual({ tasks: [], chips: [] });
  });

  it('ignores non-string task entries', () => {
    const text = '```json-plan\n{"tasks":["keep me", 42, null, "me too"]}\n```';
    expect(extractPlanFrame(text).tasks).toEqual(['keep me', 'me too']);
  });

  it('trims whitespace from tasks and chips and drops empties', () => {
    const text =
      '```json-plan\n' +
      '{"tasks":["  spaced  ","","    "],"chips":["  chip  ",""]}\n' +
      '```';
    expect(extractPlanFrame(text)).toEqual({
      tasks: ['spaced'],
      chips: ['chip'],
    });
  });

  it('returns empty when the parsed payload is not an object', () => {
    const text = '```json-plan\n["not","an","object"]\n```';
    expect(extractPlanFrame(text)).toEqual({ tasks: [], chips: [] });
  });
});
