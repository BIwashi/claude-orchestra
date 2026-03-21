import { homedir } from 'node:os';
import { watch } from 'node:fs';
import { readFile, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';

const EVENTS_DIR = join(homedir(), '.claude-orchestra', 'events');

class EventWatcher extends EventEmitter {
  constructor() {
    super();
    this.watcher = null;
    this.processing = false;
  }

  start() {
    // Process any existing events first
    this.processExisting();

    // Watch for new events
    this.watcher = watch(EVENTS_DIR, (eventType, filename) => {
      if (
        eventType === 'rename' &&
        filename &&
        filename.endsWith('.json') &&
        !filename.startsWith('.')
      ) {
        this.processFile(join(EVENTS_DIR, filename));
      }
    });

    this.watcher.on('error', (err) => {
      console.error('Watcher error:', err.message);
    });
  }

  async processExisting() {
    try {
      const files = await readdir(EVENTS_DIR);
      for (const file of files.sort()) {
        if (file.endsWith('.json') && !file.startsWith('.')) {
          try {
            await this.processFile(join(EVENTS_DIR, file));
          } catch (err) {
            if (err?.code !== 'ENOENT') {
              throw err;
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  async processFile(filePath) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const event = JSON.parse(content);

      // Delete the event file immediately
      await unlink(filePath).catch(() => {});

      this.emit('event', event);
    } catch (_err) {
      // File may have been already processed or invalid
      try {
        await unlink(filePath);
      } catch {
        /* ignore */
      }
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

export { EventWatcher, EVENTS_DIR };
