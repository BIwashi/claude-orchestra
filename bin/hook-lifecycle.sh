#!/bin/bash
# Claude Code hook - manages conductor lifecycle
# Called on SessionStart and SessionEnd to auto-start/stop the conductor.
# Reads hook_event_name from stdin JSON.
# Designed to be ultra-fast (<5ms) and never fail.

ORCHESTRA_DIR="$HOME/.claude-orchestra"
PID_FILE="$ORCHESTRA_DIR/conductor.pid"
CONFIG_FILE="$ORCHESTRA_DIR/config.json"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

# Read stdin
INPUT=$(cat)

# Extract hook event name
HOOK_EVENT=$(echo "$INPUT" | grep -o '"hook_event_name":"[^"]*"' | head -1 | cut -d'"' -f4)

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

ensure_config() {
  # Create default config if none exists
  # Checks for prepared tracks in priority order, falls back to synth
  if [ ! -f "$CONFIG_FILE" ]; then
    mkdir -p "$ORCHESTRA_DIR"
    for track in ode-to-joy new-world orpheus-underworld; do
      TRACK_DIR="$ORCHESTRA_DIR/tracks/$track"
      if [ -d "$TRACK_DIR" ] && [ -f "$TRACK_DIR/manifest.json" ]; then
        echo "{\"mode\":\"mixer\",\"volume\":0.3,\"track\":\"$track\"}" > "$CONFIG_FILE"
        return
      fi
    done
    echo '{"mode":"synth","volume":0.3}' > "$CONFIG_FILE"
  fi
}

case "$HOOK_EVENT" in
  SessionStart)
    # Start conductor if not already running
    if is_running; then
      exit 0
    fi
    rm -f "$PID_FILE"
    mkdir -p "$ORCHESTRA_DIR/events"
    ensure_config

    # Start conductor in daemon mode
    node "$PLUGIN_ROOT/bin/conductor.js" start --daemon 2>/dev/null || true
    exit 0
    ;;

  SessionEnd)
    # Write the event file so conductor knows about the session end
    # (conductor will handle the actual lifecycle via prune)
    # Don't kill the conductor immediately — other sessions may be active
    mkdir -p "$ORCHESTRA_DIR/events"
    SESSION_ID=$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "$INPUT" > "$ORCHESTRA_DIR/events/$(date +%s%N)-session-end.json" 2>/dev/null || true
    exit 0
    ;;
esac

exit 0
