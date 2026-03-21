import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NOTES, CHROMATIC } from './music-theory.js';

const CACHE_DIR = join(homedir(), '.claude-orchestra', 'cache');
const SAMPLE_RATE = 44100;

/**
 * Generate a WAV file for a specific instrument + note combination using ffmpeg.
 * Uses lavfi sine wave synthesis with harmonics to simulate instrument timbre.
 */
function generateTone(instrument, noteName, frequency, durationSec) {
  const outPath = join(CACHE_DIR, `${instrument.id}_${noteName}.wav`);
  if (existsSync(outPath)) return outPath;

  // Build lavfi filter: sum of sine waves for each harmonic
  const harmonicFilters = instrument.harmonics
    .map((h, i) => {
      const freq = frequency * h.multiplier;
      // Clamp frequency to Nyquist
      if (freq >= SAMPLE_RATE / 2) return null;
      return `sine=frequency=${freq}:sample_rate=${SAMPLE_RATE}:duration=${durationSec}[h${i}]`;
    })
    .filter(Boolean);

  if (harmonicFilters.length === 0) return null;

  const mixInputs = harmonicFilters.map((_, i) => `[h${i}]`).join('');
  const weights = instrument.harmonics
    .slice(0, harmonicFilters.length)
    .map((h) => h.amplitude)
    .join(' ');

  // Build ffmpeg command with envelope (attack + decay)
  const attack = instrument.attack || 0.01;
  const decay = instrument.decay || 0.3;

  let filterComplex;
  if (harmonicFilters.length === 1) {
    filterComplex = `${harmonicFilters[0]};[h0]afade=t=in:d=${attack},afade=t=out:st=${Math.max(0, durationSec - decay)}:d=${decay}[out]`;
  } else {
    filterComplex = `${harmonicFilters.join(';')};${mixInputs}amix=inputs=${harmonicFilters.length}:weights=${weights}[mixed];[mixed]afade=t=in:d=${attack},afade=t=out:st=${Math.max(0, durationSec - decay)}:d=${decay}[out]`;
  }

  const cmd = [
    'ffmpeg',
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-filter_complex',
    `"${filterComplex}"`,
    '-map',
    '"[out]"',
    '-ar',
    String(SAMPLE_RATE),
    '-ac',
    '1',
    '-f',
    'wav',
    `"${outPath}"`,
  ].join(' ');

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 5000 });
    return outPath;
  } catch (e) {
    console.error(`Failed to generate tone: ${instrument.id}/${noteName}:`, e.message);
    return null;
  }
}

/**
 * Pre-generate all tone files for all instruments × notes.
 */
async function generateAllTones(instruments) {
  mkdirSync(CACHE_DIR, { recursive: true });

  const allNotes = { ...NOTES, ...CHROMATIC };
  let count = 0;
  let skipped = 0;

  for (const instrument of instruments) {
    for (const [noteName, freq] of Object.entries(allNotes)) {
      // Only generate notes in the instrument's octave range (±1)
      const noteOctave = parseInt(noteName.slice(-1));
      if (Math.abs(noteOctave - instrument.octave) > 1) continue;

      // Duration: longer for instruments with longer decay
      const duration = 0.3 + (instrument.decay || 0.3);

      const path = join(CACHE_DIR, `${instrument.id}_${noteName}.wav`);
      if (existsSync(path)) {
        skipped++;
        continue;
      }

      generateTone(instrument, noteName, freq, duration);
      count++;
    }
  }

  console.log(`  Tone cache: generated ${count}, cached ${skipped}`);
}

function getTonePath(instrumentId, noteName) {
  return join(CACHE_DIR, `${instrumentId}_${noteName}.wav`);
}

export { generateAllTones, generateTone, getTonePath, CACHE_DIR };
