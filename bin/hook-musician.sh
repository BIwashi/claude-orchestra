#!/bin/bash
# Claude Code hook - ultra lightweight (<5ms)
# Reads event JSON from stdin (contains session_id, tool_name, hook_event_name)
# and drops it for the conductor to pick up.
# Outputs status line to stdout for Claude context injection.

ORCHESTRA_DIR="$HOME/.claude-orchestra"
EVENTS_DIR="$ORCHESTRA_DIR/events"
PID_FILE="$ORCHESTRA_DIR/conductor.pid"
STATUS_FILE="$ORCHESTRA_DIR/status.json"

# Quick exit if conductor is not running
[ -f "$PID_FILE" ] || exit 0
[ -d "$EVENTS_DIR" ] || exit 0

# Read stdin - Claude Code passes full JSON with session_id, tool_name, etc.
INPUT=$(cat)

# Timestamp for unique filename
TIMESTAMP=$(date +%s%N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1e9))')

# Atomic write: tmp → mv
TMP_FILE="$EVENTS_DIR/.tmp-${TIMESTAMP}-$$"
EVENT_FILE="$EVENTS_DIR/${TIMESTAMP}-$$.json"

echo "$INPUT" > "$TMP_FILE"
mv "$TMP_FILE" "$EVENT_FILE"

# Output status line to stdout (injected into Claude's context)
if [ -f "$STATUS_FILE" ]; then
  STATUS=$(cat "$STATUS_FILE" 2>/dev/null)
  TRACK=$(echo "$STATUS" | grep -o '"track":"[^"]*"' | head -1 | cut -d'"' -f4)
  SECTION=$(echo "$STATUS" | grep -o '"section":"[^"]*"' | head -1 | cut -d'"' -f4)
  SESSIONS=$(echo "$STATUS" | grep -o '"sessions":[0-9]*' | head -1 | cut -d: -f2)
  if [ -n "$TRACK" ]; then
    echo "🎵 Orchestra: ${TRACK} — ${SECTION:-idle} (${SESSIONS:-0} sessions)"
  fi
fi

exit 0
