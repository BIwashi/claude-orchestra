import { afterEach, describe, expect, it, vi } from 'vitest';

const originalPlatform = process.platform;

function mockPlatform(platform) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });
}

describe('playback', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mockPlatform(originalPlatform);
  });

  it('prefers ffplay when available', async () => {
    mockPlatform('darwin');
    const spawnSync = vi.fn((command, args) => ({
      status: args[0] === 'ffplay' ? 0 : 1,
    }));

    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(),
      spawnSync,
    }));

    const { detectPlayer } = await import('../lib/playback.js');
    const player = detectPlayer();

    expect(player.command).toBe('ffplay');
    expect(player.args('/tmp/test.wav', { volume: 0.25 })).toEqual([
      '-nodisp',
      '-autoexit',
      '-loglevel',
      'quiet',
      '-af',
      'volume=0.25',
      '/tmp/test.wav',
    ]);
    expect(spawnSync).toHaveBeenCalledWith('which', ['ffplay'], { stdio: 'ignore' });
  });

  it('falls back to afplay on macOS when ffplay is unavailable', async () => {
    mockPlatform('darwin');
    const availability = new Map([
      ['ffplay', 1],
      ['afplay', 0],
    ]);

    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(),
      spawnSync: vi.fn((command, args) => ({
        status: availability.get(args[0]) ?? 1,
      })),
    }));

    const { detectPlayer } = await import('../lib/playback.js');
    const player = detectPlayer();

    expect(player.command).toBe('afplay');
    expect(player.args('/tmp/test.wav', { volume: 0.75 })).toEqual(['-v', '0.75', '/tmp/test.wav']);
  });

  it('falls back to paplay before aplay on Linux', async () => {
    mockPlatform('linux');
    const availability = new Map([
      ['ffplay', 1],
      ['paplay', 0],
      ['aplay', 0],
    ]);

    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(),
      spawnSync: vi.fn((command, args) => ({
        status: availability.get(args[0]) ?? 1,
      })),
    }));

    const { detectPlayer } = await import('../lib/playback.js');
    const player = detectPlayer();

    expect(player.command).toBe('paplay');
    expect(player.args('/tmp/test.wav', { volume: 0.5 })).toEqual([
      '--volume',
      '32768',
      '/tmp/test.wav',
    ]);
  });

  it('falls back to aplay on Linux when paplay is unavailable', async () => {
    mockPlatform('linux');
    const availability = new Map([
      ['ffplay', 1],
      ['paplay', 1],
      ['aplay', 0],
    ]);

    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(),
      spawnSync: vi.fn((command, args) => ({
        status: availability.get(args[0]) ?? 1,
      })),
    }));

    const { detectPlayer, isSupported } = await import('../lib/playback.js');
    const player = detectPlayer();

    expect(player.command).toBe('aplay');
    expect(player.args('/tmp/test.wav', { volume: 0.1 })).toEqual(['/tmp/test.wav']);
    expect(isSupported()).toBe(true);
  });

  it('returns unsupported on Windows without ffplay', async () => {
    mockPlatform('win32');

    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(),
      spawnSync: vi.fn(() => ({ status: 1 })),
    }));

    const { detectPlayer, isSupported } = await import('../lib/playback.js');

    expect(detectPlayer()).toBeNull();
    expect(isSupported()).toBe(false);
  });

  it('keeps Windows unsupported even if ffplay exists', async () => {
    mockPlatform('win32');

    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(),
      spawnSync: vi.fn(() => ({ status: 0 })),
    }));

    const { detectPlayer } = await import('../lib/playback.js');

    expect(detectPlayer()).toBeNull();
  });

  it('caches player detection across repeated playback calls', async () => {
    mockPlatform('darwin');
    const spawn = vi.fn(() => ({ on: vi.fn() }));
    const spawnSync = vi.fn((command, args) => ({
      status: args[0] === 'ffplay' ? 0 : 1,
    }));

    vi.doMock('node:child_process', () => ({
      spawn,
      spawnSync,
    }));

    const { playFile } = await import('../lib/playback.js');

    playFile('/tmp/first.wav');
    playFile('/tmp/second.wav', { volume: 0.5 });

    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenNthCalledWith(
      1,
      'ffplay',
      ['-nodisp', '-autoexit', '-loglevel', 'quiet', '/tmp/first.wav'],
      {
        stdio: 'ignore',
        detached: false,
      },
    );
    expect(spawn).toHaveBeenNthCalledWith(
      2,
      'ffplay',
      ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-af', 'volume=0.5', '/tmp/second.wav'],
      {
        stdio: 'ignore',
        detached: false,
      },
    );
  });
});
