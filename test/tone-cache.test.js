import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mockState = vi.hoisted(() => ({
  homeDir: '',
  execSync: vi.fn(),
}));

vi.mock('node:os', async () => {
  const actual = await vi.importActual('node:os');
  return {
    ...actual,
    homedir: () => mockState.homeDir,
  };
});

vi.mock('node:child_process', () => ({
  execSync: mockState.execSync,
}));

describe('tone-cache', () => {
  let tempDir;
  let toneCache;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'claude-orchestra-tone-cache-'));
    mockState.homeDir = tempDir;
    mockState.execSync.mockReset();

    vi.resetModules();
    toneCache = await import('../lib/tone-cache.js');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('getTonePath returns expected cache path format', () => {
    const path = toneCache.getTonePath('piano', 'C4');
    expect(path).toBe(join(tempDir, '.claude-orchestra', 'cache', 'piano_C4.wav'));
  });

  it('generateTone uses ffmpeg command and returns output path', () => {
    const instrument = {
      id: 'piano',
      harmonics: [
        { multiplier: 1, amplitude: 1.0 },
        { multiplier: 2, amplitude: 0.4 },
      ],
      attack: 0.02,
      decay: 0.3,
    };

    const out = toneCache.generateTone(instrument, 'A4', 440, 0.8);

    expect(out).toBe(join(tempDir, '.claude-orchestra', 'cache', 'piano_A4.wav'));
    expect(mockState.execSync).toHaveBeenCalledTimes(1);
    const cmd = mockState.execSync.mock.calls[0][0];
    expect(cmd).toContain('ffmpeg');
    expect(cmd).toContain('piano_A4.wav');
    expect(cmd).toContain('amix=inputs=2');
  });
});
