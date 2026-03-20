#!/usr/bin/env node

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  copyFileSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { EventWatcher, EVENTS_DIR } from '../lib/event-watcher.js';
import { SessionRegistry } from '../lib/registry.js';
import { createEngine, loadConfig, CONFIG_PATH } from '../lib/engine.js';
import { TRACKS_DIR } from '../lib/sample-engine.js';
import {
  checkSetupPrerequisites,
  formatMissingDependencies,
  hasCommand,
} from '../lib/prerequisites.js';

const ORCHESTRA_DIR = join(process.env.HOME, '.claude-orchestra');
const PID_FILE = join(ORCHESTRA_DIR, 'conductor.pid');
const LOG_FILE = join(ORCHESTRA_DIR, 'conductor.log');
const PREPARE_TRACK_SCRIPT = fileURLToPath(new URL('./prepare-track.sh', import.meta.url));
const DEMO_MIDI_PATH = fileURLToPath(new URL('../data/tracks/demo/can-can.mid', import.meta.url));
const DEMO_TRACK_NAME = 'demo';
const DEMO_TIMESTAMPS = '0:00,0:20,0:40,1:00,1:20,1:40,2:00';
const SOUNDFONT_CANDIDATES = [
  process.env.CLAUDE_ORCHESTRA_SOUNDFONT,
  process.env.SOUNDFONT,
  join(process.env.HOME, 'Library/Audio/Sounds/Banks/FluidR3_GM.sf2'),
  join(process.env.HOME, 'Library/Audio/Sounds/Banks/FluidR3_GM.sf3'),
  '/opt/homebrew/share/soundfonts/FluidR3_GM.sf2',
  '/opt/homebrew/share/soundfonts/FluidR3_GM.sf3',
  '/opt/homebrew/share/sounds/sf2/FluidR3_GM.sf2',
  '/usr/local/share/soundfonts/FluidR3_GM.sf2',
  '/usr/local/share/soundfonts/FluidR3_GM.sf3',
  '/usr/local/share/sounds/sf2/FluidR3_GM.sf2',
  '/usr/share/sounds/sf2/FluidR3_GM.sf2',
  '/usr/share/sounds/sf3/FluidR3_GM.sf3',
].filter(Boolean);

// --- CLI ---
const command = process.argv[2] || 'start';
const subCommand = process.argv[3];

await main();

