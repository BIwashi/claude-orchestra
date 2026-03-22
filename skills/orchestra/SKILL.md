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

**Always run this flow when starting the orchestra.**

### Step 1: Check dependencies and status

```bash
npx claude-orchestra status 2>&1
```

```bash
echo "=== Dependency Check ==="
for cmd in ffmpeg ffplay sox fluidsynth; do
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "✓ $cmd: $(command -v $cmd)"
  else
    echo "✗ $cmd: NOT FOUND"
  fi
done
TRACK_COUNT=$(ls ~/.claude-orchestra/tracks/*/manifest.json 2>/dev/null | wc -l | tr -d ' ')
echo "=== Prepared Tracks: $TRACK_COUNT ==="
```

### Step 2: Report findings and propose a plan

Based on the results, **tell the user what you found and ask for confirmation before installing anything.**

**Rules:**

- **Never install anything without asking the user first**
- Always explain what each dependency is for
- Always offer synth mode as a zero-dependency alternative (requires only ffmpeg)
- On Linux, suggest `apt install` instead of `brew install`

**Example messages:**

- All deps present + tracks prepared:

  > "全ての依存関係がインストール済みで、トラックも準備されています。orchestra を起動します。"

- Missing sox/fluidsynth:
  > "以下のインストールが必要です:\n- sox (音声ミキシング)\n- fluidsynth (MIDI レンダリング)\n\n`brew install sox fluid-synth` でインストールしてよいですか？\nまたは synth モード (依存なし) で開始することもできます。"

### Step 3: Install and setup (after user approval)

If all required deps (ffmpeg, sox) are installed, run the automated setup:

```bash
npx claude-orchestra setup
```

This single command:

- Checks all prerequisites
- Acquires a soundfont for MIDI rendering (if fluidsynth is available)
- Renders the default track (Ode to Joy) from bundled MIDI
- Configures the best available mode (mixer if possible, synth fallback)
- Starts the conductor daemon

If deps need installing first:

```bash
# macOS
brew install ffmpeg sox fluid-synth

# Linux
sudo apt install -y ffmpeg sox fluidsynth

# Then run setup
npx claude-orchestra setup
```

### Step 4: Verify

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

**Tip:** Morning Mood is great for calm coding sessions. Ode to Joy is the default and works out of the box with MIDI rendering.

## Mode Switching

- **mixer** (recommended): MIDI-rendered instrument parts with perfect separation. Needs sox + ffplay + fluidsynth.
- **synth**: Generates tones in real-time. No track or extra deps needed. Good fallback.

```bash
npx claude-orchestra config set mode mixer   # or synth
npx claude-orchestra stop && npx claude-orchestra start --daemon
```

## Preparing Custom Tracks

If the user wants to use their own music:

```bash
# From a MIDI file (recommended — perfect instrument separation):
bash ./bin/render-midi-tracks.sh source.mid output-dir --name my-track --timestamps 0:00,1:00,2:00

# From an audio file (needs demucs for stem separation):
./bin/prepare-track.sh source.mp3 --name my-track --timestamps 0:00,1:00,2:00,3:00

# Then switch to it:
npx claude-orchestra track use my-track
npx claude-orchestra config set mode mixer
npx claude-orchestra stop && npx claude-orchestra start --daemon
```

## Troubleshooting

| Problem            | Solution                                             |
| ------------------ | ---------------------------------------------------- |
| No sound           | Check `npx claude-orchestra status` — is it running? |
| "sox not found"    | `brew install sox`                                   |
| "ffplay not found" | `brew install ffmpeg`                                |
| No tracks          | Run `npx claude-orchestra setup` to render from MIDI |
| Too loud/quiet     | `npx claude-orchestra volume 0.3`                    |

## Important Notes

- The conductor auto-starts via hooks when a Claude Code session begins
- It auto-stops when the last session ends
- Music only plays when Claude Code sessions are actively using tools
- Multiple sessions = more instruments playing simultaneously
- The plugin is lightweight: hooks execute in <5ms and don't affect Claude Code performance
