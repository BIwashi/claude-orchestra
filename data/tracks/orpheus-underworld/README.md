# Orpheus in the Underworld — Galop Infernal

The famous "Can-Can" from Jacques Offenbach's operetta _Orphée aux enfers_ (1858).
This is the default demo track for Claude Orchestra's sample mode.

## Setup

1. **Get the audio**: Download a public domain recording of the Galop Infernal.

   Suggested sources:
   - [IMSLP](https://imslp.org/) — search "Orpheus in the Underworld"
   - [Musopen](https://musopen.org/) — free classical music
   - [Internet Archive](https://archive.org/) — search "Offenbach Galop Infernal"

2. **Place the file**: Save it as `source.mp3` in this directory:

   ```
   data/tracks/orpheus-underworld/source.mp3
   ```

3. **Run setup**:

   ```bash
   ./data/tracks/orpheus-underworld/setup.sh
   ```

   This will:
   - Separate stems using demucs (drums → percussion, bass → low strings, etc.)
   - Split into 7 sections matching the musical structure
   - Generate a manifest with orchestral labels
   - Install to `~/.claude-orchestra/tracks/orpheus-underworld/`

4. **Activate**:
   ```bash
   npx claude-orchestra track use orpheus-underworld
   ```

## How it maps to Claude Code sessions

| Sessions | Parts playing                     |
| -------- | --------------------------------- |
| 1        | Orchestral Ensemble only          |
| 2        | + Low Strings                     |
| 3        | + Percussion                      |
| 4        | + High Winds & Brass (full score) |

As you use tools, the music advances through sections. More sessions = more parts = fuller orchestration.

## Section structure

| Section        | Timestamps | Description                      |
| -------------- | ---------- | -------------------------------- |
| Introduction   | 0:00–0:20  | Opening fanfare                  |
| First Theme    | 0:20–0:40  | Main can-can melody              |
| Development A  | 0:40–1:00  | Variation and build              |
| Second Theme   | 1:00–1:20  | Contrasting section              |
| Development B  | 1:20–1:40  | Building energy                  |
| Recapitulation | 1:40–2:00  | Return of main theme             |
| Finale         | 2:00–end   | Climactic ending (loops on idle) |
