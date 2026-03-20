import { spawnSync } from 'node:child_process';

const INSTALL_HINTS = {
  ffmpeg: 'brew install ffmpeg',
  ffplay: 'brew install ffmpeg',
  sox: 'brew install sox',
  fluidsynth: 'brew install fluid-synth',
};

function hasCommand(command, { spawnSyncFn = spawnSync } = {}) {
  const result = spawnSyncFn('sh', ['-lc', `command -v ${command}`], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

function getInstallHint(command) {
  return INSTALL_HINTS[command] || null;
}

function checkCommands(commands, { hasCommandFn = hasCommand } = {}) {
  return commands.map((command) => ({
    command,
    available: hasCommandFn(command),
    installHint: getInstallHint(command),
  }));
}

function checkSetupPrerequisites(options = {}) {
  const [ffmpeg, sox, ffplay, fluidsynth] = checkCommands(
    ['ffmpeg', 'sox', 'ffplay', 'fluidsynth'],
    options,
  );

  return {
    ffmpeg,
    sox,
    ffplay,
    fluidsynth,
    missingRequired: [ffmpeg].filter((dep) => !dep.available),
    missingMixer: [sox, ffplay].filter((dep) => !dep.available),
    mixerReady: sox.available && ffplay.available,
  };
}

function formatMissingDependencies(dependencies) {
  return dependencies.map((dependency) =>
    dependency.installHint
      ? `- ${dependency.command}: ${dependency.installHint}`
      : `- ${dependency.command}: install required`,
  );
}

export {
  INSTALL_HINTS,
  hasCommand,
  getInstallHint,
  checkCommands,
  checkSetupPrerequisites,
  formatMissingDependencies,
};
