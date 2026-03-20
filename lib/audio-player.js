import { existsSync } from 'node:fs';
import { getTonePath } from './tone-cache.js';
import { playFile } from './playback.js';

/**
 * Per-instrument voice channel with rate limiting.
 * Each channel manages its own audio subprocess queue.
 */
class VoiceChannel {
  constructor(instrumentId) {
    this.instrumentId = instrumentId;
    this.lastPlayTime = 0;
    this.minInterval = 100; // ms between notes
    this.currentProcess = null;
  }

  play(noteName, volume = 0.5) {
    const now = Date.now();
    if (now - this.lastPlayTime < this.minInterval) return false;

    const wavPath = getTonePath(this.instrumentId, noteName);
    if (!existsSync(wavPath)) return false;

    this.lastPlayTime = now;

    // Kill any currently playing note on this channel
    if (this.currentProcess) {
      try {
        this.currentProcess.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }

    this.currentProcess = playFile(wavPath, { volume });

    const proc = this.currentProcess;
    proc.on('error', () => {});
    proc.on('exit', () => {
      if (this.currentProcess === proc) {
        this.currentProcess = null;
      }
    });

    return true;
  }

  stop() {
    if (this.currentProcess) {
      try {
        this.currentProcess.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      this.currentProcess = null;
    }
  }
}

/**
 * Manages all voice channels (one per instrument).
 */
class AudioPlayer {
  constructor() {
    this.channels = new Map();
  }

  getChannel(instrumentId) {
    if (!this.channels.has(instrumentId)) {
      this.channels.set(instrumentId, new VoiceChannel(instrumentId));
    }
    return this.channels.get(instrumentId);
  }

  playNote(instrumentId, noteName, volume = 0.5) {
    return this.getChannel(instrumentId).play(noteName, volume);
  }

  /**
   * Play an arpeggio (sequence of notes with delay).
   */
  async playArpeggio(instrumentId, notes, volume = 0.5, delayMs = 120) {
    for (const note of notes) {
      this.playNote(instrumentId, note, volume);
      await sleep(delayMs);
    }
  }

  /**
   * Play a chord (multiple instruments simultaneously).
   */
  playChord(instrumentNotes, volume = 0.3) {
    for (const [instrumentId, noteName] of instrumentNotes) {
      this.playNote(instrumentId, noteName, volume);
    }
  }

  stopAll() {
    for (const channel of this.channels.values()) {
      channel.stop();
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { AudioPlayer, VoiceChannel };
