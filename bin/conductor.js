#!/usr/bin/env node

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
