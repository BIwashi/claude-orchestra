---
name: orchestra
description: Control Claude Orchestra — background music that reacts to your coding. Use when the user mentions orchestra, music, bgm, or wants to start/stop/change the coding soundtrack.
---

# Claude Orchestra

You are helping the user control Claude Orchestra, a plugin that turns Claude Code sessions into live background music. Each session becomes an instrument, and tool calls drive the music.

## Quick Reference

| User says                              | What to do                       |
| -------------------------------------- | -------------------------------- |
| "start music" / "orchestra" / "bgm on" | Show status, confirm, then start |
| "stop music" / "quiet" / "bgm off"     | Stop the conductor               |
| "change track" / "play X"              | Switch track                     |
| "louder" / "quieter" / "volume X"      | Adjust volume                    |
| "what's playing" / "status"            | Show status                      |
| "switch to synth/mixer"                | Change mode                      |

## Setup (default action)

**IMPORTANT: Always confirm with the user before starting audio playback.**

When the user asks about the orchestra or music, first check the current state:

```bash
npx claude-orchestra status 2>&1
```

Then explain what will happen and ask for confirmation:

> "Orchestra を起動します。バックグラウンドで音楽が流れ始めますが、よろしいですか？
>
> - 🎵 トラック: [current or default track]
> - 🔊 ボリューム: [current volume]%
> - 🎛️ モード: [mixer/synth]
>
> 起動しますか？（トラックやボリュームの変更も可能です）"

**Only after the user confirms**, run setup:

```bash
npx claude-orchestra setup
```

This single command:

- Checks all prerequisites (ffmpeg, sox, ffplay, fluidsynth)
- Generates a demo track if none exist (MIDI → fluidsynth → demucs → sections)
- Configures the best available mode (mixer if possible, falls back to synth)
- Starts the conductor daemon

**If `setup` is not available** (older version), do it manually:

```bash
# Check deps
command -v ffmpeg && command -v sox && command -v ffplay && echo "All good"

# Configure and start
npx claude-orchestra config set mode mixer
npx claude-orchestra start --daemon
```

If mixer deps are missing, fall back to synth mode (works out of the box, no external audio files needed):

```bash
npx claude-orchestra config set mode synth
npx claude-orchestra start --daemon
```

## Status

```bash
npx claude-orchestra status
```

## Stop

```bash
npx claude-orchestra stop
```

## Volume Control

Change volume while music is playing (no restart needed):

```bash
npx claude-orchestra volume 0.5    # 50% volume
npx claude-orchestra volume 0.2    # Quiet background
npx claude-orchestra volume 0.8    # Louder
```

If the `volume` command is not available:

```bash
npx claude-orchestra config set volume 0.3
npx claude-orchestra stop && npx claude-orchestra start --daemon
```

## Track Switching

List available tracks:

```bash
npx claude-orchestra track list
```

### Bundled Tracks

When the user asks for a specific track, match their request to the track name:

| User says                                               | Track name           | Composer         |
| ------------------------------------------------------- | -------------------- | ---------------- |
| "ode to joy" / "beethoven" / "9th symphony"             | `ode-to-joy`         | Beethoven (1824) |
| "new world" / "dvorak" / "新世界"                       | `new-world`          | Dvořák (1893)    |
| "morning mood" / "peer gynt" / "grieg" / "朝"           | `morning-mood`       | Grieg (1875)     |
| "polovtsian" / "borodin" / "prince igor" / "ダッタン人" | `polovtsian-dances`  | Borodin (1890)   |
| "can-can" / "orpheus" / "offenbach" / "天国と地獄"      | `orpheus-underworld` | Offenbach (1858) |

Switch to a track:

```bash
npx claude-orchestra track use <name>
npx claude-orchestra stop && npx claude-orchestra start --daemon
```

**Tip:** Morning Mood is great for calm coding sessions. New World and Polovtsian Dances are energetic. Orpheus (Can-Can) is fun and chaotic.

## Mode Switching

- **mixer** (recommended): Pre-mixed stems with perfect sync. Needs sox + ffplay + a track.
- **synth**: Generates tones in real-time. No track or extra deps needed. Good fallback.

```bash
npx claude-orchestra config set mode mixer   # or synth
npx claude-orchestra stop && npx claude-orchestra start --daemon
```

## Preparing Custom Tracks

If the user wants to use their own music:

```bash
# From an audio file (needs demucs for stem separation):
./bin/prepare-track.sh source.mp3 --name my-track --timestamps 0:00,1:00,2:00,3:00

# Then switch to it:
npx claude-orchestra track use my-track
npx claude-orchestra config set mode mixer
npx claude-orchestra stop && npx claude-orchestra start --daemon
```

## Troubleshooting

| Problem            | Solution                                                           |
| ------------------ | ------------------------------------------------------------------ |
| No sound           | Check `npx claude-orchestra status` — is it running?               |
| "sox not found"    | `brew install sox`                                                 |
| "ffplay not found" | `brew install ffmpeg`                                              |
| Sync issues        | Switch to mixer mode: `npx claude-orchestra config set mode mixer` |
| Too loud/quiet     | `npx claude-orchestra volume 0.3`                                  |

## Important Notes

- The conductor auto-starts via hooks when a Claude Code session begins
- It auto-stops when the last session ends
- Music only plays when Claude Code sessions are actively using tools
- Multiple sessions = more instruments playing simultaneously
- The plugin is lightweight: hooks execute in <5ms and don't affect Claude Code performance
