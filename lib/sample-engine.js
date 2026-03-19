import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TRACKS_DIR = join(process.env.HOME, '.claude-orchestra', 'tracks');

/**
 * Sample-based engine: plays pre-recorded audio files organized into
 * sections and parts. Session count controls how many parts play
 * simultaneously, and tool events advance the playhead through sections.
 */
class SampleEngine {
  constructor(config = {}) {
    this.config = config;
    this.manifest = null;
    this.trackDir = null;
    this.currentSection = 0;
    this.eventCounter = 0;
    this.activeParts = new Map(); // partIndex → { process, label }
    this.idleTimer = null;
  }

  async init(_instruments) {
    const trackName = this.config.track;
    if (!trackName) {
      throw new Error('Sample engine requires a track name in config.track');
    }

    this.trackDir = join(TRACKS_DIR, trackName);
    const manifestPath = join(this.trackDir, 'manifest.json');

    if (!existsSync(manifestPath)) {
      throw new Error(`Track not found: ${manifestPath}`);
    }

    this.manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    this.currentSection = 0;
    this.eventCounter = 0;
    console.log(`  Sample engine: loaded "${this.manifest.name}" (${this.manifest.sections.length} sections)`);
  }

  handleToolEvent(_event, _instrument, sessionCount) {
    this.eventCounter++;

    const eventsPerSection = this.manifest.eventsPerSection || 8;
    if (this.eventCounter >= eventsPerSection) {
      this.eventCounter = 0;
      this.advanceSection(sessionCount);
    }

    // Clear idle timer on activity
    this.clearIdleTimer();
  }

  handleSessionJoin(_instrument, sessionCount) {
    // Start playing parts up to sessionCount
    this.syncParts(sessionCount);
  }

  handleSessionLeave(_instrument, sessionCount) {
    // Reduce active parts
    this.syncParts(sessionCount);
  }

  handleError(_instrument, _count) {
    // On error, briefly pause playback (stop all parts, restart after 500ms)
    this.stopAllParts();
    setTimeout(() => {
      this.syncParts(this.activeParts.size || 1);
    }, 500);
  }

  handleCompact(sessions) {
    // Jump to next section on compact
    this.advanceSection(sessions.length);
  }

  handleIdle(sessions, _chordIndex) {
    const section = this.manifest.sections[this.currentSection];
    if (!section) return;

    const idle = this.manifest.idle || { strategy: 'sustain' };

    if (idle.strategy === 'loop' && section.loop) {
      // Already looping via afplay, nothing to do
      return;
    }

    // Sustain: keep current parts playing (they loop if section.loop is true)
    // Start idle timer for fade if configured
    if (idle.strategy === 'sustain' && idle.fadeMs && !this.idleTimer) {
      this.idleTimer = setTimeout(() => {
        // Fade out by stopping and restarting at lower volume
        // For simplicity, we just keep playing
        this.idleTimer = null;
      }, idle.fadeMs);
    }
  }

  stopAll() {
    this.stopAllParts();
    this.clearIdleTimer();
  }

  // --- Internal ---

  advanceSection(sessionCount) {
    const nextSection = this.currentSection + 1;
    if (nextSection >= this.manifest.sections.length) {
      // Loop the last section
      if (this.manifest.sections[this.currentSection]?.loop !== false) {
        return; // Stay on current section
      }
      this.currentSection = 0; // Wrap around
    } else {
      this.currentSection = nextSection;
    }

    const section = this.manifest.sections[this.currentSection];
    console.log(`  [section] → ${section.name || section.id}`);

    // Restart parts for new section
    this.stopAllParts();
    this.syncParts(sessionCount);
  }

  syncParts(sessionCount) {
    const section = this.manifest.sections[this.currentSection];
    if (!section || !section.parts) return;

    const maxParts = Math.min(sessionCount, section.parts.length, this.manifest.maxParts || Infinity);

    // Stop parts beyond maxParts
    for (const [idx, part] of this.activeParts) {
      if (idx >= maxParts) {
        this.stopPart(idx);
      }
    }

    // Start missing parts up to maxParts
    for (let i = 0; i < maxParts; i++) {
      if (!this.activeParts.has(i)) {
        this.startPart(i, section.parts[i]);
      }
    }
  }

  startPart(index, partDef) {
    const filePath = join(this.trackDir, partDef.file);
    if (!existsSync(filePath)) {
      console.error(`  Part file not found: ${filePath}`);
      return;
    }

    const volume = (partDef.volume || 0.5) * (this.config.volume || 0.5);
    const proc = spawn('afplay', ['-v', String(volume), filePath], {
      stdio: 'ignore',
      detached: false,
    });

    proc.on('error', () => {});
    proc.on('exit', () => {
      if (this.activeParts.get(index)?.process === proc) {
        this.activeParts.delete(index);
      }
    });

    this.activeParts.set(index, { process: proc, label: partDef.label || `Part ${index}` });
  }

  stopPart(index) {
    const part = this.activeParts.get(index);
    if (part?.process) {
      try { part.process.kill('SIGTERM'); } catch {}
    }
    this.activeParts.delete(index);
  }

  stopAllParts() {
    for (const [idx] of this.activeParts) {
      this.stopPart(idx);
    }
  }

  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}

export { SampleEngine, TRACKS_DIR };
