#!/bin/bash
# Remove Claude Orchestra hooks from Claude Code settings
set -euo pipefail

SETTINGS_FILE="$HOME/.claude/settings.json"

echo "🎵 Claude Orchestra - Uninstalling hooks..."

if [ ! -f "$SETTINGS_FILE" ]; then
  echo "  No settings file found. Nothing to uninstall."
  exit 0
fi

# Use node to safely remove our hooks
node -e "
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf-8'));

if (!settings.hooks) {
  console.log('  No hooks found.');
  process.exit(0);
}

let removed = 0;
for (const [event, hooks] of Object.entries(settings.hooks)) {
  if (Array.isArray(hooks)) {
    const filtered = hooks.filter(h =>
      !(h.command && h.command.includes('hook-musician.sh'))
    );
    removed += hooks.length - filtered.length;
    settings.hooks[event] = filtered;
    if (filtered.length === 0) delete settings.hooks[event];
  }
}

if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2) + '\n');
console.log('  Removed ' + removed + ' hook(s).');
"

# Stop conductor if running
PID_FILE="$HOME/.claude-orchestra/conductor.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  kill "$PID" 2>/dev/null && echo "  Conductor stopped (PID $PID)."
  rm -f "$PID_FILE"
fi

echo ""
echo "  Hooks removed. Runtime data preserved at ~/.claude-orchestra/"
echo "  To fully clean up: rm -rf ~/.claude-orchestra/"
echo ""
