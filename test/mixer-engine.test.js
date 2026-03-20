import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MixerEngine } from '../lib/mixer-engine.js';

function createFakeProcess() {
  const handlers = new Map();
  return {
    killed: false,
    on(event, handler) {
      handlers.set(event, handler);
    },
    kill() {
      this.killed = true;
    },
    emit(event) {
      const handler = handlers.get(event);
      if (handler) handler();
    },
  };
}

describe('MixerEngine', () => {
  let rootDir;
  let trackDir;
  let nowMs;
  let mixCalls;
  let playbackCalls;
  let spawnedProcesses;
  let engine;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'claude-orchestra-mixer-'));
    trackDir = join(rootDir, 'track');
    mkdirSync(join(trackDir, 'sections', 'intro'), { recursive: true });
    mkdirSync(join(trackDir, 'sections', 'finale'), { recursive: true });

    const manifest = {
      name: 'Test Track',
      eventsPerSection: 2,
      maxParts: 4,
      sections: [
        {
          id: 'intro',
          loop: false,
          parts: [
            { file: 'sections/intro/part-0.wav', volume: 0.5 },
            { file: 'sections/intro/part-1.wav', volume: 0.6 },
            { file: 'sections/intro/part-2.wav', volume: 0.7 },
          ],
        },
        {
          id: 'finale',
          loop: true,
          parts: [
            { file: 'sections/finale/part-0.wav', volume: 0.4 },
            { file: 'sections/finale/part-1.wav', volume: 0.5 },
          ],
        },
      ],
    };

    writeFileSync(join(trackDir, 'manifest.json'), JSON.stringify(manifest));
    for (const file of [
      'sections/intro/part-0.wav',
      'sections/intro/part-1.wav',
      'sections/intro/part-2.wav',
      'sections/finale/part-0.wav',
      'sections/finale/part-1.wav',
    ]) {
      writeFileSync(join(trackDir, file), '');
    }

    nowMs = 10_000;
    mixCalls = [];
    playbackCalls = [];
    spawnedProcesses = [];

    engine = new MixerEngine(
      { mode: 'mixer', track: 'test-track', volume: 0.8 },
      {
        now: () => nowMs,
        tmpDir: rootDir,
        probeDuration: (_filePath, sectionIndex) => (sectionIndex === 0 ? 12 : 8),
        runProcessSync: (command, args) => {
          mixCalls.push({ command, args });
          return { status: 0, stdout: '' };
        },
        spawnProcess: (command, args) => {
          const proc = createFakeProcess();
          playbackCalls.push({ command, args, proc });
          spawnedProcesses.push(proc);
          return proc;
        },
      },
    );

    engine.trackDir = trackDir;
    engine.manifest = manifest;
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('mixes and plays only the first part for a single session', () => {
    engine.handleSessionJoin({ id: 'strings' }, 1);

    expect(mixCalls).toHaveLength(1);
    expect(mixCalls[0].command).toBe('sox');
    expect(mixCalls[0].args).toEqual([
      '-v',
      '0.4',
      join(trackDir, 'sections/intro/part-0.wav'),
      join(rootDir, 'claude-orchestra-mix-intro.wav'),
    ]);
    expect(playbackCalls).toHaveLength(1);
    expect(playbackCalls[0].command).toBe('ffplay');
    expect(playbackCalls[0].args).toEqual([
      '-ss',
      '0',
      '-nodisp',
      '-autoexit',
      join(rootDir, 'claude-orchestra-mix-intro.wav'),
    ]);
  });

  it('re-mixes and seeks to the elapsed offset when a session joins mid-section', () => {
    engine.handleSessionJoin({ id: 'strings' }, 1);
    nowMs += 2500;

    engine.handleSessionJoin({ id: 'brass' }, 2);

    expect(spawnedProcesses[0].killed).toBe(true);
    expect(mixCalls).toHaveLength(2);
    expect(mixCalls[1].args).toEqual([
      '-m',
      '-v',
      '0.4',
      join(trackDir, 'sections/intro/part-0.wav'),
      '-v',
      '0.48',
      join(trackDir, 'sections/intro/part-1.wav'),
      join(rootDir, 'claude-orchestra-mix-intro.wav'),
    ]);
    expect(playbackCalls[1].args).toEqual([
      '-ss',
      '2.5',
      '-nodisp',
      '-autoexit',
      join(rootDir, 'claude-orchestra-mix-intro.wav'),
    ]);
  });

  it('advances sections when the event threshold is reached', () => {
    engine.handleSessionJoin({ id: 'strings' }, 1);

    engine.handleToolEvent({}, { id: 'strings' }, 1);
    engine.handleToolEvent({}, { id: 'strings' }, 1);

    expect(engine.currentSection).toBe(1);
    expect(playbackCalls[1].args).toEqual([
      '-ss',
      '0',
      '-nodisp',
      '-autoexit',
      join(rootDir, 'claude-orchestra-mix-finale.wav'),
    ]);
  });

  it('loops a looping section when playback exits', () => {
    engine.startSection(1, 2, 0);

    expect(playbackCalls).toHaveLength(1);
    playbackCalls[0].proc.emit('exit');

    expect(mixCalls).toHaveLength(2);
    expect(playbackCalls).toHaveLength(2);
    expect(playbackCalls[1].args).toEqual([
      '-ss',
      '0',
      '-nodisp',
      '-autoexit',
      join(rootDir, 'claude-orchestra-mix-finale.wav'),
    ]);
  });

  it('re-mixes with fewer parts and keeps the current offset when sessions leave', () => {
    engine.handleSessionJoin({ id: 'strings' }, 3);
    nowMs += 1750;

    engine.handleSessionLeave({ id: 'winds' }, 1);

    expect(spawnedProcesses[0].killed).toBe(true);
    expect(mixCalls[1].args).toEqual([
      '-v',
      '0.4',
      join(trackDir, 'sections/intro/part-0.wav'),
      join(rootDir, 'claude-orchestra-mix-intro.wav'),
    ]);
    expect(playbackCalls[1].args[1]).toBe('1.75');
  });
});
