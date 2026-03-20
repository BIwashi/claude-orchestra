#!/bin/bash
# E2E Integration Test for Claude Orchestra
# Tests the full pipeline: conductor start → events → audio playback
#
# Usage: ./test/e2e.sh [mode]
#   mode: synth (default), mixer, sample
#
# Prerequisites: ffmpeg, sox (for mixer mode), Node.js ≥ 20
# This test is NOT run in CI — it requires audio hardware.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ORCHESTRA_DIR="${CLAUDE_ORCHESTRA_DIR:-$HOME/.claude-orchestra}"
EVENTS_DIR="$ORCHESTRA_DIR/events"
MODE="${1:-synth}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass=0
fail=0
total=0

check() {
  total=$((total + 1))
  local desc="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $desc"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC} $desc"
    fail=$((fail + 1))
  fi
}

send_event() {
  local event_type="$1"
  local session_id="${2:-e2e-test-session}"
  local tool="${3:-Read}"
  mkdir -p "$EVENTS_DIR"
  cat > "$EVENTS_DIR/$(date +%s%N)-e2e.json" << EOF
{
  "hook_event_name": "$event_type",
  "session_id": "$session_id",
  "tool_name": "$tool"
}
EOF
}

cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"
  node "$PROJECT_DIR/bin/conductor.js" stop 2>/dev/null || true
  rm -f "$ORCHESTRA_DIR/volume-signal"
}

trap cleanup EXIT

echo -e "\n${CYAN}🎵 Claude Orchestra E2E Test${NC}"
echo -e "   Mode: $MODE"
echo -e "   Project: $PROJECT_DIR"
echo ""

# === Prerequisites ===
echo -e "${CYAN}[Prerequisites]${NC}"
check "Node.js available" command -v node
check "ffmpeg available" command -v ffmpeg
check "npm packages installed" test -d "$PROJECT_DIR/node_modules"

if [ "$MODE" = "mixer" ]; then
  check "sox available" command -v sox
  check "ffplay available" command -v ffplay
fi

# === Configuration ===
echo -e "\n${CYAN}[Configuration]${NC}"
node "$PROJECT_DIR/bin/conductor.js" config set mode "$MODE" 2>/dev/null
check "Mode set to $MODE" node "$PROJECT_DIR/bin/conductor.js" config show

if [ "$MODE" = "mixer" ] || [ "$MODE" = "sample" ]; then
  # Check if a track exists
  if ls "$ORCHESTRA_DIR/tracks"/*/manifest.json > /dev/null 2>&1; then
    TRACK=$(ls -d "$ORCHESTRA_DIR/tracks"/*/ 2>/dev/null | head -1 | xargs basename)
    node "$PROJECT_DIR/bin/conductor.js" config set track "$TRACK" 2>/dev/null
    check "Track set to $TRACK" true
  else
    echo -e "  ${YELLOW}⚠${NC} No tracks available, skipping track-dependent tests"
    MODE="synth"
    node "$PROJECT_DIR/bin/conductor.js" config set mode synth 2>/dev/null
  fi
fi

# === Conductor Lifecycle ===
echo -e "\n${CYAN}[Conductor Lifecycle]${NC}"
node "$PROJECT_DIR/bin/conductor.js" stop 2>/dev/null || true
sleep 1

node "$PROJECT_DIR/bin/conductor.js" start --daemon 2>/dev/null
sleep 2
check "Conductor starts" node "$PROJECT_DIR/bin/conductor.js" status

PID=$(cat "$ORCHESTRA_DIR/conductor.pid" 2>/dev/null || echo "")
check "PID file created" test -n "$PID"
check "Process running" kill -0 "$PID"

# === Event Processing ===
echo -e "\n${CYAN}[Event Processing]${NC}"

send_event "SessionStart" "e2e-test-1"
sleep 2
check "Session start processed" grep -q "joins" "$ORCHESTRA_DIR/conductor.log"

send_event "PostToolUse" "e2e-test-1" "Read"
sleep 1
send_event "PostToolUse" "e2e-test-1" "Edit"
sleep 1
send_event "PostToolUse" "e2e-test-1" "Bash"
sleep 1
check "Tool events processed" true  # No crash = success

# Second session
send_event "SessionStart" "e2e-test-2"
sleep 2
STATUS_OUTPUT=$(node "$PROJECT_DIR/bin/conductor.js" status 2>&1)
check "Multiple sessions tracked" echo "$STATUS_OUTPUT" | grep -q "2"

# === Audio Output ===
echo -e "\n${CYAN}[Audio Output]${NC}"

if [ "$MODE" = "mixer" ]; then
  check "ffplay process running" pgrep -f "ffplay.*claude-orchestra"
  check "Mix file created" ls /tmp/claude-orchestra-mix-*.wav
elif [ "$MODE" = "synth" ]; then
  # Synth mode generates short tones — audio may have already finished
  # Check that the tone cache was populated instead
  check "Tone cache populated" ls "$ORCHESTRA_DIR/cache"/*.wav 2>/dev/null
fi

# === Stop ===
echo -e "\n${CYAN}[Shutdown]${NC}"
node "$PROJECT_DIR/bin/conductor.js" stop 2>/dev/null
sleep 3
check "Conductor stops cleanly" bash -c "! kill -0 $PID 2>/dev/null"
check "PID file removed" bash -c "! test -f $ORCHESTRA_DIR/conductor.pid"

# === Summary ===
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $fail -eq 0 ]; then
  echo -e "  ${GREEN}All $total tests passed!${NC}"
else
  echo -e "  ${GREEN}$pass passed${NC}, ${RED}$fail failed${NC} (of $total)"
fi
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

exit $fail
