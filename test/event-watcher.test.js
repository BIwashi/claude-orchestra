import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

describe('EventWatcher', () => {
  let tempDir;
  let eventsDir;
  let EventWatcher;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'claude-orchestra-event-watcher-'));
    mockState.homeDir = tempDir;
    eventsDir = join(tempDir, '.claude-orchestra', 'events');
    mkdirSync(eventsDir, { recursive: true });

    vi.resetModules();
    ({ EventWatcher } = await import('../lib/event-watcher.js'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('emits events from JSON files in temp directory', async () => {
    const watcher = new EventWatcher();
    const filePath = join(eventsDir, 'event-1.json');
    writeFileSync(filePath, JSON.stringify({ hook_event_name: 'SessionStart', session_id: 's1' }));

    const received = [];
    watcher.on('event', (event) => received.push(event));

    await watcher.processFile(filePath);

    expect(received).toHaveLength(1);
    expect(received[0].session_id).toBe('s1');
  });

  it('processExisting reads all existing JSON files', async () => {
    const watcher = new EventWatcher();
    writeFileSync(join(eventsDir, '001.json'), JSON.stringify({ session_id: 'a' }));
    writeFileSync(join(eventsDir, '002.json'), JSON.stringify({ session_id: 'b' }));
    writeFileSync(join(eventsDir, 'ignore.txt'), 'x');

    const received = [];
    watcher.on('event', (event) => received.push(event));
    await watcher.processExisting();

    expect(received).toHaveLength(2);
    const ids = received.map((event) => event.session_id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('deletes files after processing', async () => {
    const watcher = new EventWatcher();
    const filePath = join(eventsDir, 'delete-me.json');
    writeFileSync(filePath, JSON.stringify({ session_id: 's2' }));

    await watcher.processFile(filePath);

    expect(existsSync(filePath)).toBe(false);
  });

  it('handles invalid JSON files gracefully', async () => {
    const watcher = new EventWatcher();
    const filePath = join(eventsDir, 'broken.json');
    writeFileSync(filePath, '{invalid json');

    const received = [];
    watcher.on('event', (event) => received.push(event));

    await expect(watcher.processFile(filePath)).resolves.toBeUndefined();
    expect(received).toHaveLength(0);
    expect(existsSync(filePath)).toBe(false);
  });
});
