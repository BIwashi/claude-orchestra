# Demo Track Template

This is a template for creating custom Claude Orchestra tracks.

## How to create a track

1. **Prepare your audio**: Split your music into sections, with each section having separate part files (e.g., strings, woodwinds, brass, percussion).

2. **Organize files**:

   ```
   my-track/
     manifest.json
     sections/
       00-intro/
         part-0.wav    (strings)
         part-1.wav    (woodwinds)
         part-2.wav    (brass)
         part-3.wav    (percussion)
       01-theme/
         part-0.wav
         ...
   ```

3. **Edit `manifest.json`**: Update the track name, section list, and part definitions.

4. **Install the track**:
   ```bash
   claude-orchestra track add ./my-track
   claude-orchestra track use my-track
   ```

## Using `slice-track.sh`

To split a single audio file into sections:

```bash
./bin/slice-track.sh input.mp3 --timestamps 0:00,1:30,3:00 --output ~/.claude-orchestra/tracks/my-track/
```

This creates section directories with the audio sliced at the given timestamps.
You still need to separate parts manually (or use stems from a DAW).

## Manifest format

| Field                       | Description                                  |
| --------------------------- | -------------------------------------------- |
| `name`                      | Display name for the track                   |
| `eventsPerSection`          | Tool events before advancing to next section |
| `maxParts`                  | Maximum simultaneous parts                   |
| `sections[].id`             | Directory name under `sections/`             |
| `sections[].loop`           | Whether to loop this section during idle     |
| `sections[].parts[].file`   | Relative path to audio file                  |
| `sections[].parts[].label`  | Display name for the part                    |
| `sections[].parts[].volume` | Part volume (0-1)                            |
| `idle.strategy`             | `"sustain"` or `"loop"`                      |
| `idle.fadeMs`               | Fade duration when idle (ms)                 |
