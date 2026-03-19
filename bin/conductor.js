#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync, symlinkSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { EventWatcher, EVENTS_DIR } from '../lib/event-watcher.js';
import { SessionRegistry } from '../lib/registry.js';
import { createEngine, loadConfig, CONFIG_PATH, DEFAULT_CONFIG } from '../lib/engine.js';
import { TRACKS_DIR } from '../lib/sample-engine.js';

const ORCHESTRA_DIR = join(process.env.HOME, '.claude-orchestra');
const PID_FILE = join(ORCHESTRA_DIR, 'conductor.pid');
const LOG_FILE = join(ORCHESTRA_DIR, 'conductor.log');

// --- CLI ---
const command = process.argv[2] || 'start';
const subCommand = process.argv[3];

if (command === 'stop') {
  stop();
  process.exit(0);
}

if (command === 'status') {
  showStatus();
  process.exit(0);
}

if (command === 'track') {
  handleTrackCommand(subCommand);
  process.exit(0);
}

if (command === 'config') {
  handleConfigCommand(subCommand);
  process.exit(0);
}

if (command === 'start') {
  const daemon = process.argv.includes('--daemon');
  if (daemon) {
    daemonize();
  } else {
    start();
  }
}

// --- Commands ---

function stop() {
  if (!existsSync(PID_FILE)) {
    console.log('Conductor is not running.');
    return;
  }
  try {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim());
    process.kill(pid, 'SIGTERM');
    unlinkSync(PID_FILE);
    console.log(`Conductor stopped (PID ${pid}).`);
  } catch (e) {
    console.log('Conductor process not found, cleaning up PID file.');
    try { unlinkSync(PID_FILE); } catch {}
  }
}

function showStatus() {
  const config = loadConfig();
  const registryPath = join(ORCHESTRA_DIR, 'registry.json');

  console.log(`\n🎵 Claude Orchestra Status`);
  console.log(`   Mode: ${config.mode}${config.track ? ` (track: ${config.track})` : ''}`);
  console.log(`   Volume: ${config.volume}\n`);

  if (!existsSync(registryPath)) {
    console.log('   No active sessions.');
  } else {
    try {
      const data = JSON.parse(readFileSync(registryPath, 'utf-8'));
      const sessions = data.sessions || {};
      const count = Object.keys(sessions).length;
      console.log(`   Active sessions: ${count}\n`);
      if (count === 0) {
        console.log('   No musicians on stage.');
      } else {
        for (const [id, info] of Object.entries(sessions)) {
          const elapsed = Math.round((Date.now() - info.joinedAt) / 1000);
          console.log(`   🎻 ${info.instrumentId.padEnd(10)} │ session: ${id.slice(0, 8)}… │ ${elapsed}s ago`);
        }
      }
    } catch (e) {
      console.log('   Error reading registry:', e.message);
    }
  }

  console.log();
  if (existsSync(PID_FILE)) {
    const pid = readFileSync(PID_FILE, 'utf-8').trim();
    console.log(`   Conductor PID: ${pid}`);
  } else {
    console.log('   ⚠️  Conductor is not running.');
  }
  console.log();
}

function handleTrackCommand(sub) {
  if (!sub || sub === 'list') {
    trackList();
  } else if (sub === 'use') {
    const name = process.argv[4];
    if (!name) {
      console.error('Usage: claude-orchestra track use <name>');
      process.exit(1);
    }
    trackUse(name);
  } else if (sub === 'add') {
    const dir = process.argv[4];
    if (!dir) {
      console.error('Usage: claude-orchestra track add <dir>');
      process.exit(1);
    }
    trackAdd(dir);
  } else {
    console.error(`Unknown track subcommand: ${sub}`);
    process.exit(1);
  }
}

function trackList() {
  console.log('\n🎵 Available Tracks\n');

  if (!existsSync(TRACKS_DIR)) {
    console.log('   No tracks directory found.');
    console.log(`   Create tracks in: ${TRACKS_DIR}\n`);
    return;
  }

  const entries = readdirSync(TRACKS_DIR, { withFileTypes: true });
  const tracks = entries.filter(e => e.isDirectory());

  if (tracks.length === 0) {
    console.log('   No tracks installed.');
    console.log(`   Add tracks to: ${TRACKS_DIR}\n`);
    return;
  }

  const config = loadConfig();
  for (const track of tracks) {
    const manifestPath = join(TRACKS_DIR, track.name, 'manifest.json');
    let label = track.name;
    if (existsSync(manifestPath)) {
      try {
        const m = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        label = `${track.name} - ${m.name}`;
      } catch {}
    }
    const active = config.track === track.name ? ' (active)' : '';
    console.log(`   ${label}${active}`);
  }
  console.log();
}

