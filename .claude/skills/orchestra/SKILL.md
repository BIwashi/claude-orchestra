---
name: orchestra
description: Setup and control Claude Orchestra - turn Claude Code sessions into music
user-invocable: true
allowed-tools: Bash, Read, Edit
---

# Claude Orchestra Control

Parse the user's input to determine the subcommand. If no subcommand is given, default to `setup`.

Subcommands:
- `setup` (default): Install and start Claude Orchestra
- `status`: Show current orchestra status
- `stop`: Stop the conductor
- `track <name>`: Switch to a sample track
- `synth`: Switch to synth mode

## Setup (`/orchestra` or `/orchestra setup`)

1. Check prerequisites:
```bash
command -v ffmpeg && echo "ffmpeg: OK" || echo "ffmpeg: MISSING (brew install ffmpeg)"
command -v afplay && echo "afplay: OK" || echo "afplay: MISSING (macOS only)"
command -v node && echo "node: $(node --version)" || echo "node: MISSING"
```

2. If prerequisites are met, run the install script and start the conductor:
```bash
ORCHESTRA_DIR="$(cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")/.." && pwd)"
# Find the orchestra project directory
ORCHESTRA_PROJECT=$(find ~/ghq -name "claude-orchestra" -type d -path "*/BIwashi/*" 2>/dev/null | head -1)
if [ -z "$ORCHESTRA_PROJECT" ]; then
  echo "Claude Orchestra project not found. Clone it first:"
  echo "  ghq get github.com/BIwashi/claude-orchestra"
  exit 1
fi
bash "$ORCHESTRA_PROJECT/bin/install.sh"
node "$ORCHESTRA_PROJECT/bin/conductor.js" start --daemon
```

3. Report the result to the user.

## Status (`/orchestra status`)

```bash
ORCHESTRA_PROJECT=$(find ~/ghq -name "claude-orchestra" -type d -path "*/BIwashi/*" 2>/dev/null | head -1)
node "$ORCHESTRA_PROJECT/bin/conductor.js" status
```

## Stop (`/orchestra stop`)

```bash
ORCHESTRA_PROJECT=$(find ~/ghq -name "claude-orchestra" -type d -path "*/BIwashi/*" 2>/dev/null | head -1)
node "$ORCHESTRA_PROJECT/bin/conductor.js" stop
```

## Track (`/orchestra track <name>`)

Switch to sample mode with the specified track:

```bash
ORCHESTRA_PROJECT=$(find ~/ghq -name "claude-orchestra" -type d -path "*/BIwashi/*" 2>/dev/null | head -1)
node "$ORCHESTRA_PROJECT/bin/conductor.js" track use <name>
# Restart conductor
node "$ORCHESTRA_PROJECT/bin/conductor.js" stop
node "$ORCHESTRA_PROJECT/bin/conductor.js" start --daemon
```

## Synth (`/orchestra synth`)

Switch back to synth mode:

```bash
ORCHESTRA_PROJECT=$(find ~/ghq -name "claude-orchestra" -type d -path "*/BIwashi/*" 2>/dev/null | head -1)
node "$ORCHESTRA_PROJECT/bin/conductor.js" config set mode synth
node "$ORCHESTRA_PROJECT/bin/conductor.js" config set track null
# Restart conductor
node "$ORCHESTRA_PROJECT/bin/conductor.js" stop
node "$ORCHESTRA_PROJECT/bin/conductor.js" start --daemon
```
