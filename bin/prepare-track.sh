#!/bin/bash
# Prepare an audio file as a Claude Orchestra track.
# Uses demucs for stem separation and ffmpeg for section splitting.
#
# Usage:
#   ./bin/prepare-track.sh <input-file> [options]
#
# Options:
#   --name <name>         Track name (default: input filename without extension)
#   --output <dir>        Output directory (default: ~/.claude-orchestra/tracks/<name>/)
#   --timestamps <t,...>  Comma-separated timestamps for section splits (e.g., 0:00,1:30,3:00)
#   --events <n>          Events per section (default: 8)
#   --model <model>       Demucs model (default: htdemucs)
#   --skip-demucs         Skip stem separation (use input as single part)
#   --help                Show this help
#
# Prerequisites:
#   - ffmpeg (brew install ffmpeg)
#   - demucs via uv (recommended) or pip install demucs — optional, skipped with --skip-demucs
#
# Output:
#   Creates a track directory with manifest.json and sections/ containing
#   separated stems per section.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Defaults ---
INPUT=""
TRACK_NAME=""
OUTPUT_DIR=""
TIMESTAMPS=""
EVENTS_PER_SECTION=8
DEMUCS_MODEL="htdemucs"
SKIP_DEMUCS=false

# --- Parse args ---
usage() {
  head -23 "$0" | tail -22 | sed 's/^# \?//'
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)       TRACK_NAME="$2"; shift 2 ;;
    --output)     OUTPUT_DIR="$2"; shift 2 ;;
    --timestamps) TIMESTAMPS="$2"; shift 2 ;;
    --events)     EVENTS_PER_SECTION="$2"; shift 2 ;;
    --model)      DEMUCS_MODEL="$2"; shift 2 ;;
    --skip-demucs) SKIP_DEMUCS=true; shift ;;
    --help|-h)    usage ;;
    *)
      if [ -z "$INPUT" ]; then
        INPUT="$1"
      else
        echo "Unknown argument: $1"; usage
      fi
      shift ;;
  esac
done

if [ -z "$INPUT" ]; then
  echo "Error: input file required"
  usage
fi

if [ ! -f "$INPUT" ]; then
  echo "Error: file not found: $INPUT"
  exit 1
fi

# --- Prerequisites ---
if ! command -v ffmpeg &>/dev/null; then
  echo "Error: ffmpeg is required (brew install ffmpeg)"
  exit 1
fi

# Resolve demucs command (direct > uvx > uv tool run)
DEMUCS_CMD=""
if [ "$SKIP_DEMUCS" = false ]; then
  if command -v demucs &>/dev/null; then
    DEMUCS_CMD="demucs"
  elif command -v uvx &>/dev/null; then
    DEMUCS_CMD="uvx --with torchcodec demucs"
  elif command -v uv &>/dev/null; then
    DEMUCS_CMD="uv tool run --with torchcodec demucs"
  else
    echo "Error: demucs or uv is required"
    echo "       Install uv (recommended): curl -LsSf https://astral.sh/uv/install.sh | sh"
    echo "       Or: pip install demucs"
    echo "       Or use --skip-demucs to skip stem separation"
    exit 1
  fi
fi

# --- Resolve names and paths ---
INPUT_BASENAME="$(basename "$INPUT")"
INPUT_NAME="${INPUT_BASENAME%.*}"
TRACK_NAME="${TRACK_NAME:-$INPUT_NAME}"
OUTPUT_DIR="${OUTPUT_DIR:-$HOME/.claude-orchestra/tracks/$TRACK_NAME}"

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

echo "🎵 Preparing track: $TRACK_NAME"
echo "   Input: $INPUT"
echo "   Output: $OUTPUT_DIR"
echo ""

# --- Step 1: Stem separation with demucs ---
STEMS_DIR="$TEMP_DIR/stems"