function trackUse(name) {
  const trackDir = join(TRACKS_DIR, name);
  if (!existsSync(trackDir)) {
    console.error(`Track not found: ${trackDir}`);
    console.error('Run "claude-orchestra track list" to see available tracks.');
    process.exit(1);
  }

  const config = loadConfig();
  config.mode = 'sample';
  config.track = name;
  mkdirSync(ORCHESTRA_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
  console.log(`Switched to sample mode with track: ${name}`);
  console.log('Restart the conductor for changes to take effect.');
}

function trackAdd(dir) {
  const srcDir = resolve(dir);
  if (!existsSync(srcDir)) {
    console.error(`Directory not found: ${srcDir}`);
    process.exit(1);
  }

  const manifestPath = join(srcDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error('No manifest.json found in the specified directory.');
    process.exit(1);
  }

  const name = basename(srcDir);
  const destDir = join(TRACKS_DIR, name);

  mkdirSync(TRACKS_DIR, { recursive: true });
  try {
    symlinkSync(srcDir, destDir);
    console.log(`Track "${name}" linked: ${srcDir} → ${destDir}`);
  } catch (e) {
    if (e.code === 'EEXIST') {
      console.log(`Track "${name}" already exists at ${destDir}`);
    } else {
      throw e;
    }
  }
}

function handleConfigCommand(sub) {
  if (!sub || sub === 'show') {
    const config = loadConfig();
    console.log('\n🎵 Claude Orchestra Config\n');
    console.log(JSON.stringify(config, null, 2));
    console.log();
  } else if (sub === 'set') {
    const key = process.argv[4];
    let value = process.argv[5];
    if (!key || value === undefined) {
      console.error('Usage: claude-orchestra config set <key> <value>');
      process.exit(1);
    }

    const config = loadConfig();
    // Parse numeric values
    if (!isNaN(Number(value))) value = Number(value);
    // Parse boolean values
    if (value === 'true') value = true;
    if (value === 'false') value = false;
    // Parse null
    if (value === 'null') value = null;

    config[key] = value;
    mkdirSync(ORCHESTRA_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
    console.log(`Set ${key} = ${JSON.stringify(value)}`);
  } else {
    console.error(`Unknown config subcommand: ${sub}`);
    process.exit(1);
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
  console.log(`Conductor started in background (PID ${child.pid}).`);
  process.exit(0);
}

async function start() {
  // Setup runtime directories
  mkdirSync(EVENTS_DIR, { recursive: true });
  mkdirSync(ORCHESTRA_DIR, { recursive: true });

  // Check if already running
  if (existsSync(PID_FILE)) {
    try {
      const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim());
      process.kill(pid, 0);
      console.log(`Conductor already running (PID ${pid}).`);
      process.exit(1);
    } catch {
      // Stale PID file, continue
    }
  }

  // Write PID
  writeFileSync(PID_FILE, String(process.pid));

  console.log('🎵 Claude Orchestra - Conductor starting...');

  // Load config and create engine
  const config = loadConfig();
  console.log(`  Mode: ${config.mode}${config.track ? ` (track: ${config.track})` : ''}`);

  // Load instruments
  const instrumentsData = JSON.parse(
    readFileSync(new URL('../data/instruments.json', import.meta.url), 'utf-8')
  );
  const instruments = instrumentsData.instruments;

  // Initialize engine
  const engine = createEngine(config);
  console.log('  Initializing engine...');
  await engine.init(instruments);

  // Initialize components
  const registry = new SessionRegistry(instruments);
  const watcher = new EventWatcher();

  // Ambient state
  let lastEventTime = Date.now();
  let ambientInterval = null;
  let ambientChordIndex = 0;

  // Handle events
  watcher.on('event', (event) => {
    lastEventTime = Date.now();
    handleEvent(event, registry, engine);
  });

  // Start watching
  watcher.start();
  console.log('  Watching for events...');
  console.log(`  Events directory: ${EVENTS_DIR}`);
  console.log('  Press Ctrl+C to stop.\n');

  // Ambient pad timer
  ambientInterval = setInterval(() => {
    const idle = Date.now() - lastEventTime;
    if (idle > 4000 && registry.count > 0) {
      const sessions = registry.getAll();
      engine.handleIdle(sessions, ambientChordIndex);
      ambientChordIndex = (ambientChordIndex + 1) % 4;
    }

    // Prune stale sessions every 60s
    const pruned = registry.prune(120000);
    for (const sessionId of pruned) {
      log(`Session pruned: ${sessionId}`);
    }
  }, 4000);

  // Graceful shutdown
  const cleanup = () => {
    console.log('\n🎵 Conductor stopping...');
    watcher.stop();
    engine.stopAll();
    clearInterval(ambientInterval);
    try { unlinkSync(PID_FILE); } catch {}
    process.exit(0);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
}

function handleEvent(event, registry, engine) {
  const hookEvent = event.hook_event_name || event.hook_event || '';
  const sessionId = event.session_id || 'unknown';

  if (hookEvent === 'SessionStart' || hookEvent === 'session_start') {
    const { instrument, isNew } = registry.register(sessionId);
    if (isNew && instrument) {
      log(`🎻 ${instrument.name} joins! (session ${sessionId.slice(0, 8)}…)`);
      engine.handleSessionJoin(instrument, registry.count);
    }
    return;
  }

  if (hookEvent === 'SessionEnd' || hookEvent === 'session_end') {
    const instrument = registry.unregister(sessionId);
    if (instrument) {
      log(`🎻 ${instrument.name} leaves. (session ${sessionId.slice(0, 8)}…)`);
      engine.handleSessionLeave(instrument, registry.count);
    }
    return;
  }

  if (hookEvent === 'Compact' || hookEvent === 'compact') {
    const sessions = registry.getAll();
    engine.handleCompact(sessions);
    return;
  }

  // Tool use events
  const { instrument, isNew } = registry.register(sessionId);
  if (!instrument) return;

  if (isNew) {
    log(`🎻 ${instrument.name} joins! (session ${sessionId.slice(0, 8)}…)`);
    engine.handleSessionJoin(instrument, registry.count);
    return;
  }

  // Check for error
  const input = event.input || {};
  if (input.error || input.is_error) {
    engine.handleError(instrument, registry.count);
    return;
  }

  // Normal tool event
  engine.handleToolEvent(event, instrument, registry.count);
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`  [${ts}] ${msg}`);
}
