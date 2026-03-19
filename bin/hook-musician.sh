#!/bin/bash
# Claude Code hook - ultra lightweight (<5ms)
# Reads event JSON from stdin (contains session_id, tool_name, hook_event_name)
# and drops it for the conductor to pick up.

ORCHESTRA_DIR="$HOME/.claude-orchestra"
EVENTS_DIR="$ORCHESTRA_DIR/events"
PID_FILE="$ORCHESTRA_DIR/conductor.pid"

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

exit 0
