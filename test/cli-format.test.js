import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

describe('cli-format', () => {
  let originalIsTTY;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
      writable: true,
    });
  });

  it('returns plain text when stdout is not a TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      configurable: true,
      writable: true,
    });

    expect(bold('x')).toBe('x');
    expect(dim('x')).toBe('x');
    expect(green('x')).toBe('x');
    expect(yellow('x')).toBe('x');
    expect(red('x')).toBe('x');
    expect(cyan('x')).toBe('x');
    expect(magenta('x')).toBe('x');
  });

  it('wraps text with ANSI codes when stdout is a TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
      writable: true,
    });

    expect(green('ok')).toBe('\x1b[32mok\x1b[0m');
    expect(bold('ok')).toBe('\x1b[1mok\x1b[0m');
  });

  it('draws a unicode box around content', () => {
    expect(box('Status', ['Mode: sample', 'Volume: 50%'])).toBe(
      [
        '┌───────────────┐',
        '│ Status       │',
        '├───────────────┤',
        '│ Mode: sample │',
        '│ Volume: 50%  │',
        '└───────────────┘',
      ].join('\n'),
    );
  });

  it('renders progress bars', () => {
    expect(progressBar(2, 5)).toBe('[████████░░░░░░░░░░░░] 40%');
    expect(progressBar(10, 5, 10)).toBe('[██████████] 100%');
  });

  it('formats durations compactly', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(150)).toBe('2m 30s');
    expect(formatDuration(3665)).toBe('1h 1m 5s');
  });
});
