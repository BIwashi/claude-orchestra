import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  homeDir: '',
}));

vi.mock('node:os', async () => {
  const actual = await vi.importActual('node:os');
  return {
    ...actual,
    homedir: () => mockState.homeDir,
  };
});

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
  let tempDir;
  let daemon;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'claude-orchestra-daemon-test-'));
    mockState.homeDir = tempDir;
    vi.resetModules();
    daemon = await import('../lib/conductor-daemon.js');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    delete process.env.CLAUDE_ORCHESTRA_DEBUG;
  });

  it('dispatches SessionStart and SessionEnd events', () => {
    const registry = createRegistry();
    const engine = createEngine();

    daemon.handleEvent({ hook_event_name: 'SessionStart', session_id: 's1' }, registry, engine);
    expect(engine.handleSessionJoin).toHaveBeenCalledTimes(1);

    daemon.handleEvent({ hook_event_name: 'SessionEnd', session_id: 's1' }, registry, engine);
    expect(engine.handleSessionLeave).toHaveBeenCalledTimes(1);
  });

  it('dispatches Compact events', () => {
    const registry = createRegistry();
    const engine = createEngine();
    registry.register('s1');

    daemon.handleEvent({ hook_event_name: 'Compact', session_id: 's1' }, registry, engine);
    expect(engine.handleCompact).toHaveBeenCalledTimes(1);
    expect(engine.handleCompact.mock.calls[0][0]).toHaveLength(1);
  });

  it('registers new sessions on first tool event and then processes tool use', () => {
    const registry = createRegistry();
    const engine = createEngine();

    daemon.handleEvent(
      { hook_event_name: 'ToolUse', session_id: 's1', input: {} },
      registry,
      engine,
    );
    expect(engine.handleSessionJoin).toHaveBeenCalledTimes(1);
    expect(engine.handleToolEvent).toHaveBeenCalledTimes(0);

    daemon.handleEvent(
      { hook_event_name: 'ToolUse', session_id: 's1', input: {} },
      registry,
      engine,
    );
    expect(engine.handleToolEvent).toHaveBeenCalledTimes(1);
  });

  it('handles error events with handleError', () => {
    const registry = createRegistry();
    const engine = createEngine();

    daemon.handleEvent(
      { hook_event_name: 'ToolUse', session_id: 's1', input: {} },
      registry,
      engine,
    );
    daemon.handleEvent(
      { hook_event_name: 'ToolUse', session_id: 's1', input: { error: 'boom' } },
      registry,
      engine,
    );

    expect(engine.handleError).toHaveBeenCalledTimes(1);
    expect(engine.handleToolEvent).toHaveBeenCalledTimes(0);
  });

  it('cleans up stale event files when startup backlog is too large', () => {
    const eventsDir = join(tempDir, '.claude-orchestra', 'events');
    mkdirSync(eventsDir, { recursive: true });
    for (let i = 0; i < 101; i++) {
      writeFileSync(join(eventsDir, `event-${i}.json`), '{}');
    }

    const removed = daemon.cleanupStaleEvents();

    expect(removed).toBe(101);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Cleaned up 101 stale event files on startup.'),
    );
  });

  it('wraps engine methods with debug hooks when debug mode is enabled', async () => {
    process.env.CLAUDE_ORCHESTRA_DEBUG = '1';
    vi.resetModules();
    daemon = await import('../lib/conductor-daemon.js');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const engine = {
      manifest: { sections: [{ id: 'intro' }] },
      startSection: vi.fn(),
      setVolume: vi.fn(),
    };

    daemon.attachDebugHooks(engine);
    engine.startSection(0, 2, 1.5);
    engine.setVolume(0.4);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Section transition: intro'));
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Volume update requested: 0.4'),
    );
  });
});

describe('conductor-daemon loadInstruments', () => {
  let tempDir;
  let daemon;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'claude-orchestra-daemon-test-'));
    mockState.homeDir = tempDir;
    vi.resetModules();
    daemon = await import('../lib/conductor-daemon.js');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns instrument entries with expected ids', () => {
    const instruments = daemon.loadInstruments();
    expect(Array.isArray(instruments)).toBe(true);
    const ids = instruments.map((instrument) => instrument.id);
    expect(ids).toContain('piano');
    expect(ids).toContain('cello');
    expect(ids).toContain('flute');
  });
});
