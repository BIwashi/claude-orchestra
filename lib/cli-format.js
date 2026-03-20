const ANSI_RESET = '\x1b[0m';
const ANSI_PATTERN = new RegExp(String.raw`\u001b\[[0-9;]*m`, 'g');
const ANSI_CODES = {
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function supportsColor() {
  return Boolean(process.stdout?.isTTY);
}

function wrap(code, text) {
  const value = String(text);
  if (!supportsColor()) return value;
  return `${code}${value}${ANSI_RESET}`;
}

function bold(text) {
  return wrap(ANSI_CODES.bold, text);
}

function dim(text) {
  return wrap(ANSI_CODES.dim, text);
}

function green(text) {
  return wrap(ANSI_CODES.green, text);
}

function yellow(text) {
  return wrap(ANSI_CODES.yellow, text);
}

function red(text) {
  return wrap(ANSI_CODES.red, text);
}

function cyan(text) {
  return wrap(ANSI_CODES.cyan, text);
}

function magenta(text) {
  return wrap(ANSI_CODES.magenta, text);
}

function stripAnsi(text) {
  return String(text).replace(ANSI_PATTERN, '');
}

function box(title, lines) {
  const content = [String(title), ...lines.map((line) => String(line))];
  const innerWidth = Math.max(...content.map((line) => stripAnsi(line).length), 0);
  const top = `┌─${'─'.repeat(innerWidth + 2)}┐`;
  const body = [
    `│ ${String(title).padEnd(innerWidth + (String(title).length - stripAnsi(title).length))} │`,
    `├─${'─'.repeat(innerWidth + 2)}┤`,
    ...lines.map((line) => {
      const raw = String(line);
      const pad = innerWidth + (raw.length - stripAnsi(raw).length);
      return `│ ${raw.padEnd(pad)} │`;
    }),
  ];
  const bottom = `└─${'─'.repeat(innerWidth + 2)}┘`;
  return [top, ...body, bottom].join('\n');
}

function progressBar(current, total, width = 20) {
  const safeTotal = total > 0 ? total : 1;
  const ratio = Math.max(0, Math.min(1, current / safeTotal));
  const filled = Math.round(ratio * width);
  const empty = Math.max(0, width - filled);
  const percent = Math.round(ratio * 100);
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export { bold, box, cyan, dim, formatDuration, green, magenta, progressBar, red, yellow };
