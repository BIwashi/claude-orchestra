import { homedir } from 'node:os';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ORCHESTRA_DIR = join(homedir(), '.claude-orchestra');
const VOLUME_SIGNAL_PATH = join(ORCHESTRA_DIR, 'volume-signal');

function clampVolume(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new Error(`Invalid volume value: ${value}`);
  }

  return Math.max(0, Math.min(1, numericValue));
}

function parseVolumeSignal(content) {
  return clampVolume(String(content).trim());
}

function writeVolumeSignal(value) {
  const volume = clampVolume(value);
  mkdirSync(ORCHESTRA_DIR, { recursive: true });
  writeFileSync(VOLUME_SIGNAL_PATH, `${volume}\n`);
  return volume;
}

function readVolumeSignal() {
  if (!existsSync(VOLUME_SIGNAL_PATH)) {
    return null;
  }

  const content = readFileSync(VOLUME_SIGNAL_PATH, 'utf-8');
  return parseVolumeSignal(content);
}

function consumeVolumeSignal() {
  if (!existsSync(VOLUME_SIGNAL_PATH)) {
    return null;
  }

  try {
    return readVolumeSignal();
  } finally {
    unlinkSync(VOLUME_SIGNAL_PATH);
  }
}

export {
  ORCHESTRA_DIR,
  VOLUME_SIGNAL_PATH,
  clampVolume,
  parseVolumeSignal,
  writeVolumeSignal,
  readVolumeSignal,
  consumeVolumeSignal,
};
