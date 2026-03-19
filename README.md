# 🎵 Claude Orchestra

[日本語](docs/README.ja.md)

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

### Install as Claude Code Plugin

```bash
claude plugin install claude-orchestra
```

Then start the conductor:

```bash
npx claude-orchestra start --daemon
```

Or use the skill inside Claude Code:

```
/claude-orchestra:orchestra setup
```

### Install via npx (no install needed)

```bash
# Start the conductor directly
npx claude-orchestra start --daemon
```

> **Note**: When using npx without the plugin, you need to manually configure hooks. The plugin install handles this automatically.

### Using a Sample Track

```bash
npx claude-orchestra track list
npx claude-orchestra track use beethoven-9th
npx claude-orchestra config set mode synth   # switch back
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
npx claude-orchestra-slice input.mp3 \
  --timestamps 0:00,1:30,3:00,4:30 \
  --output ~/.claude-orchestra/tracks/my-track/
```

See [`data/tracks/demo/`](data/tracks/demo/) for a template.

## `/orchestra` Skill

After installing the plugin, the following skill commands are available:

| Command | Description |
|---|---|
| `/claude-orchestra:orchestra` | Check prerequisites and start the conductor |
| `/claude-orchestra:orchestra status` | Show orchestra status |
| `/claude-orchestra:orchestra stop` | Stop the conductor |
| `/claude-orchestra:orchestra track <name>` | Switch to a sample track |
| `/claude-orchestra:orchestra synth` | Switch back to synth mode |

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
.claude-plugin/
  plugin.json       Plugin manifest

bin/
  conductor.js      CLI + event loop (the "conductor")
  hook-musician.sh  Ultra-light hook (<5ms) — drops event JSON for the conductor
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

skills/
  orchestra/        /orchestra skill for setup and control

hooks/
  hooks.json        Plugin hook definitions (SessionStart, PostToolUse, SessionEnd)

data/
  instruments.json  Instrument definitions (harmonics, attack, decay)
  tracks/demo/      Template track with manifest format docs
```

## License

MIT