async function main() {
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

  if (command === 'setup') {
    await setup();
    process.exit(0);
  }

  if (command === 'start') {
    const daemon = process.argv.includes('--daemon');
    if (daemon) {
      await daemonize();
    } else {
      await start();
    }
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
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
          console.log(
            `   🎻 ${info.instrumentId.padEnd(10)} │ session: ${id.slice(0, 8)}… │ ${elapsed}s ago`,
          );
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
  const tracks = entries.filter((e) => e.isDirectory() || e.isSymbolicLink());

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

async function daemonize(options = {}) {
  const { spawn } = await import('node:child_process');
  const { openSync } = await import('node:fs');
  mkdirSync(ORCHESTRA_DIR, { recursive: true });
  const out = openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [process.argv[1], 'start'], {
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();
  if (!options.quiet) {
    console.log(`Conductor started in background (PID ${child.pid}).`);
  }
  if (options.exitAfterSpawn !== false) {
    process.exit(0);
  }
  return child.pid;
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
    readFileSync(new URL('../data/instruments.json', import.meta.url), 'utf-8'),
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

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`  [${ts}] ${msg}`);
}

async function setup() {
  mkdirSync(ORCHESTRA_DIR, { recursive: true });

  console.log('\n🎵 Claude Orchestra setup\n');

  const prerequisites = checkSetupPrerequisites();

  if (prerequisites.missingRequired.length > 0) {
    console.log('Missing required dependencies:');
    for (const line of formatMissingDependencies(prerequisites.missingRequired)) {
      console.log(line);
    }
    console.log();
    process.exit(1);
  }

  if (prerequisites.missingMixer.length > 0) {
    console.log(
      'Mixer mode dependencies not found. Setup will fall back to synth mode until these are installed:',
    );
    for (const line of formatMissingDependencies(prerequisites.missingMixer)) {
      console.log(line);
    }
    console.log();
  }

  let track = getFirstAvailableTrack();
  if (!track) {
    track = prepareDemoTrack(prerequisites);
  }

  const config = loadConfig();
  config.mode = track && prerequisites.mixerReady ? 'mixer' : 'synth';
  config.track = track ? track.name : null;
  saveConfig(config);

  const runningPid = getRunningPid();
  if (runningPid) {
    console.log(`Restarting existing conductor (PID ${runningPid})...`);
    stop();
    await waitForProcessExit(runningPid);
  }

  await daemonize({ exitAfterSpawn: false, quiet: true });

  console.log('🎵 Claude Orchestra is running!');
  console.log(`Mode: ${config.mode}${track ? ` (track: ${track.name})` : ''}`);
  console.log('Open Claude Code sessions to hear the music.');
  console.log('Run `claude-orchestra status` to check, `claude-orchestra stop` to stop.');
  console.log();
}

function getFirstAvailableTrack() {
  if (!existsSync(TRACKS_DIR)) {
    return null;
  }

  const tracks = readdirSync(TRACKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(TRACKS_DIR, name, 'manifest.json')))
    .sort((a, b) => a.localeCompare(b));

  if (tracks.length === 0) {
    return null;
  }

  return { name: tracks[0], path: join(TRACKS_DIR, tracks[0]) };
}

function prepareDemoTrack(prerequisites) {
  if (!prerequisites.fluidsynth.available) {
    console.log('No sample tracks found, and fluidsynth is not installed.');
    console.log('Install it to generate the bundled demo track: brew install fluid-synth');
    console.log();
    return null;
  }

  const soundfontPath = findSoundfont();
  if (!soundfontPath) {
    console.log('No sample tracks found, and no General MIDI soundfont was found.');
    console.log('Install one and re-run setup, or set SOUNDFONT=/path/to/file.sf2.');
    console.log('Common package locations checked:');
    for (const candidate of SOUNDFONT_CANDIDATES) {
      console.log(`- ${candidate}`);
    }
    console.log();
    return null;
  }

  const demoTrackDir = join(TRACKS_DIR, DEMO_TRACK_NAME);
  if (existsSync(join(demoTrackDir, 'manifest.json'))) {
    return { name: DEMO_TRACK_NAME, path: demoTrackDir };
  }

  console.log('No tracks found. Generating the bundled demo track...');

  const tempDir = mkdtempSync(join(tmpdir(), 'claude-orchestra-setup-'));
  const midiPath = join(tempDir, 'can-can.mid');
  const wavPath = join(tempDir, 'can-can.wav');

  try {
    copyFileSync(DEMO_MIDI_PATH, midiPath);

    runStep('Rendering demo MIDI with fluidsynth', 'fluidsynth', [
      '-ni',
      soundfontPath,
      midiPath,
      '-F',
      wavPath,
      '-r',
      '44100',
    ]);

    const prepareArgs = [
      PREPARE_TRACK_SCRIPT,
      wavPath,
      '--name',
      DEMO_TRACK_NAME,
      '--output',
      demoTrackDir,
      '--timestamps',
      DEMO_TIMESTAMPS,
      '--events',
      '6',
    ];

    const demucsReady = hasCommand('demucs') || hasCommand('uvx') || hasCommand('uv');

    if (demucsReady) {
      const result = runStep('Separating stems and building demo sections', 'bash', prepareArgs, {
        allowFailure: true,
      });
      if (result.status !== 0) {
        console.log('demucs-based preparation failed. Retrying without stem separation...');
        runStep('Building single-part demo track', 'bash', [...prepareArgs, '--skip-demucs']);
      }
    } else {
      console.log('demucs was not found. Building a single-part demo track instead.');
      runStep('Building single-part demo track', 'bash', [...prepareArgs, '--skip-demucs']);
    }

    customizeDemoManifest(demoTrackDir);
    return { name: DEMO_TRACK_NAME, path: demoTrackDir };
  } catch (error) {
    console.log(`Demo track generation failed: ${error.message}`);
    console.log('Setup will continue in synth mode.');
    console.log();
    return null;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function customizeDemoManifest(trackDir) {
  const manifestPath = join(trackDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    return;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  manifest.name = 'Offenbach - Can-Can Demo';

  const sectionNames = [
    'Introduction',
    'Theme A',
    'Theme B',
    'Development',
    'Build',
    'Recap',
    'Finale',
  ];

  for (let i = 0; i < manifest.sections.length; i++) {
    manifest.sections[i].name = sectionNames[i] || manifest.sections[i].name;
    if (i === manifest.sections.length - 1) {
      manifest.sections[i].loop = true;
    }
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

function runStep(label, commandName, args, options = {}) {
  console.log(`${label}...`);
  const result = spawnSync(commandName, args, { stdio: 'inherit' });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${commandName} exited with status ${result.status ?? 'unknown'}`);
  }
  return result;
}

function findSoundfont() {
  for (const candidate of SOUNDFONT_CANDIDATES) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function saveConfig(config) {
  mkdirSync(ORCHESTRA_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

function getRunningPid() {
  if (!existsSync(PID_FILE)) {
    return null;
  }

  try {
    const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim());
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

async function waitForProcessExit(pid, timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      process.kill(pid, 0);
      await sleep(100);
    } catch {
      return;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
