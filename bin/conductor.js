#!/usr/bin/env node

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  readdirSync,
  symlinkSync,
  statSync,
} from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { EventWatcher, EVENTS_DIR } from '../lib/event-watcher.js';
import { SessionRegistry } from '../lib/registry.js';
import { createEngine, loadConfig, CONFIG_PATH } from '../lib/engine.js';
import { TRACKS_DIR } from '../lib/sample-engine.js';
import { consumeVolumeSignal, readVolumeSignal, writeVolumeSignal } from '../lib/volume-signal.js';
import {
  bold,
  box,
  cyan,
  dim,
  formatDuration,
  green,
  magenta,
  progressBar,
  red,
  yellow,
} from '../lib/cli-format.js';

const ORCHESTRA_DIR = join(homedir(), '.claude-orchestra');
const PID_FILE = join(ORCHESTRA_DIR, 'conductor.pid');
const LOG_FILE = join(ORCHESTRA_DIR, 'conductor.log');
const INSTRUMENT_EMOJIS = {
  piano: '🎹',
  cello: '🎻',
  flute: '🪈',
  marimba: '🎼',
  clarinet: '🎷',
  harp: '🪉',
  bell: '🔔',
  strings: '🎻',
};
const INSTRUMENT_COLORS = [cyan, magenta, green, yellow, red];

// --- CLI ---
const command = process.argv[2] || 'start';
const subCommand = process.argv[3];

