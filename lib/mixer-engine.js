import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BaseEngine } from './base-engine.js';

const TRACKS_DIR = join(process.env.HOME, '.claude-orchestra', 'tracks');

class MixerEngine extends BaseEngine {
  constructor(
    config = {},
    dependencies = {
      spawnProcess: spawn,
      runProcessSync: spawnSync,
      now: () => Date.now(),
      probeDuration: null,
      tmpDir: tmpdir(),
    },
  ) {
    super(config);
    this.spawnProcess = dependencies.spawnProcess;
    this.runProcessSync = dependencies.runProcessSync;
    this.now = dependencies.now;
    this.probeDuration = dependencies.probeDuration;
    this.tmpDir = dependencies.tmpDir;

    this.manifest = null;
    this.trackDir = null;
    this.currentSection = 0;
    this.currentSessionCount = 0;
    this.eventCounter = 0;
    this.currentProcess = null;
    this.currentMixPath = null;
    this.sectionDurations = new Map();
    this.globalClock = {
      sectionIndex: 0,
      sectionStartedAt: 0,
      isPlaying: false,
    };
  }

  async init(_instruments) {
    const trackName = this.config.track;
    if (!trackName) {
      throw new Error('Mixer engine requires a track name in config.track');
    }

    this.trackDir = join(TRACKS_DIR, trackName);
    const manifestPath = join(this.trackDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`Track not found: ${manifestPath}`);
    }