if [ "$SKIP_DEMUCS" = false ]; then
  echo "   [1/3] Separating stems with demucs ($DEMUCS_MODEL)..."
  $DEMUCS_CMD -n "$DEMUCS_MODEL" -o "$TEMP_DIR/demucs_out" "$INPUT" 2>&1 | tail -3

  # demucs outputs to: <out>/<model>/<track_name>/
  DEMUCS_OUT="$TEMP_DIR/demucs_out/$DEMUCS_MODEL/$INPUT_NAME"
  if [ ! -d "$DEMUCS_OUT" ]; then
    # Try without model subdirectory
    DEMUCS_OUT="$TEMP_DIR/demucs_out/$INPUT_NAME"
  fi

  if [ ! -d "$DEMUCS_OUT" ]; then
    echo "Error: demucs output not found. Expected at:"
    echo "  $TEMP_DIR/demucs_out/$DEMUCS_MODEL/$INPUT_NAME"
    ls -la "$TEMP_DIR/demucs_out/" 2>/dev/null || true
    exit 1
  fi

  mkdir -p "$STEMS_DIR"
  # Copy stems and normalize names
  for stem_file in "$DEMUCS_OUT"/*.wav; do
    stem_name="$(basename "$stem_file" .wav)"
    cp "$stem_file" "$STEMS_DIR/$stem_name.wav"
  done
  echo "   Stems: $(ls "$STEMS_DIR" | tr '\n' ' ')"
else
  echo "   [1/3] Skipping demucs (using input as single stem)"
  mkdir -p "$STEMS_DIR"
  ffmpeg -y -hide_banner -loglevel error -i "$INPUT" -ac 1 -ar 44100 "$STEMS_DIR/main.wav"
fi

# --- Step 2: Section splitting ---
STEM_FILES=("$STEMS_DIR"/*.wav)
STEM_NAMES=()
for f in "${STEM_FILES[@]}"; do
  STEM_NAMES+=("$(basename "$f" .wav)")
done

echo "   [2/3] Splitting into sections..."

mkdir -p "$OUTPUT_DIR/sections"

if [ -n "$TIMESTAMPS" ]; then
  IFS=',' read -ra TS_ARRAY <<< "$TIMESTAMPS"
else
  # Auto-detect: split into ~30 second sections
  DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$INPUT" 2>/dev/null | cut -d. -f1)
  DURATION=${DURATION:-120}
  SECTION_LENGTH=30
  TS_ARRAY=()
  for ((t=0; t<DURATION; t+=SECTION_LENGTH)); do
    minutes=$((t / 60))
    seconds=$((t % 60))
    TS_ARRAY+=("$(printf '%d:%02d' $minutes $seconds)")
  done
  echo "   Auto-split: ${#TS_ARRAY[@]} sections (${SECTION_LENGTH}s each)"
fi

for i in "${!TS_ARRAY[@]}"; do
  START="${TS_ARRAY[$i]}"
  SECTION_ID=$(printf "%02d-section-%d" "$i" "$i")
  SECTION_DIR="$OUTPUT_DIR/sections/$SECTION_ID"
  mkdir -p "$SECTION_DIR"

  for j in "${!STEM_NAMES[@]}"; do
    STEM_WAV="${STEM_FILES[$j]}"
    OUT_FILE="$SECTION_DIR/part-${j}.wav"

    if [ $((i + 1)) -lt ${#TS_ARRAY[@]} ]; then
      END="${TS_ARRAY[$((i + 1))]}"
      ffmpeg -y -hide_banner -loglevel error \
        -i "$STEM_WAV" -ss "$START" -to "$END" \
        -ac 1 -ar 44100 "$OUT_FILE"
    else
      ffmpeg -y -hide_banner -loglevel error \
        -i "$STEM_WAV" -ss "$START" \
        -ac 1 -ar 44100 "$OUT_FILE"
    fi
  done
done

echo "   Sections: ${#TS_ARRAY[@]}"

# --- Step 3: Generate manifest ---
echo "   [3/3] Generating manifest.json..."

# Build stem names as JSON array (no jq dependency)
STEM_NAMES_JSON="["
for i in "${!STEM_NAMES[@]}"; do
  [ "$i" -gt 0 ] && STEM_NAMES_JSON+=","
  STEM_NAMES_JSON+="\"${STEM_NAMES[$i]}\""
done
STEM_NAMES_JSON+="]"

node -e "
const stemLabels = {
  drums: 'Percussion', bass: 'Bass', vocals: 'Vocals',
  other: 'Ensemble', guitar: 'Guitar', piano: 'Piano', main: 'Main',
};
const stemVolumes = {
  drums: 0.5, bass: 0.6, vocals: 0.4,
  other: 0.7, guitar: 0.6, piano: 0.6, main: 0.7,
};

const sections = [];
const stemNames = ${STEM_NAMES_JSON};

for (let i = 0; i < ${#TS_ARRAY[@]}; i++) {
  const id = String(i).padStart(2, '0') + '-section-' + i;
  const parts = stemNames.map((name, j) => ({
    file: 'sections/' + id + '/part-' + j + '.wav',
    label: stemLabels[name] || name,
    volume: stemVolumes[name] || 0.6,
  }));
  sections.push({
    id,
    name: 'Section ' + i,
    loop: i === ${#TS_ARRAY[@]} - 1,
    parts,
  });
}

const manifest = {
  name: '$TRACK_NAME',
  eventsPerSection: $EVENTS_PER_SECTION,
  maxParts: stemNames.length,
  sections,
  idle: { strategy: 'sustain', fadeMs: 2000 },
};

console.log(JSON.stringify(manifest, null, 2));
" > "$OUTPUT_DIR/manifest.json"

echo ""
echo "   ✅ Track ready: $OUTPUT_DIR"
echo "   Sections: ${#TS_ARRAY[@]}"
echo "   Parts per section: ${#STEM_NAMES[@]} (${STEM_NAMES[*]})"
echo ""
echo "   To use:"
echo "     claude-orchestra track use $TRACK_NAME"
echo ""