if (command === 'help' || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

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

if (command === 'volume') {
  handleVolumeCommand();
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

function showStatus() {
  const config = loadConfig();
  const registryPath = join(ORCHESTRA_DIR, 'registry.json');
  const headerLines = [
    `Mode: ${cyan(formatMode(config))}`,
    `Volume: ${magenta(formatVolume(config.volume))}`,
  ];
  const uptime = getUptime();
  if (uptime) {
    headerLines.push(
      `Uptime: ${bold(formatDuration(uptime.seconds))} ${dim(`(PID ${uptime.pid})`)}`,
    );
  } else {
    headerLines.push(`Status: ${red('Not running')}`);
  }

  console.log();
  console.log(box(bold('Claude Orchestra Status'), headerLines));
  console.log();

  const sessionsResult = getSessionLines(registryPath);
  if (sessionsResult.error) {
    console.log(red(`Error reading registry: ${sessionsResult.error}`));
  } else {
    console.log(bold(`Active Sessions ${dim(`(${sessionsResult.count})`)}`));
    for (const line of sessionsResult.lines) {
      console.log(line);
    }
  }

  const sectionStatus = getSectionStatus(config);
  if (sectionStatus) {
    console.log();
    console.log(bold('Current Section'));
    console.log(sectionStatus.title);
    console.log(
      `${progressBar(sectionStatus.current, sectionStatus.total)} ${dim(sectionStatus.detail)}`,
    );
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
  const tracks = entries.filter((e) => e.isDirectory());

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
      } catch {
        /* ignore */
      }
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
  config.mode = 'mixer';
  config.track = name;
  mkdirSync(ORCHESTRA_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
  console.log(`Switched to mixer mode with track: ${name}`);
  console.log(`Selected mode: ${config.mode}`);
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
  console.log(`${green('✓ Conductor started')} ${dim(`(PID ${child.pid})`)}`);
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
  const instruments = loadInstruments();

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
  let volumeSignalInterval = null;
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

  // Volume signal polling (every 2s)
  volumeSignalInterval = setInterval(() => {
    try {
      const nextVolume = consumeVolumeSignal();
      if (nextVolume === null) return;
      config.volume = nextVolume;
      engine.setVolume(nextVolume);
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
      log(`Volume changed to ${nextVolume}`);
    } catch (e) {
      log(`Failed to process volume signal: ${e.message}`);
    }
  }, 2000);

  // Graceful shutdown
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

function handleVolumeCommand() {
  const requestedVolume = process.argv[3];
  if (requestedVolume === undefined) {
    const pendingVolume = readVolumeSignal();
    const currentVolume = pendingVolume ?? loadConfig().volume;
    console.log(currentVolume);
    return;
  }
  try {
    mkdirSync(ORCHESTRA_DIR, { recursive: true });
    const volume = writeVolumeSignal(requestedVolume);
    console.log(`Volume signal written: ${volume}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
${bold('🎵 Claude Orchestra')} — Turn Claude Code sessions into a live orchestra

${cyan('Usage:')} claude-orchestra <command> [options]

${cyan('Commands:')}
  ${green('start')} [--daemon]          Start the conductor
  ${green('stop')}                      Stop the conductor
  ${green('status')}                    Show current state
  ${green('volume')} [0.0-1.0]          Get or set volume (live, no restart)
  ${green('config show')}               Show configuration
  ${green('config set')} <key> <value>  Set config (mode, volume, track)
  ${green('track list')}                List available tracks
  ${green('track use')} <name>          Switch track
  ${green('help')}                      Show this help

${cyan('Modes:')}
  ${green('mixer')}   ${dim('Pre-mix stems with sox + ffplay (recommended)')}
  ${green('synth')}   ${dim('Generate tones via ffmpeg (no track needed)')}
  ${green('sample')}  ${dim('Play pre-recorded stems (legacy)')}

${cyan('Examples:')}
  claude-orchestra start --daemon
  claude-orchestra config set mode mixer
  claude-orchestra volume 0.3
  claude-orchestra track list

${dim('Docs: https://github.com/BIwashi/claude-orchestra')}
`);
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`  [${ts}] ${msg}`);
}

function loadInstruments() {
  const instrumentsData = JSON.parse(
    readFileSync(new URL('../data/instruments.json', import.meta.url), 'utf-8'),
  );
  return instrumentsData.instruments;
}

function formatMode(config) {
  if (config.track) {
    return `${config.mode} / ${config.track}`;
  }
  return config.mode;
}

function formatVolume(volume) {
  return `${Math.round((volume || 0) * 100)}%`;
}

function getUptime() {
  if (!existsSync(PID_FILE)) return null;

  try {
    const pid = readFileSync(PID_FILE, 'utf-8').trim();
    const startedAt = statSync(PID_FILE).mtimeMs;
    return {
      pid,
      seconds: Math.max(0, (Date.now() - startedAt) / 1000),
    };
  } catch {
    return null;
  }
}

function getSessionLines(registryPath) {
  if (!existsSync(registryPath)) {
    return {
      count: 0,
      lines: [dim('No active sessions. Open Claude Code to hear the music!')],
    };
  }

  try {
    const data = JSON.parse(readFileSync(registryPath, 'utf-8'));
    const sessions = Object.entries(data.sessions || {});
    if (sessions.length === 0) {
      return {
        count: 0,
        lines: [dim('No active sessions. Open Claude Code to hear the music!')],
      };
    }

    const instruments = new Map(loadInstruments().map((instrument) => [instrument.id, instrument]));
    const lines = sessions.map(([id, info], index) => {
      const instrument = instruments.get(info.instrumentId);
      const emoji = INSTRUMENT_EMOJIS[info.instrumentId] || '🎵';
      const color = INSTRUMENT_COLORS[index % INSTRUMENT_COLORS.length];
      const name = instrument?.name || info.instrumentId;
      const elapsed = Math.round((Date.now() - (info.joinedAt || Date.now())) / 1000);
      return `${emoji} ${color(name)} ${dim(`session ${id.slice(0, 8)}… • joined ${formatDuration(elapsed)} ago`)}`;
    });

    return { count: sessions.length, lines };
  } catch (error) {
    return { error: error.message, count: 0, lines: [] };
  }
}

function getSectionStatus(config) {
  if (!['sample', 'mixer'].includes(config.mode) || !config.track) {
    return null;
  }

  const manifestPath = join(TRACKS_DIR, config.track, 'manifest.json');
  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const sections = manifest.sections || [];
    if (sections.length === 0) return null;

    const currentIndex = inferCurrentSectionIndex(sections);
    const section = sections[currentIndex] || sections[0];
    return {
      current: currentIndex + 1,
      total: sections.length,
      title: `${cyan(section.name || section.id)} ${dim(`(${currentIndex + 1}/${sections.length})`)}`,
      detail: `${manifest.name || config.track}`,
    };
  } catch {
    return null;
  }
}

function inferCurrentSectionIndex(sections) {
  if (!existsSync(LOG_FILE)) return 0;

  try {
    const lines = readFileSync(LOG_FILE, 'utf-8').trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const match = lines[i].match(/\[section\] → (.+)$/);
      if (!match) continue;

      const name = match[1].trim();
      const index = sections.findIndex((section) => section.name === name || section.id === name);
      if (index >= 0) {
        return index;
      }
    }
  } catch {
    return 0;
  }

  return 0;
}
