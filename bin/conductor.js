#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import {
  handleConfigCommand,
  handleTrackCommand,
  handleVolumeCommand,
  showHelp,
  showStatus,
} from '../lib/conductor-cli.js';
import { daemonize, start, stop } from '../lib/conductor-daemon.js';

const command = process.argv[2] || 'start';
const subCommand = process.argv[3];

if (command === 'help' || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

if (command === 'version' || command === '--version' || command === '-v') {
  const packageJson = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
  );
  console.log(packageJson.version);
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
    await daemonize();
  } else {
    await start();
  }
}

if (command === 'debug') {
  process.env.CLAUDE_ORCHESTRA_DEBUG = '1';
  await start();
}
