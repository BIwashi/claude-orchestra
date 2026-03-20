import { describe, it, expect } from 'vitest';
import { createEngine, loadConfig, DEFAULT_CONFIG } from '../lib/engine.js';
import { SynthEngine } from '../lib/synth-engine.js';
import { SampleEngine } from '../lib/sample-engine.js';
import { MixerEngine } from '../lib/mixer-engine.js';
import { BaseEngine } from '../lib/base-engine.js';

describe('createEngine', () => {
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
});

describe('DEFAULT_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_CONFIG.mode).toBe('synth');
    expect(DEFAULT_CONFIG.track).toBeNull();
    expect(DEFAULT_CONFIG.volume).toBe(0.5);
  });
});

describe('loadConfig', () => {
  it('returns default config when no file exists', () => {
    const config = loadConfig();
    expect(config).toHaveProperty('mode');
    expect(config).toHaveProperty('volume');
  });
});

describe('BaseEngine', () => {
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