    this.manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    this.currentSection = 0;
    this.currentSessionCount = 0;
    this.eventCounter = 0;
    this.currentProcess = null;
    this.currentMixPath = null;
    this.sectionDurations.clear();
    this.globalClock = {
      sectionIndex: 0,
      sectionStartedAt: this.now(),
      isPlaying: false,
    };
    console.log(
      `  Mixer engine: loaded "${this.manifest.name}" (${this.manifest.sections.length} sections)`,
    );
  }

  handleToolEvent(_event, _instrument, sessionCount) {
    if (!this.manifest) return;

    this.currentSessionCount = sessionCount;
    this.eventCounter++;

    const eventsPerSection = this.manifest.eventsPerSection || 8;
    if (this.eventCounter >= eventsPerSection) {
      this.eventCounter = 0;
      this.advanceSection(sessionCount);
    }
  }

  handleSessionJoin(_instrument, sessionCount) {
    if (!this.manifest) return;

    this.currentSessionCount = sessionCount;
    if (!this.globalClock.isPlaying) {
      this.startSection(this.currentSection, sessionCount, this.getElapsedTime());
      return;
    }

    this.restartCurrentSection(sessionCount);
  }

  handleSessionLeave(_instrument, sessionCount) {
    if (!this.manifest) return;

    this.currentSessionCount = sessionCount;
    if (sessionCount <= 0) {
      this.stopPlayback();
      return;
    }

    this.restartCurrentSection(sessionCount);
  }

  handleError(_instrument, _count) {
    this.stopPlayback();
  }

  handleCompact(sessions) {
    if (!this.manifest) return;

    this.eventCounter = 0;
    this.advanceSection(sessions.length);
  }

  handleIdle(sessions, _chordIndex) {
    if (!this.manifest) return;

    const section = this.manifest.sections[this.currentSection];
    if (!section?.loop) return;

    const sessionCount = sessions.length;
    this.currentSessionCount = sessionCount;
    if (sessionCount > 0 && !this.globalClock.isPlaying) {
      this.startSection(this.currentSection, sessionCount, 0);
    }
  }

  stopAll() {
    this.currentSessionCount = 0;
    this.stopPlayback();
  }

  startSection(sectionIndex, sessionCount, seekOffset = 0) {
    const section = this.manifest?.sections?.[sectionIndex];
    if (!section) return;

    const duration = this.getSectionDuration(sectionIndex);
    const normalizedOffset = this.normalizeOffset(sectionIndex, seekOffset, duration);

    this.stopPlayback();
    this.currentSection = sectionIndex;
    this.currentSessionCount = sessionCount;
    this.globalClock = {
      sectionIndex,
      sectionStartedAt: this.now() - normalizedOffset * 1000,
      isPlaying: false,
    };

    if (sessionCount <= 0) return;
    if (duration !== null && !section.loop && normalizedOffset >= duration) return;

    const mixPath = this.mixParts(section, sessionCount);
    const proc = this.spawnProcess(
      'ffplay',
      ['-ss', String(normalizedOffset), '-nodisp', '-autoexit', mixPath],
      {
        stdio: 'ignore',
        detached: false,
      },
    );

    this.currentMixPath = mixPath;
    this.currentProcess = proc;
    this.globalClock.isPlaying = true;

    proc.on('error', () => {
      if (this.currentProcess === proc) {
        this.currentProcess = null;
        this.globalClock.isPlaying = false;
      }
    });

    proc.on('exit', () => {
      if (this.currentProcess !== proc) return;

      this.currentProcess = null;
      this.globalClock.isPlaying = false;

      if (section.loop && this.currentSessionCount > 0) {
        this.startSection(sectionIndex, this.currentSessionCount, 0);
      }
    });
  }

  advanceSection(sessionCount) {
    const nextSection = this.currentSection + 1;
    if (nextSection >= this.manifest.sections.length) {
      if (this.manifest.sections[this.currentSection]?.loop !== false) {
        this.startSection(this.currentSection, sessionCount, 0);
        return;
      }
      this.currentSection = 0;
    } else {
      this.currentSection = nextSection;
    }

    this.startSection(this.currentSection, sessionCount, 0);
  }

  restartCurrentSection(sessionCount) {
    this.startSection(this.currentSection, sessionCount, this.getElapsedTime());
  }

  getElapsedTime() {
    if (!this.globalClock.sectionStartedAt) return 0;
    return Math.max(0, (this.now() - this.globalClock.sectionStartedAt) / 1000);
  }

  normalizeOffset(sectionIndex, seekOffset, duration = this.getSectionDuration(sectionIndex)) {
    if (duration === null || duration <= 0) {
      return Math.max(0, seekOffset);
    }

    const section = this.manifest.sections[sectionIndex];
    if (section?.loop) {
      return ((seekOffset % duration) + duration) % duration;
    }

    return Math.max(0, seekOffset);
  }

  mixParts(section, sessionCount) {
    const activeParts = section.parts.slice(
      0,
      Math.min(sessionCount, section.parts.length, this.manifest.maxParts || Infinity),
    );
    if (activeParts.length === 0) {
      throw new Error(`No active parts available for section ${section.id || this.currentSection}`);
    }

    const mixName = section.id || `section-${this.currentSection}`;
    const outputPath = join(this.tmpDir, `claude-orchestra-mix-${mixName}.wav`);
    const args = activeParts.length === 1 ? [] : ['-m'];

    for (const part of activeParts) {
      const filePath = join(this.trackDir, part.file);
      if (!existsSync(filePath)) {
        throw new Error(`Part file not found: ${filePath}`);
      }

      const volume = (part.volume ?? 1) * (this.config.volume ?? 0.5);
      args.push('-v', String(volume), filePath);
    }

    args.push(outputPath);

    // Add fade in/out for smooth section transitions
    const fadeMs = this.manifest.idle?.fadeMs || 0;
    if (fadeMs > 0) {
      const fadeSec = (fadeMs / 1000).toFixed(2);
      // sox fade type: 't' = linear, 'q' = quarter-sine, 'h' = half-sine
      // fade t <fade-in-length> <stop-position> <fade-out-length>
      // Using 0 for stop-position means "end of file"
      args.push('fade', 't', fadeSec, '-0', fadeSec);
    }

    const result = this.runProcessSync('sox', args, {
      stdio: 'ignore',
      encoding: 'utf-8',
    });
    if (result?.status !== 0) {
      throw new Error(`sox mix failed for section ${section.id || this.currentSection}`);
    }

    return outputPath;
  }

  getSectionDuration(sectionIndex) {
    if (this.sectionDurations.has(sectionIndex)) {
      return this.sectionDurations.get(sectionIndex);
    }

    const section = this.manifest?.sections?.[sectionIndex];
    const firstPart = section?.parts?.[0];
    if (!firstPart) return null;

    const filePath = join(this.trackDir, firstPart.file);
    let duration = null;

    if (this.probeDuration) {
      duration = this.probeDuration(filePath, sectionIndex);
    } else {
      const result = this.runProcessSync('soxi', ['-D', filePath], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      if (result?.status === 0) {
        const parsed = Number.parseFloat(result.stdout.trim());
        if (!Number.isNaN(parsed)) {
          duration = parsed;
        }
      }
    }

    this.sectionDurations.set(sectionIndex, duration);
    return duration;
  }

  stopPlayback() {
    const proc = this.currentProcess;
    this.currentProcess = null;
    this.currentMixPath = null;
    this.globalClock.isPlaying = false;

    if (!proc) return;

    try {
      proc.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
}

export { MixerEngine };
