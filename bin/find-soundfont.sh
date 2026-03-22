#!/bin/bash
# Find or download a General MIDI soundfont for fluidsynth rendering.
#
# Search order:
#   1. $SOUNDFONT environment variable
#   2. Common system paths (macOS Homebrew, Linux)
#   3. ~/.claude-orchestra/soundfonts/ cache
#   4. Download FluidR3_GM from GitHub (fallback)
#
# Outputs the path to the soundfont on stdout.
# Exit 1 if no soundfont can be found or downloaded.
set -euo pipefail

CACHE_DIR="${HOME}/.claude-orchestra/soundfonts"
CACHED_SF="${CACHE_DIR}/FluidR3_GM.sf2"

# 1. Environment variable
if [ -n "${SOUNDFONT:-}" ] && [ -f "$SOUNDFONT" ]; then
  echo "$SOUNDFONT"
  exit 0
fi

# 2. Common system paths
SEARCH_PATHS=(
  # macOS Homebrew
  /opt/homebrew/share/soundfonts
  /opt/homebrew/Cellar/fluid-synth/*/share/soundfonts
  /usr/local/share/soundfonts
  /usr/local/share/fluidsynth
  # Linux
  /usr/share/sounds/sf2
  /usr/share/soundfonts
  /usr/share/sounds/sf3
)

for dir in "${SEARCH_PATHS[@]}"; do
  # Glob expansion
  for sf in "$dir"/*.sf2 "$dir"/*.sf3; do
    if [ -f "$sf" ]; then
      echo "$sf"
      exit 0
    fi
  done
done

# 3. Cached soundfont
if [ -f "$CACHED_SF" ]; then
  echo "$CACHED_SF"
  exit 0
fi

# Also check for .sf3 variant
if [ -f "${CACHE_DIR}/FluidR3_GM.sf3" ]; then
  echo "${CACHE_DIR}/FluidR3_GM.sf3"
  exit 0
fi

# 4. Download
if ! command -v curl &>/dev/null && ! command -v wget &>/dev/null; then
  echo "Error: No soundfont found and no curl/wget to download one." >&2
  echo "Install a soundfont or set the SOUNDFONT environment variable." >&2
  exit 1
fi

mkdir -p "$CACHE_DIR"

# Try multiple sources in order
SF_SOURCES=(
  # MuseScore's FluidR3Mono (sf3, ~15MB)
  "https://raw.githubusercontent.com/musescore/MuseScore/master/share/sound/FluidR3Mono_GM.sf3|${CACHE_DIR}/FluidR3Mono_GM.sf3"
  # Debian/Ubuntu fluid-soundfont-gm mirror
  "https://github.com/FluidSynth/fluidsynth/wiki/SoundFont|"
)

for entry in "${SF_SOURCES[@]}"; do
  IFS='|' read -r url dest <<< "$entry"
  [ -z "$dest" ] && continue

  echo "Downloading soundfont from $(basename "$dest")..." >&2
  if command -v curl &>/dev/null; then
    curl -fSL --progress-bar -o "$dest" "$url" >&2 2>/dev/null && {
      echo "$dest"
      exit 0
    }
  elif command -v wget &>/dev/null; then
    wget -q --show-progress -O "$dest" "$url" >&2 2>/dev/null && {
      echo "$dest"
      exit 0
    }
  fi
  rm -f "$dest" 2>/dev/null
done

if command -v curl &>/dev/null; then
  curl -fSL --progress-bar -o "$CACHED_SF" "$SF_URL" >&2
else
  wget -q --show-progress -O "$CACHED_SF" "$SF_URL" >&2
fi

if [ -f "$CACHED_SF" ]; then
  echo "$CACHED_SF"
  exit 0
fi

echo "Error: Failed to download soundfont." >&2
exit 1
