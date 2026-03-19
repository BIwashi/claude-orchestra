# 🎵 Claude Orchestra

Turn multiple Claude Code sessions into a live orchestra. Each session gets assigned an instrument, and every tool call becomes a musical note.

## How It Works

```
Claude Code Session A (Piano 🎹)  ──┐
Claude Code Session B (Cello 🎻)  ──┤── Hook Events ──→ Conductor ──→ Audio Output
Claude Code Session C (Flute 🎶)  ──┘
```

- **Session join** → ascending arpeggio (welcome!)
- **Tool use** → note mapped to the tool type (Read=tonic, Bash=dominant, Edit=mediant…)
- **Error** → chromatic passing tone
- **Idle** → ambient chord progression
- **Session leave** → descending arpeggio (farewell)

## Modes

### Synth Mode (default)

Generates tones via ffmpeg using harmonic synthesis. Each instrument has a unique timbre defined by its harmonic series. Zero external audio files needed.

### Sample Mode

Plays pre-recorded audio organized into sections and parts:

- **Session count = simultaneous parts** (1 session = strings only, 3 sessions = strings + woodwinds + brass)
- **Tool events advance the playhead** through sections
- **Idle = fermata** — the current section sustains or loops

## Quick Start

### Prerequisites

- macOS (uses `afplay` for audio playback)
- Node.js ≥ 20
- ffmpeg (`brew install ffmpeg`)

### Install

```bash
# Clone
ghq get github.com/BIwashi/claude-orchestra

# Install hooks into Claude Code settings
./bin/install.sh

# Start the conductor
node bin/conductor.js start
```

Or use the `/orchestra` skill if you have the repo cloned:

```
/orchestra setup
```

### Using a Sample Track

```bash
# List available tracks
node bin/conductor.js track list

# Switch to a track
node bin/conductor.js track use beethoven-9th

# Switch back to synth
node bin/conductor.js config set mode synth
```

## CLI Reference

```
claude-orchestra start [--daemon]    Start the conductor
claude-orchestra stop                Stop the conductor
claude-orchestra status              Show active sessions and config

claude-orchestra track list          List available tracks
claude-orchestra track use <name>    Switch to a sample track
claude-orchestra track add <dir>     Register a track directory (symlink)

claude-orchestra config show         Show current config
claude-orchestra config set <k> <v>  Update a config value
```

## Creating Custom Tracks

### Directory Structure

```
~/.claude-orchestra/tracks/my-track/
  manifest.json
  sections/
    00-intro/
      part-0.wav   (strings)
      part-1.wav   (woodwinds)
      part-2.wav   (brass)
    01-theme/
      part-0.wav
      ...
```

### manifest.json

```json
{
  "name": "My Track",
  "eventsPerSection": 8,
  "maxParts": 4,
  "sections": [
    {
      "id": "00-intro",
      "name": "Introduction",
      "loop": true,
      "parts": [
        { "file": "sections/00-intro/part-0.wav", "label": "Strings", "volume": 0.7 },
        { "file": "sections/00-intro/part-1.wav", "label": "Woodwinds", "volume": 0.5 }
      ]
    }
  ],
  "idle": { "strategy": "sustain", "fadeMs": 2000 }
}
```

### Slice Helper

Split a single audio file into sections with ffmpeg:

```bash
./bin/slice-track.sh input.mp3 \
  --timestamps 0:00,1:30,3:00,4:30 \
  --output ~/.claude-orchestra/tracks/my-track/
```

See [`data/tracks/demo/`](data/tracks/demo/) for a template.

## `/orchestra` Skill

If the project is cloned locally, you can use the Claude Code skill:

| Command | Description |
|---|---|
| `/orchestra` | Install hooks and start the conductor |
| `/orchestra status` | Show orchestra status |
| `/orchestra stop` | Stop the conductor |
| `/orchestra track <name>` | Switch to a sample track |
| `/orchestra synth` | Switch back to synth mode |

## Config

Stored at `~/.claude-orchestra/config.json`:

```json
{
  "mode": "synth",
  "track": null,
  "volume": 0.5
}
```

## Architecture

```
bin/
  conductor.js      CLI + event loop (the "conductor")
  hook-musician.sh  Ultra-light hook (<5ms) — drops event JSON for the conductor
  install.sh        Registers hooks in Claude Code settings
  uninstall.sh      Removes hooks
  slice-track.sh    ffmpeg helper for splitting audio into sections

lib/
  engine.js         Factory: createEngine(config) → SynthEngine | SampleEngine
  synth-engine.js   Harmonic synthesis via ffmpeg-generated WAV files
  sample-engine.js  Pre-recorded audio playback with section/part management
  audio-player.js   Per-instrument voice channels with rate limiting (afplay)
  music-theory.js   Scales, progressions, tool→note mappings
  activity-mapper.js Tool events → musical parameters (note, volume, duration)
  event-watcher.js  Filesystem watcher for event JSON files
  registry.js       Session → instrument assignment with persistence
  tone-cache.js     ffmpeg tone generation and caching

data/
  instruments.json  Instrument definitions (harmonics, attack, decay)
  tracks/demo/      Template track with manifest format docs
```

## License

MIT
