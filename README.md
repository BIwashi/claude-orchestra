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

### Mixer Mode (recommended)

Pre-mixes stems with sox and plays the result with ffplay. This mode uses a global clock, so all active parts stay in perfect sync. Use this for the best track-based orchestra experience.

### Synth Mode

Generates tones via ffmpeg using harmonic synthesis. Each instrument has a unique timbre defined by its harmonic series. Zero external audio files needed.

### Sample Mode

Plays pre-recorded stems directly. This is the legacy track mode and can drift out of sync across parts, so prefer mixer mode unless you specifically need the old behavior.

## Quick Start

### Prerequisites

- macOS
- Node.js >= 20
- ffmpeg and ffplay (`brew install ffmpeg`)
- sox (`brew install sox`)

### Install as Claude Code Plugin

```bash
claude plugin install claude-orchestra
```

Then set the recommended mode and start the conductor:

```bash
npx claude-orchestra config set mode mixer
npx claude-orchestra start --daemon
```

Or use the skill inside Claude Code:

```
/claude-orchestra:orchestra setup
```

### Install via npx (no install needed)

```bash
npx claude-orchestra config set mode mixer
npx claude-orchestra start --daemon
```

> **Note**: When using npx without the plugin, you need to manually configure hooks. The plugin install handles this automatically.

### Using the Bundled Demo Track

Claude Orchestra includes a bundled demo track based on Offenbach's **Galop Infernal** from _Orpheus in the Underworld_.

```bash
npx claude-orchestra track list
npx claude-orchestra track use orpheus-underworld
npx claude-orchestra config set mode mixer
```

## Preparing Custom Tracks

Use `./bin/prepare-track.sh` to turn a source file into a Claude Orchestra track.

1. Get an audio source.
   MIDI renderings, DAW exports, YouTube captures, public-domain recordings, and similar sources all work as long as you have a local audio file.
2. Prepare the track.

```bash
./bin/prepare-track.sh source.mp3 --name my-track --timestamps 0:00,1:30,3:00
```

3. Switch to the prepared track in mixer mode.

```bash
npx claude-orchestra track use my-track
npx claude-orchestra config set mode mixer
```

`prepare-track.sh` separates stems with demucs when available, slices the arrangement into sections, and writes a ready-to-use `manifest.json` plus section audio files under `~/.claude-orchestra/tracks/<name>/`.

If you want a reference layout, see [`data/tracks/demo/`](data/tracks/demo/). The bundled `orpheus-underworld` track is a complete example built from Offenbach's _Galop Infernal_.

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

## `/orchestra` Skill

After installing the plugin, the following skill commands are available:

| Command                                         | Description                                          |
| ----------------------------------------------- | ---------------------------------------------------- |
| `/claude-orchestra:orchestra`                   | Check prerequisites, switch to mixer mode, and start |
| `/claude-orchestra:orchestra status`            | Show orchestra status                                |
| `/claude-orchestra:orchestra stop`              | Stop the conductor                                   |
| `/claude-orchestra:orchestra track <name>`      | Switch to a track                                    |
| `/claude-orchestra:orchestra track prepare ...` | Prepare a custom track from source audio             |
| `/claude-orchestra:orchestra mixer`             | Switch to mixer mode                                 |
| `/claude-orchestra:orchestra synth`             | Switch to synth mode                                 |

## Config

Stored at `~/.claude-orchestra/config.json`:

```json
{
  "mode": "mixer",
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
  prepare-track.sh  demucs + ffmpeg helper for building custom tracks
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
