import { describe, expect, it, vi } from 'vitest';
import { handleEvent, loadInstruments } from '../lib/conductor-daemon.js';

function createRegistry() {
  const sessions = new Map();
  return {
    get count() {
      return sessions.size;
    },
    register(sessionId) {
      if (sessions.has(sessionId)) {
        return { instrument: sessions.get(sessionId), isNew: false };
      }
      const instrument = { id: `inst-${sessionId}`, name: `Inst ${sessionId}` };
      sessions.set(sessionId, instrument);
      return { instrument, isNew: true };
    },
    unregister(sessionId) {
      const instrument = sessions.get(sessionId) || null;
      sessions.delete(sessionId);
      return instrument;
    },
    getAll() {
      return [...sessions.entries()].map(([sessionId, instrument]) => ({ sessionId, instrument }));
    },
  };
}

function createEngine() {
  return {
    handleCompact: vi.fn(),
    handleError: vi.fn(),
    handleSessionJoin: vi.fn(),
    handleSessionLeave: vi.fn(),
    handleToolEvent: vi.fn(),
  };
}

describe('conductor-daemon handleEvent', () => {
  it('dispatches SessionStart and SessionEnd events', () => {
    const registry = createRegistry();
    const engine = createEngine();

    handleEvent({ hook_event_name: 'SessionStart', session_id: 's1' }, registry, engine);
    expect(engine.handleSessionJoin).toHaveBeenCalledTimes(1);

    handleEvent({ hook_event_name: 'SessionEnd', session_id: 's1' }, registry, engine);
    expect(engine.handleSessionLeave).toHaveBeenCalledTimes(1);
  });

  it('dispatches Compact events', () => {
    const registry = createRegistry();
    const engine = createEngine();
    registry.register('s1');

    handleEvent({ hook_event_name: 'Compact', session_id: 's1' }, registry, engine);
    expect(engine.handleCompact).toHaveBeenCalledTimes(1);
    expect(engine.handleCompact.mock.calls[0][0]).toHaveLength(1);
  });

  it('registers new sessions on first tool event and then processes tool use', () => {
    const registry = createRegistry();
    const engine = createEngine();

    handleEvent({ hook_event_name: 'ToolUse', session_id: 's1', input: {} }, registry, engine);
    expect(engine.handleSessionJoin).toHaveBeenCalledTimes(1);
    expect(engine.handleToolEvent).toHaveBeenCalledTimes(0);

    handleEvent({ hook_event_name: 'ToolUse', session_id: 's1', input: {} }, registry, engine);
    expect(engine.handleToolEvent).toHaveBeenCalledTimes(1);
  });

  it('handles error events with handleError', () => {
    const registry = createRegistry();
    const engine = createEngine();

    handleEvent({ hook_event_name: 'ToolUse', session_id: 's1', input: {} }, registry, engine);
    handleEvent(
      { hook_event_name: 'ToolUse', session_id: 's1', input: { error: 'boom' } },
      registry,
      engine,
    );

    expect(engine.handleError).toHaveBeenCalledTimes(1);
    expect(engine.handleToolEvent).toHaveBeenCalledTimes(0);
  });
});

describe('conductor-daemon loadInstruments', () => {
  it('returns instrument entries with expected ids', () => {
    const instruments = loadInstruments();
    expect(Array.isArray(instruments)).toBe(true);
    const ids = instruments.map((instrument) => instrument.id);
    expect(ids).toContain('piano');
    expect(ids).toContain('cello');
    expect(ids).toContain('flute');
  });
});
