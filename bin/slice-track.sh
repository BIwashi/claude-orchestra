#!/bin/bash
# Slice an audio file into sections for Claude Orchestra tracks.
# Usage: ./bin/slice-track.sh input.mp3 --timestamps 0:00,1:30,3:00 --output ~/.claude-orchestra/tracks/my-track/
set -euo pipefail

usage() {
  echo "Usage: $0 <input-file> --timestamps <t1,t2,...> --output <dir>"
  echo ""
  echo "Splits an audio file at the given timestamps into section directories."
  echo ""
  echo "Options:"
  echo "  --timestamps  Comma-separated timestamps (e.g., 0:00,1:30,3:00,4:30)"
  echo "  --output      Output directory (will create sections/ subdirectory)"
  echo ""
  echo "Example:"
  echo "  $0 symphony.mp3 --timestamps 0:00,1:30,3:00 --output ~/.claude-orchestra/tracks/my-track/"
  exit 1
}

# Parse args
INPUT=""
TIMESTAMPS=""
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --timestamps)
      TIMESTAMPS="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    --help|-h)
      usage
      ;;
    *)
      if [ -z "$INPUT" ]; then
        INPUT="$1"
      else
        echo "Unknown argument: $1"
        usage
      fi
      shift
      ;;
  esac
done

if [ -z "$INPUT" ] || [ -z "$TIMESTAMPS" ] || [ -z "$OUTPUT" ]; then
  usage
fi

if ! command -v ffmpeg &>/dev/null; then
  echo "Error: ffmpeg is required but not found."
  exit 1
fi

if [ ! -f "$INPUT" ]; then
  echo "Error: Input file not found: $INPUT"
  exit 1
fi

# Parse timestamps into array
IFS=',' read -ra TS_ARRAY <<< "$TIMESTAMPS"

SECTIONS_DIR="$OUTPUT/sections"
mkdir -p "$SECTIONS_DIR"

echo "🎵 Slicing $(basename "$INPUT") into ${#TS_ARRAY[@]} sections..."

for i in "${!TS_ARRAY[@]}"; do
  START="${TS_ARRAY[$i]}"
  SECTION_NAME=$(printf "%02d-section-%d" "$i" "$i")
  SECTION_DIR="$SECTIONS_DIR/$SECTION_NAME"
  mkdir -p "$SECTION_DIR"

  OUT_FILE="$SECTION_DIR/part-0.wav"

  if [ $((i + 1)) -lt ${#TS_ARRAY[@]} ]; then
    END="${TS_ARRAY[$((i + 1))]}"
    echo "  Section $i: $START → $END → $SECTION_NAME"
    ffmpeg -y -hide_banner -loglevel error \
      -i "$INPUT" -ss "$START" -to "$END" \
      -ac 1 -ar 44100 "$OUT_FILE"
  else
    echo "  Section $i: $START → end → $SECTION_NAME"
    ffmpeg -y -hide_banner -loglevel error \
      -i "$INPUT" -ss "$START" \
      -ac 1 -ar 44100 "$OUT_FILE"
  fi
done

# Generate a basic manifest
MANIFEST="$OUTPUT/manifest.json"
if [ ! -f "$MANIFEST" ]; then
  echo "  Generating manifest.json..."
  node -e "
const sections = [];
for (let i = 0; i < ${#TS_ARRAY[@]}; i++) {
  const id = String(i).padStart(2, '0') + '-section-' + i;
  sections.push({
    id,
    name: 'Section ' + i,
    loop: i === ${#TS_ARRAY[@]} - 1,
    parts: [
      { file: 'sections/' + id + '/part-0.wav', label: 'Main', volume: 0.7 }
    ]
  });
}
const manifest = {
  name: '$(basename "${INPUT%.*}")',
  eventsPerSection: 8,
  maxParts: 4,
  sections,
  idle: { strategy: 'sustain', fadeMs: 2000 }
};
console.log(JSON.stringify(manifest, null, 2));
" > "$MANIFEST"
fi

echo ""
echo "  Output: $OUTPUT"
echo "  Sections: ${#TS_ARRAY[@]}"
echo "  Manifest: $MANIFEST"
echo ""
echo "  Next steps:"
echo "    1. Review and edit manifest.json"
echo "    2. Optionally split each section into separate instrument parts"
echo "    3. Run: claude-orchestra track add $OUTPUT"
echo ""
