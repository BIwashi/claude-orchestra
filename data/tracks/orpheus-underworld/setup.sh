#!/bin/bash
# Download and prepare "Orpheus in the Underworld" (Can-Can / Galop Infernal)
# by Jacques Offenbach — public domain recording from Musopen.
#
# This script:
#   1. Downloads a public domain orchestral recording
#   2. Runs prepare-track.sh to separate stems and split into sections
#   3. Installs the track into ~/.claude-orchestra/tracks/orpheus-underworld/
#
# Prerequisites:
#   - curl
#   - ffmpeg
#   - demucs (pip install demucs)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
TRACK_NAME="orpheus-underworld"
OUTPUT_DIR="$HOME/.claude-orchestra/tracks/$TRACK_NAME"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

echo "🎵 Setting up: Orpheus in the Underworld (Galop Infernal)"
echo ""

# --- Step 1: Download ---
# Musopen has public domain classical recordings.
# Fallback: use a well-known CC0 source.
# The user can also place their own file here.
SOURCE_FILE="$SCRIPT_DIR/source.mp3"

if [ ! -f "$SOURCE_FILE" ]; then
  echo "   No source audio found at: $SOURCE_FILE"
  echo ""
  echo "   To set up this track, place an MP3/WAV of Offenbach's"
  echo "   'Galop Infernal' (from Orpheus in the Underworld) at:"
  echo ""
  echo "     $SOURCE_FILE"
  echo ""
  echo "   Suggested sources (public domain recordings):"
  echo "     - IMSLP: https://imslp.org/ (search 'Orpheus in the Underworld')"
  echo "     - Musopen: https://musopen.org/"
  echo "     - Internet Archive: https://archive.org/"
  echo ""
  echo "   Then re-run this script."
  exit 1
fi

# --- Step 2: Prepare track ---
# Section timestamps for the Galop Infernal (~2:30 typical performance)
# These are approximate and work with most common recordings
TIMESTAMPS="0:00,0:20,0:40,1:00,1:20,1:40,2:00"

echo "   Source: $SOURCE_FILE"
echo "   Running prepare-track.sh..."
echo ""

"$PROJECT_ROOT/bin/prepare-track.sh" "$SOURCE_FILE" \
  --name "$TRACK_NAME" \
  --output "$OUTPUT_DIR" \
  --timestamps "$TIMESTAMPS" \
  --events 6

# --- Step 3: Customize manifest ---
# Override the auto-generated manifest with orchestra-specific labels
node -e "
const fs = require('fs');
const manifestPath = '$OUTPUT_DIR/manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

manifest.name = \"Offenbach - Galop Infernal (Orpheus in the Underworld)\";

// Rename sections to match the musical structure
const sectionNames = [
  'Introduction',
  'First Theme',
  'Development A',
  'Second Theme',
  'Development B',
  'Recapitulation',
  'Finale',
];

for (let i = 0; i < manifest.sections.length && i < sectionNames.length; i++) {
  manifest.sections[i].name = sectionNames[i];
}

// Last section loops
if (manifest.sections.length > 0) {
  manifest.sections[manifest.sections.length - 1].loop = true;
}

// Relabel stems for orchestral context
const orchestraLabels = {
  'drums': 'Percussion (Timpani & Cymbals)',
  'bass': 'Low Strings (Cello & Bass)',
  'other': 'Orchestral Ensemble',
  'vocals': 'High Winds & Brass',
};

for (const section of manifest.sections) {
  for (const part of section.parts) {
    for (const [stem, label] of Object.entries(orchestraLabels)) {
      if (part.label === stem || part.label.toLowerCase() === stem) {
        part.label = label;
      }
    }
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('   Manifest customized for orchestral labels.');
"

echo ""
echo "   ✅ Track installed!"
echo "   To activate: npx claude-orchestra track use $TRACK_NAME"
echo ""
