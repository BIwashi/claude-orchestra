import { AudioPlayer } from './audio-player.js';
import { generateAllTones } from './tone-cache.js';
import { getProgression, ARPEGGIOS, volumeForSessions } from './music-theory.js';
import { ActivityMapper } from './activity-mapper.js';

/**
 * Synth-based engine: generates tones via ffmpeg and plays them with afplay.
 * This is the original Claude Orchestra sound engine.
 */
class SynthEngine {
  constructor(config = {}) {
    this.player = new AudioPlayer();
    this.mapper = new ActivityMapper();
    this.config = config;
  }

  async init(instruments) {
    this.instruments = instruments;
    await generateAllTones(instruments);
  }

  handleToolEvent(event, instrument, sessionCount) {
    const params = this.mapper.map(event, instrument, sessionCount);
    if (params) {
      this.player.playNote(params.instrumentId, params.noteName, params.volume);
    }
  }

  handleSessionJoin(instrument, count) {
    this.player.playArpeggio(instrument.id, ARPEGGIOS.join, volumeForSessions(count));
  }

  handleSessionLeave(instrument, count) {
    this.player.playArpeggio(instrument.id, ARPEGGIOS.leave, volumeForSessions(Math.max(1, count)));
  }

  handleError(instrument, count) {
    this.player.playArpeggio(instrument.id, ARPEGGIOS.error, volumeForSessions(count), 80);
  }

  handleCompact(sessions) {
    const notes = ARPEGGIOS.compact;
    for (let i = 0; i < sessions.length && i < notes.length; i++) {
      this.player.playNote(sessions[i].instrument.id, notes[i], 0.6);
    }
  }

  handleIdle(sessions, chordIndex) {
    const progression = getProgression(sessions.length);
    const chord = progression[chordIndex % progression.length];

    for (let i = 0; i < sessions.length && i < chord.length; i++) {
      const inst = sessions[i].instrument;
      const noteLetter = chord[i].slice(0, -1);
      const noteName = `${noteLetter}${inst.octave}`;
      this.player.playNote(inst.id, noteName, 0.15);
    }
  }

  stopAll() {
    this.player.stopAll();
  }
}

export { SynthEngine };
