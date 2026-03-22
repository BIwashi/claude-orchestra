---
description: Set up Claude Orchestra audio tracks — installs dependencies and renders MIDI to instrument parts
---

# Claude Orchestra Setup

This skill guides you through setting up mixer-mode audio tracks using MIDI rendering.

## Quick Setup (Recommended)

The `setup` command handles everything automatically:

```bash
npx claude-orchestra setup
```

This will:

1. Check all prerequisites (ffmpeg, sox, ffplay, fluidsynth)
2. Find or download a GM soundfont
3. Render the default track (Ode to Joy) from bundled MIDI
4. Configure mixer mode and start the conductor

## Manual Setup

### Prerequisites Check

```bash
echo "=== Dependencies ==="
for cmd in ffmpeg ffplay sox fluidsynth; do
  command -v "$cmd" >/dev/null 2>&1 && echo "✓ $cmd" || echo "✗ $cmd"
done
echo "=== Tracks ==="
ls ~/.claude-orchestra/tracks/*/manifest.json 2>/dev/null | wc -l | xargs echo "Prepared:"
```

### Install Dependencies

**Before installing, explain what each tool does and get user confirmation.**

| Tool                | Purpose                                    | Required?                          |
| ------------------- | ------------------------------------------ | ---------------------------------- |
| `ffmpeg` / `ffplay` | Audio playback and generation engine       | **Yes** — core audio player        |
| `sox`               | Real-time multi-stem mixing                | **Yes** — needed for mixer mode    |
| `fluidsynth`        | MIDI-to-WAV synthesizer for bundled tracks | Optional — only for MIDI rendering |

#### macOS (Homebrew)

```bash
brew install ffmpeg sox fluid-synth
```

#### Linux (apt)

```bash
sudo apt install -y ffmpeg sox fluidsynth
```

### Render a Track from MIDI

The plugin bundles MIDI files in `${CLAUDE_PLUGIN_ROOT}/data/tracks/`. To render:

```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
TRACK="ode-to-joy"  # or: new-world, polovtsian-dances

bash "$PLUGIN_ROOT/bin/render-midi-tracks.sh" \
  "$PLUGIN_ROOT/data/tracks/$TRACK/source.mid" \
  "$HOME/.claude-orchestra/tracks/$TRACK" \
  --name "$TRACK" \
  --timestamps "0:00,0:30,1:00,1:30" \
  --events 8
```

This pipeline:

1. Splits the MIDI into individual instrument tracks
2. Renders each track with fluidsynth (perfect instrument separation)
3. Groups instruments (Strings, Woodwinds, Brass, Percussion)
4. Splits into timed sections
5. Generates manifest.json

### Activate the Track

```bash
npx claude-orchestra track use $TRACK
npx claude-orchestra config set mode mixer
npx claude-orchestra stop 2>/dev/null
npx claude-orchestra start --daemon
```

## Available MIDI Tracks

| Track               | Composer  | MIDI Tracks | Format |
| ------------------- | --------- | ----------- | ------ |
| `ode-to-joy`        | Beethoven | 8           | 1      |
| `new-world`         | Dvořák    | 14          | 1      |
| `polovtsian-dances` | Borodin   | 12          | 1      |

Note: `morning-mood` is Format 0 (single track) and cannot be split into parts.

## Soundfont

The render pipeline needs a General MIDI soundfont. It's auto-detected from:

1. `$SOUNDFONT` environment variable
2. Common system paths (Homebrew, Linux package dirs)
3. `~/.claude-orchestra/soundfonts/` cache
4. Auto-download if none found (~15MB)
