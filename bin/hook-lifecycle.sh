#!/bin/bash
# Claude Code hook - manages conductor lifecycle
# Called on SessionStart and SessionEnd to auto-start/stop the conductor.
# Reads hook_event_name from stdin JSON.

ORCHESTRA_DIR="$HOME/.claude-orchestra"
PID_FILE="$ORCHESTRA_DIR/conductor.pid"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

# Read stdin
INPUT=$(cat)

# Extract hook event name
HOOK_EVENT=$(echo "$INPUT" | grep -o '"hook_event_name":"[^"]*"' | head -1 | cut -d'"' -f4)

case "$HOOK_EVENT" in
  SessionStart)
    # Start conductor if not already running
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if kill -0 "$PID" 2>/dev/null; then
        exit 0  # Already running
      fi
      rm -f "$PID_FILE"
    fi

    mkdir -p "$ORCHESTRA_DIR/events"

    # Start conductor in daemon mode (conductor.js manages its own PID file)
    node "$PLUGIN_ROOT/bin/conductor.js" start --daemon 2>/dev/null || true
    exit 0
    ;;

  SessionEnd)
    # Stop conductor only if no other Claude sessions are active
    # Simple approach: always stop (will restart on next SessionStart)
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      kill "$PID" 2>/dev/null || true
      rm -f "$PID_FILE"
    fi
    exit 0
    ;;
esac

exit 0
