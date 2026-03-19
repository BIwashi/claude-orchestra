import { describe, it, expect, beforeEach } from 'vitest';
import { AudioPlayer, VoiceChannel } from '../lib/audio-player.js';

describe('VoiceChannel', () => {
  it('initializes with correct defaults', () => {
    const channel = new VoiceChannel('piano');
    expect(channel.instrumentId).toBe('piano');
    expect(channel.currentProcess).toBeNull();
    expect(channel.minInterval).toBe(100);
  });

  it('respects rate limiting', () => {
    const channel = new VoiceChannel('piano');
    channel.lastPlayTime = Date.now();
    // play() should return false due to rate limit
    const result = channel.play('C4', 0.5);
    expect(result).toBe(false);
  });
});

describe('AudioPlayer', () => {
  let player;

  beforeEach(() => {
    player = new AudioPlayer();
  });

  it('creates channels on demand', () => {
    const channel = player.getChannel('piano');
    expect(channel).toBeInstanceOf(VoiceChannel);
    expect(channel.instrumentId).toBe('piano');
  });

  it('reuses existing channels', () => {
    const ch1 = player.getChannel('piano');
    const ch2 = player.getChannel('piano');
    expect(ch1).toBe(ch2);
  });

  it('creates separate channels per instrument', () => {
    const ch1 = player.getChannel('piano');
    const ch2 = player.getChannel('cello');
    expect(ch1).not.toBe(ch2);
  });

  it('stopAll clears all channels', () => {
    player.getChannel('piano');
    player.getChannel('cello');
    player.stopAll();
    // Should not throw
  });
});
