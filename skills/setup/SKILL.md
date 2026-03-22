---
description: Set up Claude Orchestra audio tracks — installs dependencies and renders MIDI to stems
---

# Claude Orchestra Setup

This skill guides you through setting up mixer-mode audio tracks.

## Prerequisites Check

First, check what's available:

```bash
which ffplay sox fluidsynth 2>/dev/null
python3 -c "import demucs" 2>/dev/null && echo "demucs: installed" || echo "demucs: not installed"
ls ~/.claude-orchestra/tracks/*/manifest.json 2>/dev/null | wc -l | xargs echo "Tracks prepared:"
```

## Install Dependencies

**Before installing, explain what each tool does and get user confirmation.**

| Tool                | Purpose                                                        | Required?                            |
| ------------------- | -------------------------------------------------------------- | ------------------------------------ |
| `ffmpeg` / `ffplay` | Audio playback and generation engine                           | **Yes** — core audio player          |
| `sox`               | Real-time multi-stem mixing (Sound eXchange)                   | **Yes** — needed for mixer mode      |
| `fluidsynth`        | MIDI-to-WAV synthesizer — converts bundled MIDI files to audio | Optional — only for rendering tracks |
| `demucs`            | AI stem separation — splits audio into bass/drums/vocals/other | Optional — only for rendering tracks |

Ask the user which to install (essential only / all / none), then proceed.

### macOS (Homebrew)

```bash
# Essential (required for mixer mode)
brew install ffmpeg sox

# Optional (for rendering MIDI tracks to stems)
brew install fluid-synth
pip3 install demucs "numpy<2"
```

### Linux (apt)

```bash
sudo apt install -y ffmpeg sox fluidsynth
pip3 install demucs "numpy<2"
```

### Soundfont

Download FluidR3_GM2 if not present:

```bash
SF_PATH="/tmp/FluidR3_GM2-2.sf2"
if [ ! -f "$SF_PATH" ]; then
  curl -L "https://github.com/musescore/MuseScore/raw/master/share/sound/FluidR3Mono_GM.sf3" -o "$SF_PATH"
fi
```

## Prepare a Track

The plugin bundles MIDI files in `${CLAUDE_PLUGIN_ROOT}/data/tracks/`. To prepare a track:

```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
TRACK="orpheus-underworld"  # or: ode-to-joy, new-world, morning-mood, polovtsian-dances
MIDI="$PLUGIN_ROOT/data/tracks/$TRACK/source.mid"

# Render MIDI → WAV
fluidsynth -F /tmp/$TRACK.wav -r 44100 -ni /tmp/FluidR3_GM2-2.sf2 "$MIDI"

# Separate stems
python3 -m demucs -n htdemucs -o /tmp/$TRACK-stems /tmp/$TRACK.wav

# The track's README.md has section timings. Read it:
cat "$PLUGIN_ROOT/data/tracks/$TRACK/README.md"
```

Then create sections using the timings from the README:

```bash
DEST="$HOME/.claude-orchestra/tracks/$TRACK/sections"
STEMS="/tmp/$TRACK-stems/htdemucs/$TRACK"

# Example for orpheus-underworld:
# Section timings vary per track — read the README for exact values
for section_spec in "00-intro:0:20" "01-build:20:25" "02-theme:45:25" "03-dance:70:30" "04-crescendo:100:25" "05-galop:125:35"; do
  IFS=: read -r name start dur <<< "$section_spec"
  mkdir -p "$DEST/$name"
  for stem in bass drums other vocals; do
    ffmpeg -y -i "$STEMS/$stem.wav" -ss "$start" -t "$dur" "$DEST/$name/$stem.wav" 2>/dev/null
  done
done
```

Copy the manifest from the track's README or use the existing one.

## Activate the Track

```bash
npx claude-orchestra track use $TRACK
npx claude-orchestra stop 2>/dev/null
npx claude-orchestra start --daemon
```

## Quick Setup (All Tracks)

To prepare all bundled tracks at once:

```bash
npx claude-orchestra setup
```

This runs the full pipeline for the default track (Can-Can).
