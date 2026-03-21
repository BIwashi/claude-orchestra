import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  symlinkSync,
  statSync,
} from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { loadConfig, CONFIG_PATH } from './engine.js';
import { TRACKS_DIR } from './sample-engine.js';
import { readVolumeSignal, writeVolumeSignal } from './volume-signal.js';
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
} from './cli-format.js';
import { loadInstruments, LOG_FILE, ORCHESTRA_DIR, PID_FILE } from './conductor-daemon.js';

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

function showHelp() {
  console.log(`
${bold('🎵 Claude Orchestra')} — Turn Claude Code sessions into a live orchestra

${cyan('Usage:')} claude-orchestra <command> [options]

${cyan('Commands:')}
  ${green('start')} [--daemon]          Start the conductor
  ${green('debug')}                     Start in foreground with verbose debug logs
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

function handleTrackCommand(sub, argv = process.argv) {
  if (!sub || sub === 'list') {
    trackList();
  } else if (sub === 'use') {
    const name = argv[4];
    if (!name) {
      console.error('Usage: claude-orchestra track use <name>');
      process.exit(1);
    }
    trackUse(name);
  } else if (sub === 'add') {
    const dir = argv[4];
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

function handleConfigCommand(sub, argv = process.argv) {
  if (!sub || sub === 'show') {
    const config = loadConfig();
    console.log('\n🎵 Claude Orchestra Config\n');
    console.log(JSON.stringify(config, null, 2));
    console.log();
  } else if (sub === 'set') {
    const key = argv[4];
    let value = argv[5];
    if (!key || value === undefined) {
      console.error('Usage: claude-orchestra config set <key> <value>');
      process.exit(1);
    }

    const config = loadConfig();
    if (!isNaN(Number(value))) value = Number(value);
    if (value === 'true') value = true;
    if (value === 'false') value = false;
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

function handleVolumeCommand(argv = process.argv) {
  const requestedVolume = argv[3];
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

export {
  INSTRUMENT_COLORS,
  INSTRUMENT_EMOJIS,
  formatMode,
  formatVolume,
  getSectionStatus,
  getSessionLines,
  getUptime,
  handleConfigCommand,
  handleTrackCommand,
  handleVolumeCommand,
  inferCurrentSectionIndex,
  showHelp,
  showStatus,
  trackAdd,
  trackList,
  trackUse,
};
