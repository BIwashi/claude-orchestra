import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Status file', () => {
  const testDir = join(tmpdir(), `orchestra-status-test-${Date.now()}`);
  const statusFile = join(testDir, 'status.json');

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should write valid JSON status', () => {
    const status = {
      track: 'orpheus-underworld',
      mode: 'mixer',
      section: 'Galop',
      sectionIndex: 5,
      totalSections: 6,
      volume: 0.5,
      sessions: 2,
      sessionList: [
        { id: 'a1b2c3d4', instrument: 'Piano' },
        { id: 'e5f6g7h8', instrument: 'Cello' },
      ],
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(statusFile, JSON.stringify(status) + '\n');

    const parsed = JSON.parse(readFileSync(statusFile, 'utf-8'));
    expect(parsed.track).toBe('orpheus-underworld');
    expect(parsed.sessions).toBe(2);
    expect(parsed.sessionList).toHaveLength(2);
    expect(parsed.sessionList[0].instrument).toBe('Piano');
  });

  it('should handle synth mode status', () => {
    const status = {
      track: '(synth)',
      mode: 'synth',
      section: 'idle',
      sectionIndex: -1,
      totalSections: 0,
      volume: 0.3,
      sessions: 0,
      sessionList: [],
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(statusFile, JSON.stringify(status) + '\n');

    const parsed = JSON.parse(readFileSync(statusFile, 'utf-8'));
    expect(parsed.mode).toBe('synth');
    expect(parsed.sessions).toBe(0);
  });

  it('should contain all required fields', () => {
    const status = {
      track: 'morning-mood',
      mode: 'mixer',
      section: 'Dawn',
      sectionIndex: 0,
      totalSections: 4,
      volume: 0.7,
      sessions: 1,
      sessionList: [{ id: 'test1234', instrument: 'Flute' }],
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(statusFile, JSON.stringify(status) + '\n');

    const parsed = JSON.parse(readFileSync(statusFile, 'utf-8'));
    const requiredFields = [
      'track',
      'mode',
      'section',
      'sectionIndex',
      'totalSections',
      'volume',
      'sessions',
      'sessionList',
      'updatedAt',
    ];
    for (const field of requiredFields) {
      expect(parsed).toHaveProperty(field);
    }
  });
});
