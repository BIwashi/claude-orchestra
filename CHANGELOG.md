# Changelog

## [1.1.0] - 2026-03-21

### Added

- MixerEngine: synchronized multi-stem playback with sox pre-mixing and ffplay
- Runtime volume control via file-based signaling (`claude-orchestra volume`)
- Cross-platform player detection (ffplay -> afplay -> paplay -> aplay)
- Section crossfade support via sox fade
- CLI colors and formatted status display
- Help command with colored output
- Ode to Joy demo track (Beethoven, public domain MIDI)
- `/orchestra` skill for natural language control
- E2E integration test script
- GitHub Actions CI (Node 20 + 22)
- Zero-config auto-start via session hooks

### Changed

- Track switching now defaults to mixer mode (was sample)
- Conductor split into focused modules (conductor-cli, conductor-daemon)
- Player detection cached for process lifetime
- All `process.env.HOME` replaced with `os.homedir()`

### Fixed

- MixerEngine volume now uses applyVolume() for runtime changes
- EventWatcher race condition on startup (ENOENT handling)
- Plugin hooks duplicate declaration error
- Marketplace JSON schema validation
- npm package size reduced from 4.1MB to 38KB

## [1.0.0] - 2026-03-19

### Added

- Initial release with SynthEngine and SampleEngine
- Hook-based event system for Claude Code integration
- Instrument assignment via session registry
- Music theory module (scales, progressions, tool->note mapping)
- Activity mapper for tool events
