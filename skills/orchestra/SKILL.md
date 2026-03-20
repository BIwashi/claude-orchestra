---
name: orchestra
description: Setup and control Claude Orchestra - turn Claude Code sessions into music. Use when the user wants to start, stop, or configure the orchestra.
---

# Claude Orchestra Control

Parse the user's input to determine the subcommand. If no subcommand is given, default to `setup`.

Subcommands:

- `setup` (default): Check prerequisites, switch to mixer mode, and start the conductor
- `status`: Show current orchestra status
- `stop`: Stop the conductor
- `track <name>`: Switch to a track
- `track prepare <input> --name <name> --timestamps <t1,t2,...>`: Prepare a custom track from source audio
- `mixer`: Switch to mixer mode
- `synth`: Switch to synth mode

## Setup (`/orchestra` or `/orchestra setup`)

Recommended default: use mixer mode unless the user explicitly asks for synth or legacy sample behavior.

1. Check prerequisites:

```bash
command -v ffmpeg && echo "ffmpeg: OK" || echo "ffmpeg: MISSING (brew install ffmpeg)"
command -v ffplay && echo "ffplay: OK" || echo "ffplay: MISSING (brew install ffmpeg)"
command -v sox && echo "sox: OK" || echo "sox: MISSING (brew install sox)"
command -v afplay && echo "afplay: OK" || echo "afplay: MISSING (macOS only, used by some modes)"
command -v node && echo "node: $(node --version)" || echo "node: MISSING"
```

2. If prerequisites are met, switch to mixer mode and start the conductor:

```bash
npx claude-orchestra config set mode mixer
npx claude-orchestra start --daemon
```

3. Report the result to the user.

## Status (`/orchestra status`)

```bash
npx claude-orchestra status
```

## Stop (`/orchestra stop`)

```bash
npx claude-orchestra stop
```

## Track (`/orchestra track <name>`)

Switch to the specified track and restart the conductor if needed:

```bash
npx claude-orchestra track use <name>
npx claude-orchestra stop
npx claude-orchestra start --daemon
```

## Track Prepare (`/orchestra track prepare <input> --name <name> --timestamps <t1,t2,...>`)

Prepare a custom track from source audio:

```bash
./bin/prepare-track.sh <input> --name <name> --timestamps <t1,t2,...>
```

Then switch to it in mixer mode:

```bash
npx claude-orchestra track use <name>
npx claude-orchestra config set mode mixer
npx claude-orchestra stop
npx claude-orchestra start --daemon
```

## Mixer (`/orchestra mixer`)

Switch to mixer mode:

```bash
npx claude-orchestra config set mode mixer
npx claude-orchestra stop
npx claude-orchestra start --daemon
```

## Synth (`/orchestra synth`)

Switch to synth mode:

```bash
npx claude-orchestra config set mode synth
npx claude-orchestra config set track null
npx claude-orchestra stop
npx claude-orchestra start --daemon
```
