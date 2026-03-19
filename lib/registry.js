import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ORCHESTRA_DIR = join(process.env.HOME, '.claude-orchestra');
const REGISTRY_PATH = join(ORCHESTRA_DIR, 'registry.json');

class SessionRegistry {
  constructor(instruments) {
    this.instruments = instruments;
    this.sessions = new Map(); // sessionId → { instrumentId, lastSeen }
    this.load();
  }

  load() {
    try {
      if (existsSync(REGISTRY_PATH)) {
        const data = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
        for (const [id, info] of Object.entries(data.sessions || {})) {
          this.sessions.set(id, info);
        }
      }
    } catch {}
  }

  save() {
    mkdirSync(ORCHESTRA_DIR, { recursive: true });
    const data = {
      sessions: Object.fromEntries(this.sessions),
      updatedAt: Date.now(),
    };
    writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
  }

  /**
   * Register a session and assign an instrument.
   * Returns { instrument, isNew }.
   */
  register(sessionId) {
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      session.lastSeen = Date.now();
      this.save();
      return {
        instrument: this.instruments.find(i => i.id === session.instrumentId),
        isNew: false,
      };
    }

    // Assign next available instrument (round-robin)
    const usedInstruments = new Set(
      [...this.sessions.values()].map(s => s.instrumentId)
    );
    const available = this.instruments.find(i => !usedInstruments.has(i.id))
      || this.instruments[this.sessions.size % this.instruments.length];

    this.sessions.set(sessionId, {
      instrumentId: available.id,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    });
    this.save();

    return { instrument: available, isNew: true };
  }

  /**
   * Remove a session.
   */
  unregister(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const instrument = this.instruments.find(i => i.id === session.instrumentId);
    this.sessions.delete(sessionId);
    this.save();
    return instrument;
  }

  /**
   * Get count of active sessions.
   */
  get count() {
    return this.sessions.size;
  }

  /**
   * Get all active session → instrument mappings.
   */
  getAll() {
    const result = [];
    for (const [sessionId, info] of this.sessions) {
      const instrument = this.instruments.find(i => i.id === info.instrumentId);
      result.push({ sessionId, instrument, ...info });
    }
    return result;
  }

  /**
   * Prune sessions not seen in the last N ms.
   */
  prune(maxAge = 60000) {
    const now = Date.now();
    const pruned = [];
    for (const [id, info] of this.sessions) {
      if (now - info.lastSeen > maxAge) {
        pruned.push(id);
        this.sessions.delete(id);
      }
    }
    if (pruned.length > 0) this.save();
    return pruned;
  }
}

export { SessionRegistry };
