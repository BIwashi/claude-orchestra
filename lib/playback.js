import { spawn, spawnSync } from 'node:child_process';

function getPlatform() {
  return process.platform;
}

function commandExists(command) {
  const result = spawnSync('which', [command], { stdio: 'ignore' });
  return result.status === 0;
}

function clampVolume(volume) {
  const numericVolume = Number.isFinite(volume) ? volume : 1;
  return Math.max(0, Math.min(1, numericVolume));
}

function buildFfplayArgs(filePath, options = {}) {
  const args = ['-nodisp', '-autoexit', '-loglevel', 'quiet'];
  if (options.volume !== undefined) {
    args.push('-af', `volume=${clampVolume(options.volume)}`);
  }
  args.push(filePath);
  return args;
}

function buildAfplayArgs(filePath, options = {}) {
  const args = [];
  if (options.volume !== undefined) {
    args.push('-v', String(clampVolume(options.volume)));
  }
  args.push(filePath);
  return args;
}

function buildPaplayArgs(filePath, options = {}) {
  const args = [];
  if (options.volume !== undefined) {
    args.push('--volume', String(Math.round(clampVolume(options.volume) * 65536)));
  }
  args.push(filePath);
  return args;
}

function buildAplayArgs(filePath) {
  return [filePath];
}

let cachedPlayer;
let hasCachedPlayer = false;

function detectPlayer() {
  if (hasCachedPlayer) {
    return cachedPlayer;
  }

  const platform = getPlatform();
  if (platform === 'win32') {
    cachedPlayer = null;
    hasCachedPlayer = true;
    return cachedPlayer;
  }

  if (commandExists('ffplay')) {
    cachedPlayer = {
      command: 'ffplay',
      args: (filePath, options) => buildFfplayArgs(filePath, options),
    };
    hasCachedPlayer = true;
    return cachedPlayer;
  }

  if (platform === 'darwin' && commandExists('afplay')) {
    cachedPlayer = {
      command: 'afplay',
      args: (filePath, options) => buildAfplayArgs(filePath, options),
    };
    hasCachedPlayer = true;
    return cachedPlayer;
  }

  if (platform === 'linux' && commandExists('paplay')) {
    cachedPlayer = {
      command: 'paplay',
      args: (filePath, options) => buildPaplayArgs(filePath, options),
    };
    hasCachedPlayer = true;
    return cachedPlayer;
  }

  if (platform === 'linux' && commandExists('aplay')) {
    cachedPlayer = {
      command: 'aplay',
      args: (filePath, options) => buildAplayArgs(filePath, options),
    };
    hasCachedPlayer = true;
    return cachedPlayer;
  }

  cachedPlayer = null;
  hasCachedPlayer = true;
  return cachedPlayer;
}

function isSupported() {
  return detectPlayer() !== null;
}

function playFile(filePath, options = {}) {
  const player = detectPlayer();
  if (!player) {
    throw new Error(`Audio playback is not supported on platform: ${getPlatform()}`);
  }

  return spawn(player.command, player.args(filePath, options), {
    stdio: 'ignore',
    detached: false,
    ...options.spawnOptions,
  });
}

export { commandExists, detectPlayer, isSupported, playFile };
