#!/bin/bash
# Render a MIDI file into grouped instrument parts using fluidsynth.
#
# Usage: render-midi-tracks.sh <input.mid> <output-dir> [options]
#
# Options:
#   --soundfont <path>    Path to soundfont (auto-detected if omitted)
#   --timestamps <t,...>  Comma-separated section split points (e.g., 0:00,0:25,0:50)
#   --config <path>       Track config JSON with groups and timestamps
#   --events <n>          Events per section for manifest (default: 8)
#   --name <name>         Track name for manifest
#
# Output:
#   <output-dir>/manifest.json
#   <output-dir>/sections/00-section-0/part-0.wav  (group 1)
#   <output-dir>/sections/00-section-0/part-1.wav  (group 2)
#   ...
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Parse arguments ---
INPUT=""
OUTPUT_DIR=""
SOUNDFONT=""
TIMESTAMPS=""
CONFIG_FILE=""
EVENTS_PER_SECTION=8
TRACK_NAME=""

while [ $# -gt 0 ]; do
  case "$1" in
    --soundfont) SOUNDFONT="$2"; shift 2 ;;
    --timestamps) TIMESTAMPS="$2"; shift 2 ;;
    --config) CONFIG_FILE="$2"; shift 2 ;;
    --events) EVENTS_PER_SECTION="$2"; shift 2 ;;
    --name) TRACK_NAME="$2"; shift 2 ;;
    *)
      if [ -z "$INPUT" ]; then INPUT="$1"
      elif [ -z "$OUTPUT_DIR" ]; then OUTPUT_DIR="$1"
      fi
      shift ;;
  esac
done

if [ -z "$INPUT" ] || [ -z "$OUTPUT_DIR" ]; then
  echo "Usage: render-midi-tracks.sh <input.mid> <output-dir> [options]"
  exit 1
fi

# Resolve soundfont
if [ -z "$SOUNDFONT" ]; then
  SOUNDFONT=$("$SCRIPT_DIR/find-soundfont.sh")
fi

if [ ! -f "$SOUNDFONT" ]; then
  echo "Error: Soundfont not found: $SOUNDFONT"
  exit 1
fi

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

# --- Step 1: Split MIDI into tracks ---
echo "   [1/4] Splitting MIDI tracks..."
node "$SCRIPT_DIR/midi-split.js" "$INPUT" "$TEMP_DIR/tracks"

TRACK_INFO="$TEMP_DIR/tracks/track-info.json"
NUM_TRACKS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TRACK_INFO','utf-8')).numTracks)")

# --- Step 2: Render each track with fluidsynth ---
echo "   [2/4] Rendering tracks with fluidsynth..."
mkdir -p "$TEMP_DIR/rendered"

for i in $(seq 1 $((NUM_TRACKS - 1))); do
  TRACK_FILE="$TEMP_DIR/tracks/track-$(printf '%02d' "$i").mid"
  NOTE_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TRACK_INFO','utf-8')).tracks[$i].noteCount)")

  if [ "$NOTE_COUNT" = "0" ]; then
    echo "     Track $i: skipped (no notes)"
    continue
  fi

  RENDERED="$TEMP_DIR/rendered/track-$(printf '%02d' "$i").wav"
  fluidsynth -F "$RENDERED" -r 44100 -ni "$SOUNDFONT" "$TRACK_FILE" 2>/dev/null

  TRACK_NAME_I=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TRACK_INFO','utf-8')).tracks[$i].name)")
  echo "     Track $i: $TRACK_NAME_I → rendered"
done

# --- Step 3: Group tracks and mix ---
echo "   [3/4] Grouping and mixing instrument parts..."

