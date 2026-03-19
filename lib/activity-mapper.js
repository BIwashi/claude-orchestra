import { getNoteForTool, getDurationForTool, volumeForSessions } from './music-theory.js';

/**
 * Maps tool events to musical parameters.
 */
class ActivityMapper {
  constructor() {
    this.eventCounts = new Map(); // sessionId → count in current window
    this.windowStart = Date.now();
    this.windowMs = 1000;
    this.maxEventsPerWindow = 4;
  }

  /**
   * Convert a tool event to musical parameters.
   * Returns null if rate-limited.
   */
  map(event, instrument, sessionCount) {
    const sessionId = event.session_id;

    // Rate limiting: max 4 events per second per session
    this.pruneWindow();
    const count = this.eventCounts.get(sessionId) || 0;
    if (count >= this.maxEventsPerWindow) return null;
    this.eventCounts.set(sessionId, count + 1);

    // Determine tool name from event
    const toolName = event.tool_name || this.extractToolName(event);

    // Map to note in the instrument's octave
    const noteLetter = getNoteForTool(toolName);
    const noteName = `${noteLetter}${instrument.octave}`;

    // Duration
    const duration = getDurationForTool(toolName);

    // Volume: adjusted for session count
    let volume = volumeForSessions(sessionCount);
    // Boost slightly for "active" tools
    if (['Bash', 'Edit', 'Write'].includes(toolName)) {
      volume = Math.min(0.8, volume * 1.3);
    }

    return {
      instrumentId: instrument.id,
      noteName,
      duration,
      volume,
      toolName,
    };
  }

  extractToolName(event) {
    // Try to extract from the hook event input
    const input = event.input || {};
    if (input.tool_name) return input.tool_name;
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        return parsed.tool_name || 'default';
      } catch {
        /* ignore */
      }
    }
    return 'default';
  }

  pruneWindow() {
    const now = Date.now();
    if (now - this.windowStart > this.windowMs) {
      this.eventCounts.clear();
      this.windowStart = now;
    }
  }
}

export { ActivityMapper };
