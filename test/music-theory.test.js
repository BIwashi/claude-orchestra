import { describe, it, expect } from 'vitest';
import {
  NOTES,
  CHROMATIC,
  ARPEGGIOS,
  getNoteForTool,
  getDurationForTool,
  getFrequency,
  getProgression,
  volumeForSessions,
} from '../lib/music-theory.js';

describe('NOTES', () => {
  it('generates notes across octaves 3-6', () => {
    expect(NOTES).toHaveProperty('C4');
    expect(NOTES).toHaveProperty('A3');
    expect(NOTES).toHaveProperty('G6');
    expect(NOTES['A4']).toBeCloseTo(440.0);
  });

  it('doubles frequency per octave', () => {
    expect(NOTES['C5']).toBeCloseTo(NOTES['C4'] * 2);
    expect(NOTES['C3']).toBeCloseTo(NOTES['C4'] / 2);
  });
});

describe('CHROMATIC', () => {
  it('has chromatic notes for tension', () => {
    expect(Object.keys(CHROMATIC).length).toBeGreaterThan(0);
    expect(CHROMATIC).toHaveProperty('Db4');
    expect(CHROMATIC).toHaveProperty('Eb4');
  });
});

describe('ARPEGGIOS', () => {
  it('has join, leave, error, compact patterns', () => {
    expect(ARPEGGIOS.join).toBeInstanceOf(Array);
    expect(ARPEGGIOS.leave).toBeInstanceOf(Array);
    expect(ARPEGGIOS.error).toBeInstanceOf(Array);
    expect(ARPEGGIOS.compact).toBeInstanceOf(Array);
  });

  it('join arpeggio ascends', () => {
    const notes = ARPEGGIOS.join;
    expect(notes.length).toBeGreaterThanOrEqual(3);
  });
});

describe('getNoteForTool', () => {
  it('maps known tools to notes', () => {
    expect(getNoteForTool('Read')).toBe('C');
    expect(getNoteForTool('Bash')).toBe('G');
    expect(getNoteForTool('Edit')).toBe('E');
    expect(getNoteForTool('Grep')).toBe('A');
  });

  it('returns default for unknown tools', () => {
    expect(getNoteForTool('UnknownTool')).toBe('C');
  });
});

describe('getDurationForTool', () => {
  it('returns durations for known tools', () => {
    expect(getDurationForTool('Read')).toBe(150);
    expect(getDurationForTool('Write')).toBe(500);
    expect(getDurationForTool('Bash')).toBe(300);
  });

  it('returns default for unknown tools', () => {
    expect(getDurationForTool('UnknownTool')).toBe(200);
  });
});

describe('getFrequency', () => {
  it('returns frequency for pentatonic notes', () => {
    expect(getFrequency('A4')).toBeCloseTo(440.0);
    expect(getFrequency('C4')).toBeCloseTo(261.63);
  });

  it('returns frequency for chromatic notes', () => {
    expect(getFrequency('Db4')).toBeCloseTo(277.18);
  });

  it('falls back to C for unknown notes', () => {
    expect(getFrequency('X9')).toBeCloseTo(261.63);
  });
});

describe('getProgression', () => {
  it('returns progressions for different session counts', () => {
    expect(getProgression(1)).toHaveLength(1);
    expect(getProgression(2)).toHaveLength(2);
    expect(getProgression(3)).toHaveLength(4);
    expect(getProgression(4)).toHaveLength(4);
  });

  it('caps at 4 sessions', () => {
    expect(getProgression(10)).toEqual(getProgression(4));
  });

  it('returns chord arrays', () => {
    const prog = getProgression(3);
    for (const chord of prog) {
      expect(chord).toBeInstanceOf(Array);
      expect(chord.length).toBeGreaterThan(0);
    }
  });
});

describe('volumeForSessions', () => {
  it('decreases with more sessions', () => {
    const v1 = volumeForSessions(1);
    const v2 = volumeForSessions(2);
    const v4 = volumeForSessions(4);
    expect(v1).toBeGreaterThan(v2);
    expect(v2).toBeGreaterThan(v4);
  });

  it('never exceeds 0.8', () => {
    expect(volumeForSessions(1)).toBeLessThanOrEqual(0.8);
  });

  it('handles edge case of 0', () => {
    expect(volumeForSessions(0)).toBeLessThanOrEqual(0.8);
    expect(volumeForSessions(0)).toBeGreaterThan(0);
  });
});
