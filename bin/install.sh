#!/bin/bash
# Install Claude Orchestra hooks into Claude Code settings
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_PATH="$SCRIPT_DIR/hook-musician.sh"
SETTINGS_FILE="$HOME/.claude/settings.json"

echo "🎵 Claude Orchestra - Installing hooks..."

# Ensure settings file exists
mkdir -p "$(dirname "$SETTINGS_FILE")"
if [ ! -f "$SETTINGS_FILE" ]; then
  echo '{}' > "$SETTINGS_FILE"
fi

# Use node to safely merge hooks into settings.json
node -e "
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf-8'));

if (!settings.hooks) settings.hooks = {};

const hookScript = '$HOOK_PATH';

// Add hooks for the events we care about
const hookEvents = ['PostToolUse', 'SessionStart', 'SessionEnd'];

for (const event of hookEvents) {
  if (!settings.hooks[event]) settings.hooks[event] = [];

  // Check if our hook is already installed
  const existing = settings.hooks[event].find(h => {
    // Check both flat format and nested format
    if (h.command && h.command.includes('hook-musician.sh')) return true;
    if (h.hooks && h.hooks.some(sub => sub.command && sub.command.includes('hook-musician.sh'))) return true;
    return false;
  });

  if (!existing) {
    settings.hooks[event].push({
      hooks: [{
        type: 'command',
        command: hookScript,
      }],
    });
  }
}

fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2) + '\n');
console.log('  Hooks installed successfully.');
console.log('  Events: ' + hookEvents.join(', '));
"

# Create runtime directory
mkdir -p "$HOME/.claude-orchestra/events"

echo ""
echo "  Hook path: $HOOK_PATH"
echo "  Settings:  $SETTINGS_FILE"
echo ""
echo "  Next: run 'claude-orchestra start' to begin conducting!"
echo ""
