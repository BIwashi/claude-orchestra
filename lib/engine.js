import { homedir } from 'node:os';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SynthEngine } from './synth-engine.js';
import { SampleEngine } from './sample-engine.js';
import { MixerEngine } from './mixer-engine.js';
import { commandExists, detectPlayer } from './playback.js';

const ORCHESTRA_DIR = join(homedir(), '.claude-orchestra');
const CONFIG_PATH = join(ORCHESTRA_DIR, 'config.json');

const DEFAULT_CONFIG = {
  mode: 'synth',
  track: null,
  volume: 0.5,
};

const VALID_MODES = new Set(['synth', 'mixer', 'sample']);

function warnInvalidConfig(message) {
  console.warn(`Warning: ${message}. Using default value.`);
}

function validateConfig(config) {
  const validated = { ...DEFAULT_CONFIG, ...config };

  if (!VALID_MODES.has(validated.mode)) {
    warnInvalidConfig(`Invalid config mode "${validated.mode}"`);
    validated.mode = DEFAULT_CONFIG.mode;
  }

  if (
    typeof validated.volume !== 'number' ||
    Number.isNaN(validated.volume) ||
    validated.volume < 0 ||
    validated.volume > 1
  ) {
    warnInvalidConfig(`Invalid config volume "${validated.volume}"`);
    validated.volume = DEFAULT_CONFIG.volume;
  }

  return validated;
}

/**
 * Load config from ~/.claude-orchestra/config.json.
 */
function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
      return validateConfig(data);
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
  const cfg = config ? validateConfig(config) : loadConfig();

  if (cfg.mode === 'sample') {
    if (!detectPlayer()) {
      console.warn(
        'Warning: no supported audio player found for sample mode. Falling back to synth mode.',
      );
      return new SynthEngine({ ...cfg, mode: 'synth' });
    }
    return new SampleEngine(cfg);
  }

  if (cfg.mode === 'mixer') {
    if (!commandExists('sox') || !commandExists('ffplay')) {
      console.warn('Warning: mixer mode requires both sox and ffplay. Falling back to synth mode.');
      return new SynthEngine({ ...cfg, mode: 'synth' });
    }
    return new MixerEngine(cfg);
  }

  return new SynthEngine(cfg);
}

export { createEngine, loadConfig, CONFIG_PATH, DEFAULT_CONFIG, validateConfig };
