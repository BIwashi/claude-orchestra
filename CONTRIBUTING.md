# Contributing to Claude Orchestra

Thanks for your interest in contributing! 🎵

## Development Setup

```bash
git clone https://github.com/BIwashi/claude-orchestra.git
cd claude-orchestra
npm install
npm run check  # lint + format + test
```

## Project Structure

```
bin/conductor.js          CLI entrypoint (thin dispatcher)
lib/conductor-cli.js      CLI commands and status display
lib/conductor-daemon.js   Daemon lifecycle and event handling
lib/engine.js             Engine factory (synth/mixer/sample)
lib/mixer-engine.js       Sox pre-mix + ffplay playback
lib/synth-engine.js       FFmpeg harmonic synthesis
lib/sample-engine.js      Direct stem playback (legacy)
lib/base-engine.js        Shared engine interface
lib/playback.js           Cross-platform player detection
lib/music-theory.js       Scales, progressions, mappings
lib/event-watcher.js      Filesystem event watcher
lib/registry.js           Session → instrument assignment
test/                     Vitest unit tests
```

## Commands

```bash
npm run check         # Run all checks (lint + format + test)
npm run test          # Run tests only
npm run lint          # ESLint
npm run format        # Prettier (fix)
npm run format:check  # Prettier (check only)
```

## Guidelines

- **No runtime npm dependencies** — use Node.js built-ins and OS tools only
- **ESM imports** (`import/export`, not `require`)
- **Tests required** for new features — use vitest with temp dirs and mocks
- **No real audio in tests** — mock all external processes
- **Prettier formatting** — run `npm run format` before committing
- **PR titles in English** — descriptions can be in any language

## Adding a New Engine Mode

1. Create `lib/your-engine.js` extending `BaseEngine`
2. Implement: `init`, `handleToolEvent`, `handleSessionJoin`, `handleSessionLeave`, `handleIdle`, `stopAll`
3. Register in `lib/engine.js` `createEngine()`
4. Add tests in `test/your-engine.test.js`

## Adding a New Track

1. Create a directory under `data/tracks/your-track/`
2. Add `manifest.json` (see `data/tracks/demo/manifest.json` for format)
3. Add section audio files under `sections/`
4. Test with `claude-orchestra track add ./data/tracks/your-track`

## Audio Sources

All audio must be **CC0 or public domain**. MIDI files from public domain compositions rendered with open-source soundfonts are preferred.

## Reporting Issues

Please include:

- OS and Node.js version
- `claude-orchestra status` output
- Steps to reproduce
- Error messages or logs (`~/.claude-orchestra/conductor.log`)
