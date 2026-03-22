/**
 * Automated setup for Claude Orchestra.
 *
 * Checks dependencies, acquires a soundfont, renders the default track
 * from bundled MIDI, configures mixer mode, and starts the daemon.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const ORCHESTRA_DIR = join(homedir(), '.claude-orchestra');
const CONFIG_PATH = join(ORCHESTRA_DIR, 'config.json');
const TRACKS_DIR = join(ORCHESTRA_DIR, 'tracks');

function checkDependency(name) {
  const result = spawnSync('command', ['-v', name], { shell: true, encoding: 'utf-8' });
  return result.status === 0;
}

function checkDependencies() {
  const deps = [
    { name: 'ffmpeg', required: true, purpose: 'Audio encoding/decoding' },
    { name: 'ffplay', required: true, purpose: 'Audio playback' },
    { name: 'sox', required: true, purpose: 'Multi-stem mixing (mixer mode)' },
    { name: 'fluidsynth', required: false, purpose: 'MIDI rendering (for bundled tracks)' },
  ];

  const results = deps.map((dep) => ({
    ...dep,
    installed: checkDependency(dep.name),
  }));

  return results;
}

function printDependencyTable(deps) {
  console.log('\n  Dependencies:');
  for (const dep of deps) {
    const icon = dep.installed ? '✓' : '✗';
    const req = dep.required ? 'required' : 'optional';
    console.log(
      `    ${icon} ${dep.name.padEnd(12)} ${dep.installed ? 'installed' : 'MISSING'}  (${req}: ${dep.purpose})`,
    );
  }
  console.log('');
}

function findSoundfont(scriptDir) {
  const result = spawnSync('bash', [join(scriptDir, 'find-soundfont.sh')], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }
  return null;
}

function renderTrack(scriptDir, midiPath, trackName, outputDir, soundfont) {
  const args = [
    join(scriptDir, 'render-midi-tracks.sh'),
    midiPath,
    outputDir,
    '--name',
    trackName,
    '--soundfont',
    soundfont,
    '--timestamps',
    '0:00,0:30,1:00,1:30',
    '--events',
    '8',
  ];

  const result = spawnSync('bash', args, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });

  return result.status === 0;
}

function writeConfig(mode, track, volume = 0.5) {
  mkdirSync(ORCHESTRA_DIR, { recursive: true });
  const config = { mode, volume };
  if (track) config.track = track;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

export async function setup() {
  const scriptDir = new URL('../bin', import.meta.url).pathname;
  const dataDir = new URL('../data', import.meta.url).pathname;

  console.log('🎵 Claude Orchestra — Setup');
  console.log('');

  // Step 1: Check dependencies
  console.log('  [1/4] Checking dependencies...');
  const deps = checkDependencies();
  printDependencyTable(deps);

  const missingRequired = deps.filter((d) => d.required && !d.installed);
  if (missingRequired.length > 0) {
    console.log('  Missing required dependencies:');
    const names = missingRequired.map((d) => d.name).join(' ');
    console.log(`    brew install ${names}  (macOS)`);
    console.log(`    sudo apt install -y ${names}  (Linux)`);
    console.log('');
    console.log('  Or use synth mode (no external audio, requires only ffmpeg):');
    console.log('    npx claude-orchestra config set mode synth');
    console.log('    npx claude-orchestra start --daemon');

    // If only ffmpeg is available, set up synth mode
    if (checkDependency('ffmpeg')) {
      console.log('');
      console.log('  Setting up synth mode as fallback...');
      writeConfig('synth');
      console.log('  ✓ Configured for synth mode.');
    }
    process.exit(1);
  }

  const hasFluidsynth = deps.find((d) => d.name === 'fluidsynth')?.installed;

  // Step 2: Find or download soundfont
  let soundfont = null;
  if (hasFluidsynth) {
    console.log('  [2/4] Finding soundfont...');
    soundfont = findSoundfont(scriptDir);
    if (soundfont) {
      console.log(`    ✓ ${soundfont}`);
    } else {
      console.log('    ✗ No soundfont found. Falling back to synth mode.');
    }
  } else {
    console.log('  [2/4] Skipping soundfont (fluidsynth not installed)');
  }

  // Step 3: Render default track
  const defaultTrack = 'ode-to-joy';
  const midiPath = join(dataDir, 'tracks', defaultTrack, 'source.mid');
  const trackOutputDir = join(TRACKS_DIR, defaultTrack);

  if (hasFluidsynth && soundfont && existsSync(midiPath)) {
    // Check if track is already prepared
    const manifestPath = join(trackOutputDir, 'manifest.json');
    if (existsSync(manifestPath)) {
      console.log(`  [3/4] Track "${defaultTrack}" already prepared. Skipping render.`);
    } else {
      console.log(`  [3/4] Rendering "${defaultTrack}" from MIDI...`);
      const success = renderTrack(
        scriptDir,
        midiPath,
        'Beethoven - Ode to Joy',
        trackOutputDir,
        soundfont,
      );
      if (!success) {
        console.log('    ✗ Render failed. Falling back to synth mode.');
        writeConfig('synth');
        return;
      }
    }
    writeConfig('mixer', defaultTrack);
    console.log('  ✓ Configured for mixer mode with ode-to-joy');
  } else {
    console.log('  [3/4] No MIDI rendering available. Using synth mode.');
    writeConfig('synth');
    console.log('  ✓ Configured for synth mode');
  }

  // Step 4: Start conductor
  console.log('  [4/4] Starting conductor daemon...');
  try {
    const result = spawnSync('node', [join(scriptDir, 'conductor.js'), 'start', '--daemon'], {
      encoding: 'utf-8',
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      console.log('    ✗ Failed to start conductor. Run manually:');
      console.log('      npx claude-orchestra start --daemon');
    }
  } catch {
    console.log('    ✗ Failed to start conductor.');
  }

  console.log('');
  console.log('  🎵 Setup complete! Music will play when you use Claude Code.');
  console.log('');
}
