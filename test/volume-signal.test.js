import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('volume signal', () => {
  let tempDir;
  let signalPath;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'claude-orchestra-volume-'));
    signalPath = join(tempDir, 'volume-signal');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function clampVolume(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      throw new Error(`Invalid volume value: ${value}`);
    }
    return Math.max(0, Math.min(1, numericValue));
  }

  function writeSignal(value) {
    const volume = clampVolume(value);
    writeFileSync(signalPath, `${volume}\n`);
    return volume;
  }

  function readSignal() {
    if (!existsSync(signalPath)) return null;
    return clampVolume(readFileSync(signalPath, 'utf-8').trim());
  }

  it('writes a volume signal file', () => {
    const volume = writeSignal(0.7);
    expect(volume).toBe(0.7);
    expect(existsSync(signalPath)).toBe(true);
    expect(readFileSync(signalPath, 'utf-8')).toBe('0.7\n');
  });

  it('reads and parses the signal value', () => {
    writeSignal('0.35');
    expect(readSignal()).toBe(0.35);
  });

  it('clamps values to the 0-1 range', () => {
    writeSignal(1.5);
    expect(readSignal()).toBe(1);

    writeSignal(-0.25);
    expect(readSignal()).toBe(0);
  });

  it('throws on invalid values', () => {
    expect(() => clampVolume('abc')).toThrow('Invalid volume value');
    expect(() => clampVolume(NaN)).toThrow('Invalid volume value');
  });

  it('returns null when no signal file exists', () => {
    expect(readSignal()).toBeNull();
  });
});
