---
name: orchestra
description: Control Claude Orchestra — background music that reacts to your coding. Use when the user mentions orchestra, music, bgm, or wants to start/stop/change the coding soundtrack.
---

# Claude Orchestra

You are helping the user control Claude Orchestra, a plugin that turns Claude Code sessions into live background music. Each session becomes an instrument, and tool calls drive the music.

## Quick Reference

| User says                              | What to do                             |
| -------------------------------------- | -------------------------------------- |
| "start music" / "orchestra" / "bgm on" | Check deps → explain → confirm → start |
| "stop music" / "quiet" / "bgm off"     | Stop the conductor                     |
| "change track" / "play X"              | Switch track                           |
| "louder" / "quieter" / "volume X"      | Adjust volume                          |
| "what's playing" / "status"            | Show status                            |
| "switch to synth/mixer"                | Change mode                            |

## Setup (default action)

When the user wants to start the orchestra, **first check what's already installed**:

```bash
echo "=== Dependency Check ==="
command -v ffmpeg && echo "ffmpeg: ✅" || echo "ffmpeg: ❌"
command -v ffplay && echo "ffplay: ✅" || echo "ffplay: ❌"
command -v sox && echo "sox: ✅" || echo "sox: ❌"
command -v fluidsynth && echo "fluidsynth: ✅" || echo "fluidsynth: ❌"
python3 -c "import demucs" 2>/dev/null && echo "demucs: ✅" || echo "demucs: ❌"
echo "=== Tracks ==="
ls ~/.claude-orchestra/tracks/*/manifest.json 2>/dev/null | wc -l | xargs echo "Prepared tracks:"
```

### If dependencies are missing

**IMPORTANT: Before installing anything, explain what each tool does and why it's needed. Get explicit confirmation.**

Present the dependency list to the user:

> いくつかツールのインストールが必要です:
>
> **必須（音を鳴らすのに最低限必要）:**
> | ツール | 用途 | インストール |
> |--------|------|-------------|
> | `ffmpeg` / `ffplay` | 音声の再生・生成エンジン | `brew install ffmpeg` |
> | `sox` | 複数パートのリアルタイムミックス | `brew install sox` |
>
> **任意（MIDIから音源を生成する場合に必要。なくてもsynthモードで動作可能）:**
> | ツール | 用途 | インストール |
> |--------|------|-------------|
> | `fluidsynth` | MIDIファイル → WAV変換 | `brew install fluid-synth` |
> | `demucs` | AIによるパート分離（ベース/ドラム等） | `pip3 install demucs` |
>
> どうしますか？
>
> 1. **必須のみ** インストール（synth + mixerモード）
> 2. **全部** インストール（MIDI楽曲も使える、フル体験）
> 3. **何もインストールしない**（synthモードのみ、追加ツール不要で動く）

**Only install what the user agrees to:**

```bash
# Option 1: Essential only
brew install ffmpeg sox

# Option 2: Full
brew install ffmpeg sox fluid-synth
pip3 install demucs "numpy<2"

# Option 3: No install needed
npx claude-orchestra config set mode synth
```

### If all dependencies are present

Skip straight to starting:

```bash
npx claude-orchestra setup
```

### After installation

```bash
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
