import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionRegistry, getOrchestraDir, getRegistryPath } from '../lib/registry.js';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const instruments = [
  { id: 'piano', name: 'Piano', octave: 4 },
  { id: 'cello', name: 'Cello', octave: 3 },
  { id: 'flute', name: 'Flute', octave: 5 },
];

describe('SessionRegistry', () => {
  let registry;
  let tempHome;
  let backupExists = false;
  let backupData = null;
  let originalOrchestraDir;

  beforeEach(() => {
    originalOrchestraDir = process.env.CLAUDE_ORCHESTRA_DIR;
    tempHome = mkdtempSync(join(tmpdir(), 'claude-orchestra-registry-'));
    process.env.CLAUDE_ORCHESTRA_DIR = join(tempHome, '.claude-orchestra');

    const orchestraDir = getOrchestraDir();
    const registryPath = getRegistryPath();

    // Backup existing registry
    if (existsSync(registryPath)) {
      backupExists = true;
      backupData = readFileSync(registryPath, 'utf-8');
    } else {
      backupExists = false;
      backupData = null;
    }
    mkdirSync(orchestraDir, { recursive: true });
    registry = new SessionRegistry(instruments);
    // Clear any loaded sessions
    registry.sessions.clear();
    registry.save();
  });

  afterEach(() => {
    const registryPath = getRegistryPath();

    // Restore backup
    if (backupExists && backupData !== null) {
      writeFileSync(registryPath, backupData);
    }

    if (originalOrchestraDir === undefined) {
      delete process.env.CLAUDE_ORCHESTRA_DIR;
    } else {
      process.env.CLAUDE_ORCHESTRA_DIR = originalOrchestraDir;
    }

    rmSync(tempHome, { recursive: true, force: true });
  });

  it('registers a new session with an instrument', () => {
    const { instrument, isNew } = registry.register('session-1');
    expect(isNew).toBe(true);
    expect(instrument).toBeDefined();
    expect(instrument.id).toBe('piano');
  });

  it('returns existing session on re-register', () => {
    registry.register('session-1');
    const { instrument, isNew } = registry.register('session-1');
    expect(isNew).toBe(false);
    expect(instrument.id).toBe('piano');
  });

  it('assigns different instruments to different sessions', () => {
    const r1 = registry.register('session-1');
    const r2 = registry.register('session-2');
    expect(r1.instrument.id).not.toBe(r2.instrument.id);
  });

  it('wraps around instruments when more sessions than instruments', () => {
    for (let i = 0; i < instruments.length; i++) {
      registry.register(`session-${i}`);
    }
    const extra = registry.register('session-extra');
    expect(extra.isNew).toBe(true);
    expect(extra.instrument).toBeDefined();
  });

  it('tracks session count', () => {
    expect(registry.count).toBe(0);
    registry.register('s1');
    expect(registry.count).toBe(1);
    registry.register('s2');
    expect(registry.count).toBe(2);
  });

  it('unregisters a session', () => {
    registry.register('s1');
    const instrument = registry.unregister('s1');
    expect(instrument).toBeDefined();
    expect(instrument.id).toBe('piano');
    expect(registry.count).toBe(0);
  });

  it('returns null when unregistering unknown session', () => {
    const result = registry.unregister('unknown');
    expect(result).toBeNull();
  });

  it('getAll returns all sessions', () => {
    registry.register('s1');
    registry.register('s2');
    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all[0]).toHaveProperty('sessionId');
    expect(all[0]).toHaveProperty('instrument');
  });

  it('prunes stale sessions', () => {
    registry.register('s1');
    // Manually backdate lastSeen
    const session = registry.sessions.get('s1');
    session.lastSeen = Date.now() - 200000;
    registry.sessions.set('s1', session);

    const pruned = registry.prune(100000);
    expect(pruned).toContain('s1');
    expect(registry.count).toBe(0);
  });

  it('does not prune active sessions', () => {
    registry.register('s1');
    const pruned = registry.prune(100000);
    expect(pruned).toHaveLength(0);
    expect(registry.count).toBe(1);
  });
});
