---
name: orchestra
description: Control Claude Orchestra — background music that reacts to your coding. Use when the user mentions orchestra, music, bgm, or wants to start/stop/change the coding soundtrack.
---

# Claude Orchestra

You are helping the user control Claude Orchestra, a plugin that turns Claude Code sessions into live background music. Each session becomes an instrument, and tool calls drive the music.

## Quick Reference

| User says                              | What to do                               |
| -------------------------------------- | ---------------------------------------- |
| "start music" / "orchestra" / "bgm on" | Run **Start with Dependency Check** flow |
| "stop music" / "quiet" / "bgm off"     | Stop the conductor                       |
| "change track" / "play X"              | Switch track                             |
| "louder" / "quieter" / "volume X"      | Adjust volume                            |
| "what's playing" / "status"            | Show status                              |
| "switch to synth/mixer"                | Change mode                              |

## Start with Dependency Check

**Always run this flow when starting the orchestra.** It checks dependencies, reports what's missing, and asks the user before installing anything.

### Step 1: Check current status and dependencies

```bash
npx claude-orchestra status 2>&1
```

```bash
# Check all dependencies for mixer mode
echo "=== Dependency Check ==="
for cmd in ffmpeg ffplay sox; do
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "✓ $cmd: $(command -v $cmd)"
  else
    echo "✗ $cmd: NOT FOUND"
  fi
done
# Check if any tracks are prepared
TRACK_COUNT=$(ls ~/.claude-orchestra/tracks/*/manifest.json 2>/dev/null | wc -l | tr -d ' ')
echo "=== Prepared Tracks: $TRACK_COUNT ==="
```

### Step 2: Report findings and propose a plan

Based on the dependency check results, **tell the user what you found and what you plan to do**, then ask for confirmation before proceeding.

**Example messages:**

- All deps present + tracks prepared:

  > "Dependencies are all installed and tracks are ready. Starting the orchestra in mixer mode."

- Missing `sox`:

  > "sox が見つかりません。mixer モードでの音声ミキシングに必要です。`brew install sox` でインストールしてよいですか？ (synth モードなら sox なしでも動きます)"

- Missing `ffmpeg` (or `ffplay`):

  > "ffmpeg が見つかりません。音声再生に必要です。`brew install ffmpeg` でインストールしてよいですか？"

- No tracks prepared:

  > "トラックがまだ準備されていません。synth モード (電子音) で開始するか、セットアップスキル (/claude-orchestra:setup) でトラックを準備できます。どちらにしますか？"

- All deps missing:
  > "以下の依存関係が不足しています:\n- ffmpeg (音声再生)\n- sox (音声ミキシング)\n\n`brew install ffmpeg sox` でまとめてインストールしてよいですか？ または synth モード (依存なし) で開始することもできます。"

**Rules:**

- **Never install anything without asking the user first**
- Always explain what each dependency is for
- Always offer synth mode as a zero-dependency alternative
- On Linux, suggest `apt install` instead of `brew install`

### Step 3: Install missing dependencies (after user approval)

macOS:

```bash
brew install ffmpeg sox  # only the missing ones
```

Linux:

```bash
sudo apt install -y ffmpeg sox  # only the missing ones
```

### Step 4: Configure and start

If mixer deps are all present and tracks are prepared:

```bash
npx claude-orchestra config set mode mixer
npx claude-orchestra stop 2>/dev/null; npx claude-orchestra start --daemon
```

If using synth mode (no track or deps missing):

```bash
npx claude-orchestra config set mode synth
npx claude-orchestra stop 2>/dev/null; npx claude-orchestra start --daemon
```

### Step 5: Verify

```bash
npx claude-orchestra status
```

Confirm to the user that music is playing and which mode/track is active.

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
