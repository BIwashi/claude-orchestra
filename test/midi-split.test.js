import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { splitMidi, classifyInstrument, GM_INSTRUMENTS } from '../bin/midi-split.js';

describe('midi-split', () => {
  let outputDir;

  beforeEach(() => {
    outputDir = mkdtempSync(join(tmpdir(), 'midi-split-test-'));
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  describe('classifyInstrument', () => {
    it('classifies strings (program 40-46)', () => {
      expect(classifyInstrument(40, 0)).toBe('strings'); // Violin
      expect(classifyInstrument(42, 0)).toBe('strings'); // Cello
      expect(classifyInstrument(43, 0)).toBe('strings'); // Contrabass
    });

    it('classifies string ensembles (program 48-55)', () => {
      expect(classifyInstrument(48, 0)).toBe('strings'); // String Ensemble 1
      expect(classifyInstrument(49, 0)).toBe('strings'); // String Ensemble 2
    });

    it('classifies bass instruments as strings (program 32-39)', () => {
      expect(classifyInstrument(32, 0)).toBe('strings'); // Acoustic Bass
    });

    it('classifies brass (program 56-63)', () => {
      expect(classifyInstrument(56, 0)).toBe('brass'); // Trumpet
      expect(classifyInstrument(57, 0)).toBe('brass'); // Trombone
      expect(classifyInstrument(60, 0)).toBe('brass'); // French Horn
    });

    it('classifies woodwinds (program 64-79)', () => {
      expect(classifyInstrument(68, 0)).toBe('woodwinds'); // Oboe
      expect(classifyInstrument(71, 0)).toBe('woodwinds'); // Clarinet
      expect(classifyInstrument(73, 0)).toBe('woodwinds'); // Flute
    });

    it('classifies timpani as percussion (program 47)', () => {
      expect(classifyInstrument(47, 0)).toBe('percussion');
    });

    it('classifies channel 9 as percussion regardless of program', () => {
      expect(classifyInstrument(0, 9)).toBe('percussion');
      expect(classifyInstrument(48, 9)).toBe('percussion');
    });

    it('classifies keys (program 0-7)', () => {
      expect(classifyInstrument(0, 0)).toBe('keys'); // Acoustic Grand Piano
    });

    it('returns other for null/unknown', () => {
      expect(classifyInstrument(null, 0)).toBe('other');
      expect(classifyInstrument(100, 0)).toBe('other');
    });
  });

  describe('GM_INSTRUMENTS', () => {
    it('has 128 entries', () => {
      expect(GM_INSTRUMENTS).toHaveLength(128);
    });

    it('has correct instrument at known positions', () => {
      expect(GM_INSTRUMENTS[0]).toBe('Acoustic Grand Piano');
      expect(GM_INSTRUMENTS[40]).toBe('Violin');
      expect(GM_INSTRUMENTS[47]).toBe('Timpani');
      expect(GM_INSTRUMENTS[56]).toBe('Trumpet');
      expect(GM_INSTRUMENTS[73]).toBe('Flute');
    });
  });

  describe('splitMidi', () => {
    it('splits the ode-to-joy MIDI file', () => {
      const inputPath = join(
        import.meta.dirname,
        '..',
        'data',
        'tracks',
        'ode-to-joy',
        'source.mid',
      );
      if (!existsSync(inputPath)) return; // skip if not available

      const info = splitMidi(inputPath, outputDir);

      expect(info.format).toBe(1);
      expect(info.numTracks).toBe(8);
      expect(info.tracks[0].name).toBe('Conductor');
      expect(info.tracks[0].noteCount).toBe(0);

      // Track 1-6 should have notes
      for (let i = 1; i <= 6; i++) {
        expect(info.tracks[i].noteCount).toBeGreaterThan(0);
      }

      // Track 7 (GS/RESET) should have no notes
      expect(info.tracks[7].noteCount).toBe(0);

      // Check instrument classification
      const stringsCount = info.tracks.filter((t) => t.group === 'strings').length;
      expect(stringsCount).toBeGreaterThanOrEqual(5);

      // Check output files exist
      expect(existsSync(join(outputDir, 'track-info.json'))).toBe(true);
      expect(existsSync(join(outputDir, 'track-00.mid'))).toBe(true);
      expect(existsSync(join(outputDir, 'track-01.mid'))).toBe(true);

      // Each output MIDI should start with MThd
      const track01 = readFileSync(join(outputDir, 'track-01.mid'));
      expect(track01.toString('ascii', 0, 4)).toBe('MThd');
    });

    it('rejects Format 0 MIDI files', () => {
      // morning-mood is Format 0
      const inputPath = join(
        import.meta.dirname,
        '..',
        'data',
        'tracks',
        'morning-mood',
        'source.mid',
      );
      if (!existsSync(inputPath)) return;

      expect(() => splitMidi(inputPath, outputDir)).toThrow('Only Format 1');
    });

    it('writes valid track-info.json', () => {
      const inputPath = join(
        import.meta.dirname,
        '..',
        'data',
        'tracks',
        'ode-to-joy',
        'source.mid',
      );
      if (!existsSync(inputPath)) return;

      splitMidi(inputPath, outputDir);

      const infoPath = join(outputDir, 'track-info.json');
      const info = JSON.parse(readFileSync(infoPath, 'utf-8'));

      expect(info.source).toBe('source.mid');
      expect(info.ticksPerQuarter).toBeGreaterThan(0);
      expect(Array.isArray(info.tracks)).toBe(true);
      expect(info.tracks.length).toBe(info.numTracks);
    });
  });
});
