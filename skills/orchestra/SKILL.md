---
name: orchestra
description: Setup and control Claude Orchestra - turn Claude Code sessions into music. Use when the user wants to start, stop, or configure the orchestra.
---

# Claude Orchestra Control

Parse the user's input to determine the subcommand. If no subcommand is given, default to `setup`.

Subcommands:
- `setup` (default): Check prerequisites and start the conductor
- `status`: Show current orchestra status
- `stop`: Stop the conductor
- `track <name>`: Switch to a sample track
- `synth`: Switch back to synth mode

## Setup (`/orchestra` or `/orchestra setup`)

1. Check prerequisites:
```bash
command -v ffmpeg && echo "ffmpeg: OK" || echo "ffmpeg: MISSING (brew install ffmpeg)"
command -v afplay && echo "afplay: OK" || echo "afplay: MISSING (macOS only)"
command -v node && echo "node: $(node --version)" || echo "node: MISSING"
```

2. If prerequisites are met, start the conductor:
```bash
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

Switch to sample mode with the specified track:

```bash
npx claude-orchestra track use <name>
npx claude-orchestra stop
npx claude-orchestra start --daemon
```

## Synth (`/orchestra synth`)

Switch back to synth mode:

```bash
npx claude-orchestra config set mode synth
npx claude-orchestra config set track null
npx claude-orchestra stop
npx claude-orchestra start --daemon
```
