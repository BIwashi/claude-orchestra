import { describe, it, expect, beforeEach } from 'vitest';
import { ActivityMapper } from '../lib/activity-mapper.js';

const mockInstrument = { id: 'piano', name: 'Piano', octave: 4 };

describe('ActivityMapper', () => {
  let mapper;

  beforeEach(() => {
    mapper = new ActivityMapper();
  });

  it('maps a tool event to musical parameters', () => {
    const event = { session_id: 'sess-1', tool_name: 'Read' };
    const result = mapper.map(event, mockInstrument, 1);

    expect(result).not.toBeNull();
    expect(result.instrumentId).toBe('piano');
    expect(result.noteName).toBe('C4');
    expect(result.volume).toBeGreaterThan(0);
    expect(result.toolName).toBe('Read');
  });

  it('maps different tools to different notes', () => {
    const readResult = mapper.map({ session_id: 's1', tool_name: 'Read' }, mockInstrument, 1);
    const bashResult = mapper.map({ session_id: 's2', tool_name: 'Bash' }, mockInstrument, 1);

    expect(readResult.noteName).not.toBe(bashResult.noteName);
  });

  it('uses instrument octave for note', () => {
    const celloInstrument = { id: 'cello', name: 'Cello', octave: 3 };
    const event = { session_id: 'sess-1', tool_name: 'Read' };
    const result = mapper.map(event, celloInstrument, 1);

    expect(result.noteName).toBe('C3');
  });

  it('rate limits events per session', () => {
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(mapper.map({ session_id: 'sess-1', tool_name: 'Read' }, mockInstrument, 1));
    }
    const played = results.filter((r) => r !== null);
    expect(played.length).toBeLessThanOrEqual(4);
  });

  it('rate limits per session independently', () => {
    // Fill up session 1
    for (let i = 0; i < 5; i++) {
      mapper.map({ session_id: 'sess-1', tool_name: 'Read' }, mockInstrument, 1);
    }
    // Session 2 should still work
    const result = mapper.map({ session_id: 'sess-2', tool_name: 'Read' }, mockInstrument, 2);
    expect(result).not.toBeNull();
  });

  it('boosts volume for active tools', () => {
    const readResult = mapper.map({ session_id: 's1', tool_name: 'Read' }, mockInstrument, 1);
    const editResult = mapper.map({ session_id: 's2', tool_name: 'Edit' }, mockInstrument, 1);

    expect(editResult.volume).toBeGreaterThan(readResult.volume);
  });

  it('extracts tool name from input when not at top level', () => {
    const event = { session_id: 'sess-1', input: { tool_name: 'Grep' } };
    const result = mapper.map(event, mockInstrument, 1);

    expect(result.toolName).toBe('Grep');
  });
});