# Read grouping from config or use auto-grouping from track-info
if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
  # Use config file groups
  GROUPS_JSON=$(node -e "
    const config = JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf-8'));
    const info = JSON.parse(require('fs').readFileSync('$TRACK_INFO','utf-8'));
    if (config.timestamps) process.stderr.write('TIMESTAMPS=' + config.timestamps.join(',') + '\n');
    if (config.eventsPerSection) process.stderr.write('EVENTS=' + config.eventsPerSection + '\n');
    if (config.name) process.stderr.write('NAME=' + config.name + '\n');
    const groups = config.groups || [];
    // If no explicit groups, auto-group
    if (groups.length === 0) {
      const groupMap = {};
      for (const t of info.tracks) {
        if (t.noteCount === 0 || t.index === 0) continue;
        const g = t.group === 'other' ? 'strings' : t.group;
        if (!groupMap[g]) groupMap[g] = { label: g.charAt(0).toUpperCase()+g.slice(1), tracks: [], priority: 0, volume: 0.7 };
        groupMap[g].tracks.push(t.index);
      }
      const priorities = { strings: 4, woodwinds: 3, brass: 2, percussion: 1, keys: 3, other: 2 };
      for (const [k,v] of Object.entries(groupMap)) v.priority = priorities[k] || 2;
      console.log(JSON.stringify(Object.values(groupMap)));
    } else {
      console.log(JSON.stringify(groups));
    }
  " 2>"$TEMP_DIR/config-vars")

  # Read config variables
  if [ -f "$TEMP_DIR/config-vars" ]; then
    while IFS= read -r line; do
      case "$line" in
        TIMESTAMPS=*) [ -z "$TIMESTAMPS" ] && TIMESTAMPS="${line#TIMESTAMPS=}" ;;
        EVENTS=*) EVENTS_PER_SECTION="${line#EVENTS=}" ;;
        NAME=*) [ -z "$TRACK_NAME" ] && TRACK_NAME="${line#NAME=}" ;;
      esac
    done < "$TEMP_DIR/config-vars"
  fi
