import { describe, it, expect } from 'vitest';
import {
  checkCommands,
  checkSetupPrerequisites,
  formatMissingDependencies,
  getInstallHint,
  hasCommand,
} from '../lib/prerequisites.js';

describe('hasCommand', () => {
  it('returns true when the command exists', () => {
    const result = hasCommand('ffmpeg', {
      spawnSyncFn: () => ({ status: 0 }),
    });

    expect(result).toBe(true);
  });

  it('returns false when the command is missing', () => {
    const result = hasCommand('ffmpeg', {
      spawnSyncFn: () => ({ status: 1 }),
    });

    expect(result).toBe(false);
  });
});

describe('getInstallHint', () => {
  it('returns brew install instructions for known commands', () => {
    expect(getInstallHint('ffmpeg')).toBe('brew install ffmpeg');
    expect(getInstallHint('sox')).toBe('brew install sox');
    expect(getInstallHint('fluidsynth')).toBe('brew install fluid-synth');
  });
});

describe('checkCommands', () => {
  it('reports availability and install hints', () => {
    const available = new Set(['ffmpeg', 'ffplay']);
    const result = checkCommands(['ffmpeg', 'sox', 'ffplay'], {
      hasCommandFn: (command) => available.has(command),
    });

    expect(result).toEqual([
      { command: 'ffmpeg', available: true, installHint: 'brew install ffmpeg' },
      { command: 'sox', available: false, installHint: 'brew install sox' },
      { command: 'ffplay', available: true, installHint: 'brew install ffmpeg' },
    ]);
  });
});

describe('checkSetupPrerequisites', () => {
  it('marks mixer mode ready only when sox and ffplay are installed', () => {
    const available = new Set(['ffmpeg', 'sox', 'fluidsynth']);
    const result = checkSetupPrerequisites({
      hasCommandFn: (command) => available.has(command),
    });

    expect(result.ffmpeg.available).toBe(true);
    expect(result.sox.available).toBe(true);
    expect(result.ffplay.available).toBe(false);
    expect(result.fluidsynth.available).toBe(true);
    expect(result.missingRequired).toEqual([]);
    expect(result.missingMixer).toEqual([
      { command: 'ffplay', available: false, installHint: 'brew install ffmpeg' },
    ]);
    expect(result.mixerReady).toBe(false);
  });

  it('reports ffmpeg as required for all modes', () => {
    const result = checkSetupPrerequisites({
      hasCommandFn: () => false,
    });

    expect(result.missingRequired).toEqual([
      { command: 'ffmpeg', available: false, installHint: 'brew install ffmpeg' },
    ]);
    expect(result.missingMixer).toEqual([
      { command: 'sox', available: false, installHint: 'brew install sox' },
      { command: 'ffplay', available: false, installHint: 'brew install ffmpeg' },
    ]);
  });
});

describe('formatMissingDependencies', () => {
  it('formats install instructions for output', () => {
    const lines = formatMissingDependencies([
      { command: 'ffmpeg', available: false, installHint: 'brew install ffmpeg' },
      { command: 'sox', available: false, installHint: 'brew install sox' },
    ]);

    expect(lines).toEqual(['- ffmpeg: brew install ffmpeg', '- sox: brew install sox']);
  });
});
