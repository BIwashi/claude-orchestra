// C major pentatonic scale - any combination sounds consonant
// Notes: C, D, E, G, A across multiple octaves

const BASE_NOTES = {
  C: 261.63,
  D: 293.66,
  E: 329.63,
  G: 392.00,
  A: 440.00,
};

// Generate note frequencies across octaves 3-6
const NOTES = {};
for (const [name, freq] of Object.entries(BASE_NOTES)) {
  for (let octave = 3; octave <= 6; octave++) {
    const multiplier = Math.pow(2, octave - 4); // octave 4 is base
    NOTES[`${name}${octave}`] = freq * multiplier;
  }
}

// Chromatic notes for error/tension effects
const CHROMATIC = {
  'Db4': 277.18,
  'Eb4': 311.13,
  'Gb4': 369.99,
  'Ab4': 415.30,
  'Bb4': 466.16,
};

// Chord progressions based on session count
const PROGRESSIONS = {
  1: [['C4', 'E4', 'G4']],                                           // I (tonic drone)
  2: [['C4', 'E4', 'G4'], ['G3', 'D4', 'G4']],                     // I - V
  3: [['C4', 'E4', 'G4'], ['C4', 'E4', 'A4'], ['G3', 'D4', 'G4'], ['C4', 'E4', 'G4']], // I-IV-V-I (using pentatonic subs)
  4: [['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['C4', 'E4', 'A4'], ['G3', 'D4', 'G4']], // I-vi-IV-V
};

// Arpeggios for session events
const ARPEGGIOS = {
  join: ['C4', 'E4', 'G4', 'C5'],      // ascending
  leave: ['C5', 'G4', 'E4', 'C4'],     // descending
  error: ['E4', 'Eb4', 'E4'],          // chromatic passing tone → resolve
  compact: ['C4', 'E4', 'G4', 'C5', 'E5', 'G5'], // crescendo chord
};

// Tool → scale degree mapping
const TOOL_NOTES = {
  Read:     'C',   // tonic - stable, foundational
  Write:    'D',   // supertonic - movement
  Edit:     'E',   // mediant - expressive
  Bash:     'G',   // dominant - powerful
  Grep:     'A',   // submediant - searching
  Glob:     'A',   // same as Grep (search family)
  Agent:    'G',   // dominant - commanding
  Skill:    'D',   // supertonic
  default:  'C',   // fallback
};

// Tool → duration mapping (ms)
const TOOL_DURATIONS = {
  Read:     150,
  Write:    500,
  Edit:     500,
  Bash:     300,
  Grep:     200,
  Glob:     200,
  Agent:    400,
  Skill:    300,
  default:  200,
};

function getNoteForTool(toolName) {
  return TOOL_NOTES[toolName] || TOOL_NOTES.default;
}

function getDurationForTool(toolName) {
  return TOOL_DURATIONS[toolName] || TOOL_DURATIONS.default;
}

function getFrequency(noteName) {
  return NOTES[noteName] || CHROMATIC[noteName] || BASE_NOTES.C;
}

function getProgression(sessionCount) {
  const key = Math.min(sessionCount, 4);
  return PROGRESSIONS[key] || PROGRESSIONS[1];
}

function volumeForSessions(n) {
  return Math.min(0.8, 0.6 / Math.sqrt(Math.max(1, n)));
}

export {
  NOTES,
  CHROMATIC,
  ARPEGGIOS,
  TOOL_NOTES,
  TOOL_DURATIONS,
  getNoteForTool,
  getDurationForTool,
  getFrequency,
  getProgression,
  volumeForSessions,
};
