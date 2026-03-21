import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mockState = vi.hoisted(() => ({
  homeDir: '',
}));

vi.mock('node:os', async () => {
  const actual = await vi.importActual('node:os');
  return {
    ...actual,
    homedir: () => mockState.homeDir,
  };
});

describe('conductor-cli helpers', () => {
  let tempDir;
  let cli;
  let CONFIG_PATH;
  let TRACKS_DIR;
  let LOG_FILE;
  let PID_FILE;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'claude-orchestra-cli-test-'));
    mockState.homeDir = tempDir;

    vi.resetModules();
    cli = await import('../lib/conductor-cli.js');
    ({ CONFIG_PATH } = await import('../lib/engine.js'));
    ({ TRACKS_DIR } = await import('../lib/sample-engine.js'));
    ({ LOG_FILE, PID_FILE } = await import('../lib/conductor-daemon.js'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('formatMode includes track when present', () => {
    expect(cli.formatMode({ mode: 'mixer', track: 'demo' })).toBe('mixer / demo');
    expect(cli.formatMode({ mode: 'synth', track: null })).toBe('synth');
  });

  it('formatVolume formats expected percentages', () => {
    expect(cli.formatVolume(0)).toBe('0%');
    expect(cli.formatVolume(0.5)).toBe('50%');
    expect(cli.formatVolume(1)).toBe('100%');
    expect(cli.formatVolume(undefined)).toBe('0%');
  });

  it('inferCurrentSectionIndex reads latest section from log', () => {
    const sections = [
      { id: 'intro', name: 'Intro' },
      { id: 'verse', name: 'Verse' },
      { id: 'chorus', name: 'Chorus' },
    ];
    mkdirSync(join(tempDir, '.claude-orchestra'), { recursive: true });
    writeFileSync(
      LOG_FILE,
      ['line 1', '[section] → Intro', 'line 2', '[section] → Chorus'].join('\n'),
    );

    expect(cli.inferCurrentSectionIndex(sections)).toBe(2);
  });

  it('getUptime returns null when PID file does not exist', () => {
    expect(existsSync(PID_FILE)).toBe(false);
    expect(cli.getUptime()).toBeNull();
  });

  it('getSessionLines handles missing and empty registry', () => {
    const missingPath = join(tempDir, 'missing-registry.json');
    const missing = cli.getSessionLines(missingPath);
    expect(missing.count).toBe(0);
    expect(missing.lines[0]).toContain('No active sessions');

    const emptyPath = join(tempDir, 'empty-registry.json');
    writeFileSync(emptyPath, JSON.stringify({ sessions: {} }));
    const empty = cli.getSessionLines(emptyPath);
    expect(empty.count).toBe(0);
    expect(empty.lines[0]).toContain('No active sessions');
  });

  it('trackUse writes mixer mode config with selected track', () => {
    const trackName = 'demo-track';
    mkdirSync(join(TRACKS_DIR, trackName), { recursive: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    cli.trackUse(trackName);

    const saved = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(saved.mode).toBe('mixer');
    expect(saved.track).toBe(trackName);
  });

  it('handleConfigCommand set writes typed config value', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const argv = ['node', 'conductor', 'config', 'set', 'volume', '0.3'];

    cli.handleConfigCommand('set', argv);

    const saved = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(saved.volume).toBe(0.3);
  });

  it('getUptime returns structured uptime when PID file exists', () => {
    mkdirSync(join(tempDir, '.claude-orchestra'), { recursive: true });
    writeFileSync(PID_FILE, String(process.pid));
    const before = statSync(PID_FILE).mtimeMs;

    const uptime = cli.getUptime();

    expect(uptime).not.toBeNull();
    expect(uptime.pid).toBe(String(process.pid));
    expect(uptime.seconds).toBeGreaterThanOrEqual(0);
    expect(before).toBeGreaterThan(0);
  });
});
