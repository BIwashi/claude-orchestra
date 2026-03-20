import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SynthEngine } from './synth-engine.js';
import { SampleEngine } from './sample-engine.js';
import { MixerEngine } from './mixer-engine.js';

const ORCHESTRA_DIR = join(process.env.HOME, '.claude-orchestra');
const CONFIG_PATH = join(ORCHESTRA_DIR, 'config.json');

const DEFAULT_CONFIG = {
  mode: 'synth',
  track: null,
  volume: 0.5,
};

/**
 * Load config from ~/.claude-orchestra/config.json.
 */
function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Factory: create the appropriate engine based on config.
 */
function createEngine(config = null) {
  const cfg = config || loadConfig();

  if (cfg.mode === 'sample') {
    return new SampleEngine(cfg);
  }

  if (cfg.mode === 'mixer') {
    return new MixerEngine(cfg);
  }

  return new SynthEngine(cfg);
}

export { createEngine, loadConfig, CONFIG_PATH, DEFAULT_CONFIG };