else
  # Auto-group from track-info.json
  GROUPS_JSON=$(node -e "
    const info = JSON.parse(require('fs').readFileSync('$TRACK_INFO','utf-8'));
    const groupMap = {};
    for (const t of info.tracks) {
      if (t.noteCount === 0 || t.index === 0) continue;
      const g = t.group === 'other' ? 'strings' : t.group;
      if (!groupMap[g]) groupMap[g] = { label: g.charAt(0).toUpperCase()+g.slice(1), tracks: [], priority: 0, volume: 0.7 };
      groupMap[g].tracks.push(t.index);
    }
    const priorities = { strings: 4, woodwinds: 3, brass: 2, percussion: 1, keys: 3, other: 2 };
    for (const [k,v] of Object.entries(groupMap)) v.priority = priorities[k] || 2;
    console.log(JSON.stringify(Object.values(groupMap)));
  ")
fi

# Mix tracks within each group
NUM_GROUPS=$(node -e "console.log(JSON.parse('$GROUPS_JSON').length)")
mkdir -p "$TEMP_DIR/groups"

for g in $(seq 0 $((NUM_GROUPS - 1))); do
  GROUP_LABEL=$(node -e "console.log(JSON.parse('$GROUPS_JSON')[$g].label)")
  GROUP_TRACKS=$(node -e "console.log(JSON.parse('$GROUPS_JSON')[$g].tracks.join(' '))")
  GROUP_VOLUME=$(node -e "console.log(JSON.parse('$GROUPS_JSON')[$g].volume || 0.7)")

  # Collect rendered WAVs for this group
  SOX_ARGS=()
  TRACK_COUNT=0
  for t in $GROUP_TRACKS; do
    WAV="$TEMP_DIR/rendered/track-$(printf '%02d' "$t").wav"
    if [ -f "$WAV" ]; then
      SOX_ARGS+=("-v" "$GROUP_VOLUME" "$WAV")
      TRACK_COUNT=$((TRACK_COUNT + 1))
    fi
  done

  if [ $TRACK_COUNT -eq 0 ]; then
    echo "     Group $g ($GROUP_LABEL): skipped (no rendered tracks)"
    continue
  fi

  GROUP_WAV="$TEMP_DIR/groups/group-$(printf '%02d' "$g").wav"
  if [ $TRACK_COUNT -eq 1 ]; then
    sox "${SOX_ARGS[@]}" "$GROUP_WAV"
  else
    sox -m "${SOX_ARGS[@]}" "$GROUP_WAV"
  fi
  echo "     Group $g: $GROUP_LABEL ($TRACK_COUNT tracks mixed)"
done

# --- Step 4: Split into sections ---
echo "   [4/4] Splitting into sections..."

if [ -z "$TIMESTAMPS" ]; then
  # Default: single section covering the whole track
  TIMESTAMPS="0:00"
fi

mkdir -p "$OUTPUT_DIR/sections"

IFS=',' read -ra TIMES <<< "$TIMESTAMPS"
SECTION_NAMES=()

# Read section names from config
if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
  while IFS= read -r name; do
    SECTION_NAMES+=("$name")
  done < <(node -e "
    const c = JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf-8'));
    (c.sectionNames||[]).forEach(n=>console.log(n));
  ")
fi

for i in "${!TIMES[@]}"; do
  START="${TIMES[$i]}"
  NEXT_IDX=$((i + 1))
  SECTION_ID="$(printf '%02d' "$i")-section-$i"
  SECTION_DIR="$OUTPUT_DIR/sections/$SECTION_ID"
  mkdir -p "$SECTION_DIR"

  PART_IDX=0
  for g in $(seq 0 $((NUM_GROUPS - 1))); do
    GROUP_WAV="$TEMP_DIR/groups/group-$(printf '%02d' "$g").wav"
    [ -f "$GROUP_WAV" ] || continue

    PART_WAV="$SECTION_DIR/part-$PART_IDX.wav"
    if [ $NEXT_IDX -lt ${#TIMES[@]} ]; then
      NEXT="${TIMES[$NEXT_IDX]}"
      ffmpeg -y -i "$GROUP_WAV" -ss "$START" -to "$NEXT" "$PART_WAV" 2>/dev/null
    else
      ffmpeg -y -i "$GROUP_WAV" -ss "$START" "$PART_WAV" 2>/dev/null
    fi
    PART_IDX=$((PART_IDX + 1))
  done
done

# --- Generate manifest.json ---
[ -z "$TRACK_NAME" ] && TRACK_NAME=$(basename "$INPUT" .mid)

node -e "
const fs = require('fs');
const path = require('path');

const groups = JSON.parse('$GROUPS_JSON');
const times = '$TIMESTAMPS'.split(',');
const sectionNames = JSON.parse('$(node -e "
  const names = [];
  if ('$CONFIG_FILE' && fs.existsSync('$CONFIG_FILE')) {
    const c = JSON.parse(fs.readFileSync('$CONFIG_FILE','utf-8'));
    if (c.sectionNames) names.push(...c.sectionNames);
  }
  console.log(JSON.stringify(names));
" 2>/dev/null || echo "[]")');

// Count actual groups with rendered WAVs
const activeGroups = groups.filter((_, i) => {
  return fs.existsSync(path.join('$TEMP_DIR', 'groups', 'group-' + String(i).padStart(2,'0') + '.wav'));
});

const sections = times.map((_, i) => {
  const sectionId = String(i).padStart(2,'0') + '-section-' + i;
  const isLast = i === times.length - 1;

  let partIdx = 0;
  const parts = [];
  for (let g = 0; g < groups.length; g++) {
    const groupWav = path.join('$TEMP_DIR', 'groups', 'group-' + String(g).padStart(2,'0') + '.wav');
    if (!fs.existsSync(groupWav)) continue;
    parts.push({
      file: 'sections/' + sectionId + '/part-' + partIdx + '.wav',
      label: groups[g].label,
      volume: groups[g].volume || 0.7,
      priority: groups[g].priority || 2,
    });
    partIdx++;
  }

  return {
    id: sectionId,
    name: sectionNames[i] || 'Section ' + (i + 1),
    loop: isLast,
    parts,
  };
});

const manifest = {
  name: '$TRACK_NAME',
  eventsPerSection: $EVENTS_PER_SECTION,
  maxParts: activeGroups.length,
  sections,
  idle: { strategy: 'sustain', fadeMs: 2000 },
};

fs.writeFileSync('$OUTPUT_DIR/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('   Manifest written: ' + sections.length + ' sections, ' + activeGroups.length + ' parts');
"

echo ""
echo "   ✅ Track rendered from MIDI!"
echo "   Output: $OUTPUT_DIR"
