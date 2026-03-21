import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mockState = vi.hoisted(() => ({
  hasPlayer: true,
  hasSox: true,
  hasFfplay: true,
  homeDir: '',
}));

vi.mock('node:os', async () => {
  const actual = await vi.importActual('node:os');
  return {
    ...actual,
    homedir: () => mockState.homeDir,
  };
});

vi.mock('../lib/playback.js', async () => {
  const actual = await vi.importActual('../lib/playback.js');
  return {
    ...actual,
    commandExists: vi.fn((command) => {
      if (command === 'sox') return mockState.hasSox;
      if (command === 'ffplay') return mockState.hasFfplay;
      return false;
    }),
    detectPlayer: vi.fn(() => (mockState.hasPlayer ? { command: 'ffplay' } : null)),
  };
});

describe('createEngine', () => {
  let createEngine;
  let SynthEngine;
  let SampleEngine;
  let MixerEngine;
  let BaseEngine;

  beforeEach(() => {
    mockState.hasPlayer = true;
    mockState.hasSox = true;
    mockState.hasFfplay = true;
    mockState.homeDir = '';
  });

  beforeEach(async () => {
    vi.resetModules();
    ({ createEngine } = await import('../lib/engine.js'));
    ({ SynthEngine } = await import('../lib/synth-engine.js'));
    ({ SampleEngine } = await import('../lib/sample-engine.js'));
    ({ MixerEngine } = await import('../lib/mixer-engine.js'));
    ({ BaseEngine } = await import('../lib/base-engine.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates SynthEngine by default', () => {
    const engine = createEngine({ mode: 'synth' });
    expect(engine).toBeInstanceOf(SynthEngine);
    expect(engine).toBeInstanceOf(BaseEngine);
  });

  it('creates SampleEngine for sample mode', () => {
    const engine = createEngine({ mode: 'sample', track: 'test' });
    expect(engine).toBeInstanceOf(SampleEngine);
    expect(engine).toBeInstanceOf(BaseEngine);
  });

  it('creates MixerEngine for mixer mode', () => {
    const engine = createEngine({ mode: 'mixer', track: 'test' });
    expect(engine).toBeInstanceOf(MixerEngine);
    expect(engine).toBeInstanceOf(BaseEngine);
  });

  it('falls back to SynthEngine for unknown mode', () => {
    const engine = createEngine({ mode: 'unknown' });
    expect(engine).toBeInstanceOf(SynthEngine);
  });

  it('falls back to SynthEngine when mixer dependencies are missing', () => {
    mockState.hasSox = false;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const engine = createEngine({ mode: 'mixer', track: 'test' });

    expect(engine).toBeInstanceOf(SynthEngine);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('falls back to SynthEngine when sample playback is unavailable', () => {
    mockState.hasPlayer = false;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const engine = createEngine({ mode: 'sample', track: 'test' });

    expect(engine).toBeInstanceOf(SynthEngine);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('DEFAULT_CONFIG', () => {
  let DEFAULT_CONFIG;

  beforeEach(async () => {
    vi.resetModules();
    ({ DEFAULT_CONFIG } = await import('../lib/engine.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has expected default values', () => {
    expect(DEFAULT_CONFIG.mode).toBe('synth');
    expect(DEFAULT_CONFIG.track).toBeNull();
    expect(DEFAULT_CONFIG.volume).toBe(0.5);
  });
});

describe('loadConfig', () => {
  let tempDir;
  let loadConfig;
  let DEFAULT_CONFIG;

  beforeEach(() => {
    tempDir = join(tmpdir(), `claude-orchestra-engine-test-${Date.now()}-${Math.random()}`);
    mkdirSync(join(tempDir, '.claude-orchestra'), { recursive: true });
    mockState.homeDir = tempDir;
    mockState.hasPlayer = true;
    mockState.hasSox = true;
    mockState.hasFfplay = true;
  });

  beforeEach(async () => {
    vi.resetModules();
    ({ loadConfig, DEFAULT_CONFIG } = await import('../lib/engine.js'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns default config when no file exists', () => {
    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('replaces invalid config values with defaults and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const configPath = join(tempDir, '.claude-orchestra', 'config.json');
    writeFileSync(configPath, JSON.stringify({ mode: 'broken', volume: 'loud' }));

    const config = loadConfig();

    expect(config.mode).toBe(DEFAULT_CONFIG.mode);
    expect(config.volume).toBe(DEFAULT_CONFIG.volume);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('replaces out-of-range volume values with the default and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const configPath = join(tempDir, '.claude-orchestra', 'config.json');
    writeFileSync(configPath, JSON.stringify({ mode: 'synth', volume: 2 }));

    const config = loadConfig();

    expect(config.volume).toBe(DEFAULT_CONFIG.volume);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('BaseEngine', () => {
  let BaseEngine;

  beforeEach(async () => {
    vi.resetModules();
    ({ BaseEngine } = await import('../lib/base-engine.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws on unimplemented methods', () => {
    const engine = new BaseEngine();
    expect(() => engine.handleToolEvent()).toThrow('must be implemented');
    expect(() => engine.handleSessionJoin()).toThrow('must be implemented');
    expect(() => engine.handleSessionLeave()).toThrow('must be implemented');
    expect(() => engine.handleError()).toThrow('must be implemented');
    expect(() => engine.handleCompact()).toThrow('must be implemented');
    expect(() => engine.handleIdle()).toThrow('must be implemented');
    expect(() => engine.stopAll()).toThrow('must be implemented');
  });

  it('throws on unimplemented init', async () => {
    const engine = new BaseEngine();
    await expect(engine.init([])).rejects.toThrow('must be implemented');
  });
});
