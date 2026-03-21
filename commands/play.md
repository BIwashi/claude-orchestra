---
description: Switch orchestra track or start playing
argument-hint: Track name (e.g. morning-mood, new-world, orpheus-underworld)
---

# Play Track

Switch the orchestra to a different track and restart the conductor.

Available tracks:

| Name               | Music                           | Mood                 |
| ------------------ | ------------------------------- | -------------------- |
| morning-mood       | Grieg — Peer Gynt: Morning Mood | 🌅 Calm, focused     |
| new-world          | Dvořák — Symphony No. 9         | 🌍 Epic, energetic   |
| ode-to-joy         | Beethoven — Symphony No. 9      | 🎉 Bright, uplifting |
| orpheus-underworld | Offenbach — Can-Can             | 💃 Fast, chaotic     |
| polovtsian-dances  | Borodin — Prince Igor           | 🔥 Powerful, exotic  |

To switch track, run:

```bash
${CLAUDE_PLUGIN_ROOT}/bin/conductor.js track use $ARGUMENTS
${CLAUDE_PLUGIN_ROOT}/bin/conductor.js stop 2>/dev/null; ${CLAUDE_PLUGIN_ROOT}/bin/conductor.js start --daemon
```

If $ARGUMENTS is empty, list available tracks:

```bash
${CLAUDE_PLUGIN_ROOT}/bin/conductor.js track list
```

Confirm the track change to the user.
