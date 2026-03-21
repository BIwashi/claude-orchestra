---
description: Show current Claude Orchestra status (track, section, sessions, volume)
---

# Orchestra Status

Show the current state of Claude Orchestra by reading the status file.

Run this command to check what's playing:

```bash
cat ~/.claude-orchestra/status.json 2>/dev/null | python3 -c "
import json, sys
try:
    s = json.load(sys.stdin)
    print(f'🎵 Claude Orchestra Status')
    print(f'   Track:    {s.get(\"track\", \"none\")}')
    print(f'   Section:  {s.get(\"section\", \"idle\")} ({s.get(\"sectionIndex\", 0)+1}/{s.get(\"totalSections\", 0)})')
    print(f'   Mode:     {s.get(\"mode\", \"synth\")}')
    print(f'   Volume:   {int(s.get(\"volume\", 0.5)*100)}%')
    print(f'   Sessions: {s.get(\"sessions\", 0)}')
    for sess in s.get('sessionList', []):
        print(f'     🎻 {sess[\"instrument\"]} (session {sess[\"id\"]}…)')
except Exception:
    print('Orchestra is not running.')
" || echo "Orchestra is not running."
```

Report the output to the user in a clear format.
