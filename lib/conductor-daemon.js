import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { EventWatcher, EVENTS_DIR } from './event-watcher.js';
import { SessionRegistry } from './registry.js';
import { createEngine, loadConfig, CONFIG_PATH } from './engine.js';
import { green, dim, yellow } from './cli-format.js';
import { consumeVolumeSignal } from './volume-signal.js';

const ORCHESTRA_DIR = join(homedir(), '.claude-orchestra');
const PID_FILE = join(ORCHESTRA_DIR, 'conductor.pid');
const LOG_FILE = join(ORCHESTRA_DIR, 'conductor.log');
const STATUS_FILE = join(ORCHESTRA_DIR, 'status.json');

function stop() {
  if (!existsSync(PID_FILE)) {
    console.log('Conductor is not running.');
    return;
  }
  try {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim());
    process.kill(pid, 'SIGTERM');
    unlinkSync(PID_FILE);
    console.log(`${yellow('■ Conductor stopped')} ${dim(`(PID ${pid})`)}`);
  } catch (_e) {
    console.log('Conductor process not found, cleaning up PID file.');
    try {
      unlinkSync(PID_FILE);
    } catch {
      /* ignore */
    }
  }
}

async function daemonize() {
  const { spawn } = await import('node:child_process');
  const { openSync } = await import('node:fs');
  mkdirSync(ORCHESTRA_DIR, { recursive: true });
  const out = openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [process.argv[1], 'start'], {
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();
  console.log(`${green('✓ Conductor started')} ${dim(`(PID ${child.pid})`)}`);
  process.exit(0);
}

async function start() {
  mkdirSync(EVENTS_DIR, { recursive: true });
  mkdirSync(ORCHESTRA_DIR, { recursive: true });

  if (existsSync(PID_FILE)) {
    try {
      const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim());
      process.kill(pid, 0);
      console.log(`Conductor already running (PID ${pid}).`);
      process.exit(1);
    } catch {
      /* stale PID file */
    }
  }

  writeFileSync(PID_FILE, String(process.pid));

  console.log('🎵 Claude Orchestra - Conductor starting...');
  if (isDebugEnabled()) {
    log('Debug mode enabled via CLAUDE_ORCHESTRA_DEBUG=1');
  }

  const config = loadConfig();
  console.log(`  Mode: ${config.mode}${config.track ? ` (track: ${config.track})` : ''}`);

  const instruments = loadInstruments();
  const engine = createEngine(config);
  console.log('  Initializing engine...');
  await engine.init(instruments);

  const registry = new SessionRegistry(instruments);
  const watcher = new EventWatcher();
  attachDebugHooks(engine);
  cleanupStaleEvents();

  let lastEventTime = Date.now();
  let ambientInterval = null;
  let volumeSignalInterval = null;
  let ambientChordIndex = 0;

  watcher.on('event', (event) => {
    lastEventTime = Date.now();
    handleEvent(event, registry, engine);
    writeStatus(config, engine, registry);
  });

  watcher.start();
  console.log('  Watching for events...');
  console.log(`  Events directory: ${EVENTS_DIR}`);
  console.log('  Press Ctrl+C to stop.\n');

  ambientInterval = setInterval(() => {
    const idle = Date.now() - lastEventTime;
    if (idle > 4000 && registry.count > 0) {
      const sessions = registry.getAll();
      engine.handleIdle(sessions, ambientChordIndex);
      ambientChordIndex = (ambientChordIndex + 1) % 4;
    }

    const pruned = registry.prune(120000);
    for (const sessionId of pruned) {
      log(`Session pruned: ${sessionId}`);
    }
  }, 4000);

  volumeSignalInterval = setInterval(() => {
    try {
      const nextVolume = consumeVolumeSignal();
      if (nextVolume === null) return;
      config.volume = nextVolume;
      engine.setVolume(nextVolume);
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
      log(`Volume changed to ${nextVolume}`);
      debugLog(`Applied live volume update to ${nextVolume}`);
    } catch (e) {
      log(`Failed to process volume signal: ${e.message}`);
    }
  }, 2000);

  // Write initial status
  writeStatus(config, engine, registry);

  const cleanup = () => {
    console.log('\n🎵 Conductor stopping...');
    watcher.stop();
    engine.stopAll();
    clearInterval(ambientInterval);
    clearInterval(volumeSignalInterval);
    try {
      unlinkSync(PID_FILE);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(STATUS_FILE);
    } catch {
      /* ignore */
    }
    process.exit(0);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

function handleEvent(event, registry, engine) {
  const hookEvent = event.hook_event_name || event.hook_event || '';
  const sessionId = event.session_id || 'unknown';
  debugLog(`Tool event received: ${hookEvent || 'unknown'} (${sessionId.slice(0, 8)}…)`);

  if (hookEvent === 'SessionStart' || hookEvent === 'session_start') {
    const { instrument, isNew } = registry.register(sessionId);
    if (isNew && instrument) {
      log(`🎻 ${instrument.name} joins! (session ${sessionId.slice(0, 8)}…)`);
      debugLog(
        `Instrument assigned: ${instrument.name} -> ${sessionId.slice(0, 8)}… (${registry.count} active)`,
      );
      engine.handleSessionJoin(instrument, registry.count);
    }
    return;
  }

  if (hookEvent === 'SessionEnd' || hookEvent === 'session_end') {
    const instrument = registry.unregister(sessionId);
    if (instrument) {
      log(`🎻 ${instrument.name} leaves. (session ${sessionId.slice(0, 8)}…)`);
      debugLog(
        `Instrument released: ${instrument.name} <- ${sessionId.slice(0, 8)}… (${registry.count} active)`,
      );
      engine.handleSessionLeave(instrument, registry.count);
    }
    return;
  }

  if (hookEvent === 'Compact' || hookEvent === 'compact') {
    const sessions = registry.getAll();
    engine.handleCompact(sessions);
    return;
  }

  const { instrument, isNew } = registry.register(sessionId);
  if (!instrument) return;

  if (isNew) {
    log(`🎻 ${instrument.name} joins! (session ${sessionId.slice(0, 8)}…)`);
    debugLog(
      `Instrument assigned: ${instrument.name} -> ${sessionId.slice(0, 8)}… (${registry.count} active)`,
    );
    engine.handleSessionJoin(instrument, registry.count);
    return;
  }

  const input = event.input || {};
  if (input.error || input.is_error) {
    debugLog(`Error event routed to engine for ${instrument.name}`);
    engine.handleError(instrument, registry.count);
    return;
  }

  debugLog(`Dispatching ${hookEvent || 'event'} to ${instrument.name} (${registry.count} active)`);
  engine.handleToolEvent(event, instrument, registry.count);
}

function cleanupStaleEvents() {
  let files;

  try {
    files = readdirSync(EVENTS_DIR).filter(
      (file) => file.endsWith('.json') && !file.startsWith('.'),
    );
  } catch {
    return 0;
  }

  if (files.length <= 100) {
    return 0;
  }

  let removed = 0;
  for (const file of files) {
    try {
      unlinkSync(join(EVENTS_DIR, file));
      removed++;
    } catch {
      /* ignore */
    }
  }

  log(`Cleaned up ${removed} stale event files on startup.`);
  return removed;
}

function attachDebugHooks(engine) {
  if (!isDebugEnabled() || !engine || engine.__claudeOrchestraDebugWrapped) {
    return;
  }

  if (typeof engine.startSection === 'function') {
    const originalStartSection = engine.startSection.bind(engine);
    engine.startSection = (sectionIndex, sessionCount, seekOffset = 0) => {
      const section = engine.manifest?.sections?.[sectionIndex];
      const sectionLabel = section?.id || `section-${sectionIndex}`;
      debugLog(
        `Section transition: ${sectionLabel} (index ${sectionIndex}, sessions=${sessionCount}, offset=${seekOffset})`,
      );
      return originalStartSection(sectionIndex, sessionCount, seekOffset);
    };
  }

  if (typeof engine.setVolume === 'function') {
    const originalSetVolume = engine.setVolume.bind(engine);
    engine.setVolume = (volume) => {
      debugLog(`Volume update requested: ${volume}`);
      return originalSetVolume(volume);
    };
  }

  Object.defineProperty(engine, '__claudeOrchestraDebugWrapped', {
    value: true,
    configurable: true,
    enumerable: false,
    writable: false,
  });
}

function writeStatus(config, engine, registry) {
  try {
    const sessions = registry.getAll();
    const sessionList = sessions.map((s) => ({
      id: s.sessionId?.slice(0, 8) || 'unknown',
      instrument: s.instrument?.name || 'unknown',
    }));
    const currentSection = engine.manifest?.sections?.[engine.currentSection];
    const status = {
      track: config.track || '(synth)',
      mode: config.mode || 'synth',
      section: currentSection?.name || currentSection?.id || 'idle',
      sectionIndex: engine.currentSection ?? -1,
      totalSections: engine.manifest?.sections?.length || 0,
      volume: config.volume ?? 0.5,
      sessions: registry.count,
      sessionList,
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(STATUS_FILE, JSON.stringify(status) + '\n');
  } catch {
    /* status write is best-effort */
  }
}

function loadInstruments() {
  const instrumentsData = JSON.parse(
    readFileSync(new URL('../data/instruments.json', import.meta.url), 'utf-8'),
  );
  return instrumentsData.instruments;
}

function log(msg, { verbose = false } = {}) {
  if (verbose && !isDebugEnabled()) {
    return;
  }
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`  [${ts}] ${msg}`);
}

function debugLog(msg) {
  log(msg, { verbose: true });
}

function isTruthy(value) {
  if (!value) return false;
  return !['0', 'false', 'off', 'no'].includes(String(value).trim().toLowerCase());
}

function isDebugEnabled() {
  return isTruthy(process.env.CLAUDE_ORCHESTRA_DEBUG);
}

export {
  LOG_FILE,
  ORCHESTRA_DIR,
  PID_FILE,
  STATUS_FILE,
  attachDebugHooks,
  cleanupStaleEvents,
  daemonize,
  debugLog,
  handleEvent,
  isDebugEnabled,
  loadInstruments,
  start,
  stop,
  writeStatus,
};
