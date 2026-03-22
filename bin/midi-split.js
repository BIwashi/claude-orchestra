#!/usr/bin/env node

/**
 * Split a Standard MIDI File (Format 1) into individual single-track MIDI files.
 *
 * Usage: node midi-split.js <input.mid> <output-dir>
 *
 * Output:
 *   <output-dir>/track-info.json   — metadata about each track
 *   <output-dir>/track-00.mid      — conductor track (tempo/meta only)
 *   <output-dir>/track-01.mid      — first instrument track
 *   ...
 *
 * Each output MIDI file is a Format 0 file containing the conductor track
 * (track 0) merged with the target track, so fluidsynth can render it
 * with correct tempo.
 *
 * No npm dependencies — uses only Node.js built-in Buffer operations.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

// General MIDI instrument names (program 0-127)
const GM_INSTRUMENTS = [
  'Acoustic Grand Piano',
  'Bright Acoustic Piano',
  'Electric Grand Piano',
  'Honky-tonk Piano',
  'Electric Piano 1',
  'Electric Piano 2',
  'Harpsichord',
  'Clavinet',
  'Celesta',
  'Glockenspiel',
  'Music Box',
  'Vibraphone',
  'Marimba',
  'Xylophone',
  'Tubular Bells',
  'Dulcimer',
  'Drawbar Organ',
  'Percussive Organ',
  'Rock Organ',
  'Church Organ',
  'Reed Organ',
  'Accordion',
  'Harmonica',
  'Tango Accordion',
  'Acoustic Guitar (nylon)',
  'Acoustic Guitar (steel)',
  'Electric Guitar (jazz)',
  'Electric Guitar (clean)',
  'Electric Guitar (muted)',
  'Overdriven Guitar',
  'Distortion Guitar',
  'Guitar Harmonics',
  'Acoustic Bass',
  'Electric Bass (finger)',
  'Electric Bass (pick)',
  'Fretless Bass',
  'Slap Bass 1',
  'Slap Bass 2',
  'Synth Bass 1',
  'Synth Bass 2',
  'Violin',
  'Viola',
  'Cello',
  'Contrabass',
  'Tremolo Strings',
  'Pizzicato Strings',
  'Orchestral Harp',
  'Timpani',
  'String Ensemble 1',
  'String Ensemble 2',
  'Synth Strings 1',
  'Synth Strings 2',
  'Choir Aahs',
  'Voice Oohs',
  'Synth Voice',
  'Orchestra Hit',
  'Trumpet',
  'Trombone',
  'Tuba',
  'Muted Trumpet',
  'French Horn',
  'Brass Section',
  'Synth Brass 1',
  'Synth Brass 2',
  'Soprano Sax',
  'Alto Sax',
  'Tenor Sax',
  'Baritone Sax',
  'Oboe',
  'English Horn',
  'Bassoon',
  'Clarinet',
  'Piccolo',
  'Flute',
  'Recorder',
  'Pan Flute',
  'Blown Bottle',
  'Shakuhachi',
  'Whistle',
  'Ocarina',
  'Lead 1 (square)',
  'Lead 2 (sawtooth)',
  'Lead 3 (calliope)',
  'Lead 4 (chiff)',
  'Lead 5 (charang)',
  'Lead 6 (voice)',
  'Lead 7 (fifths)',
  'Lead 8 (bass + lead)',
  'Pad 1 (new age)',
  'Pad 2 (warm)',
  'Pad 3 (polysynth)',
  'Pad 4 (choir)',
  'Pad 5 (bowed)',
  'Pad 6 (metallic)',
  'Pad 7 (halo)',
  'Pad 8 (sweep)',
  'FX 1 (rain)',
  'FX 2 (soundtrack)',
  'FX 3 (crystal)',
  'FX 4 (atmosphere)',
  'FX 5 (brightness)',
  'FX 6 (goblins)',
  'FX 7 (echoes)',
  'FX 8 (sci-fi)',
  'Sitar',
  'Banjo',
  'Shamisen',
  'Koto',
  'Kalimba',
  'Bagpipe',
  'Fiddle',
  'Shanai',
  'Tinkle Bell',
  'Agogo',
  'Steel Drums',
  'Woodblock',
  'Taiko Drum',
  'Melodic Tom',
  'Synth Drum',
  'Reverse Cymbal',
  'Guitar Fret Noise',
  'Breath Noise',
  'Seashore',
  'Bird Tweet',
  'Telephone Ring',
  'Helicopter',
  'Applause',
  'Gunshot',
];

// Instrument group classification by GM program number
function classifyInstrument(program, channel) {
  if (channel === 9) return 'percussion';
  if (program === null || program === undefined) return 'other';
  if (program === 47) return 'percussion'; // timpani — check before strings range
  if (program >= 112 && program <= 119) return 'percussion'; // percussive instruments
  if (program >= 40 && program <= 46) return 'strings'; // violin, viola, cello, contrabass, tremolo, pizzicato
  if (program >= 48 && program <= 55) return 'strings'; // string ensembles, synth strings, choir
  if (program >= 32 && program <= 39) return 'strings'; // bass instruments
  if (program >= 56 && program <= 63) return 'brass';
  if (program >= 64 && program <= 79) return 'woodwinds';
  if (program >= 0 && program <= 7) return 'keys';
  return 'other';
}

function readVariableLength(buf, offset) {
  let value = 0;
  let bytesRead = 0;
  while (offset + bytesRead < buf.length) {
    const byte = buf[offset + bytesRead];
    bytesRead++;
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) break;
  }
  return { value, bytesRead };
}

function parseChunk(buf, offset) {
  if (offset + 8 > buf.length) return null;
  const type = buf.toString('ascii', offset, offset + 4);
  const length = buf.readUInt32BE(offset + 4);
  const data = buf.subarray(offset + 8, offset + 8 + length);
  return { type, length, data, totalSize: 8 + length };
}

function parseTrackEvents(trackData) {
  let offset = 0;
  let runningStatus = 0;
  let channel = null;
  let program = null;
  let trackName = null;
  let noteCount = 0;

  while (offset < trackData.length) {
    const delta = readVariableLength(trackData, offset);
    offset += delta.bytesRead;
    if (offset >= trackData.length) break;

    let statusByte = trackData[offset];
    // Running status
    if (statusByte < 0x80) {
      statusByte = runningStatus;
    } else {
      offset++;
    }

    const type = statusByte & 0xf0;
    const ch = statusByte & 0x0f;

    if (type === 0x80 || type === 0x90) {
      // Note off / Note on
      if (type === 0x90 && trackData[offset + 1] > 0) noteCount++;
      channel = ch;
      offset += 2;
      runningStatus = statusByte;
    } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
      // Aftertouch, Control Change, Pitch Bend
      channel = ch;
      offset += 2;
      runningStatus = statusByte;
    } else if (type === 0xc0) {
      // Program Change
      program = trackData[offset];
      channel = ch;
      offset += 1;
      runningStatus = statusByte;
    } else if (type === 0xd0) {
      // Channel Pressure
      channel = ch;
      offset += 1;
      runningStatus = statusByte;
    } else if (statusByte === 0xff) {
      // Meta event
      const metaType = trackData[offset];
      offset++;
      const len = readVariableLength(trackData, offset);
      offset += len.bytesRead;
      if (metaType === 0x03 && len.value > 0) {
        // Track Name
        trackName = trackData.toString('utf-8', offset, offset + len.value).trim();
      }
      offset += len.value;
      runningStatus = 0;
    } else if (statusByte === 0xf0 || statusByte === 0xf7) {
      // SysEx
      const len = readVariableLength(trackData, offset);
      offset += len.bytesRead + len.value;
      runningStatus = 0;
    } else {
      // Unknown — skip
      offset++;
    }
  }

  return { channel, program, trackName, noteCount };
}

function buildSingleTrackMidi(headerData, conductorTrackData, targetTrackData) {
  // Create a Format 0 MIDI with conductor + target merged
  // Actually, create Format 1 with 2 tracks (conductor + target) for simplicity
  const header = Buffer.alloc(14);
  header.write('MThd', 0, 4, 'ascii');
  header.writeUInt32BE(6, 4); // header length
  header.writeUInt16BE(1, 8); // format 1
  header.writeUInt16BE(2, 10); // 2 tracks
  header.writeUInt16BE(headerData.ticksPerQuarter, 12);

  const conductorChunk = buildTrackChunk(conductorTrackData);
  const targetChunk = buildTrackChunk(targetTrackData);

  return Buffer.concat([header, conductorChunk, targetChunk]);
}

function buildTrackChunk(trackData) {
  const header = Buffer.alloc(8);
  header.write('MTrk', 0, 4, 'ascii');
  header.writeUInt32BE(trackData.length, 4);
  return Buffer.concat([header, trackData]);
}

function splitMidi(inputPath, outputDir) {
  const buf = readFileSync(inputPath);

  // Parse header
  const headerChunk = parseChunk(buf, 0);
  if (!headerChunk || headerChunk.type !== 'MThd') {
    throw new Error('Not a valid MIDI file');
  }

  const format = headerChunk.data.readUInt16BE(0);
  const numTracks = headerChunk.data.readUInt16BE(2);
  const ticksPerQuarter = headerChunk.data.readUInt16BE(4);

  if (format !== 1) {
    throw new Error(`Only Format 1 MIDI files are supported (got format ${format})`);
  }

  // Parse all tracks
  const tracks = [];
  let offset = headerChunk.totalSize;
  for (let i = 0; i < numTracks; i++) {
    const trackChunk = parseChunk(buf, offset);
    if (!trackChunk || trackChunk.type !== 'MTrk') {
      throw new Error(`Expected MTrk chunk at offset ${offset}`);
    }
    tracks.push(trackChunk.data);
    offset += trackChunk.totalSize;
  }

  // Analyze each track
  const trackInfos = tracks.map((trackData, index) => {
    const info = parseTrackEvents(trackData);
    return {
      index,
      channel: info.channel,
      name: info.trackName || (index === 0 ? 'Conductor' : `Track ${index}`),
      program: info.program,
      gmName:
        info.program !== null ? GM_INSTRUMENTS[info.program] || `Program ${info.program}` : null,
      group: classifyInstrument(info.program, info.channel),
      noteCount: info.noteCount,
    };
  });

  // Create output directory
  mkdirSync(outputDir, { recursive: true });

  // Write track-info.json
  const trackInfo = {
    source: basename(inputPath),
    format,
    numTracks,
    ticksPerQuarter,
    tracks: trackInfos,
  };
  writeFileSync(join(outputDir, 'track-info.json'), JSON.stringify(trackInfo, null, 2) + '\n');

  // Write individual MIDI files
  const headerData = { ticksPerQuarter };
  const conductorTrack = tracks[0];

  for (let i = 0; i < tracks.length; i++) {
    const outputPath = join(outputDir, `track-${String(i).padStart(2, '0')}.mid`);
    if (i === 0) {
      // Conductor track alone (for reference)
      const midi = buildSingleTrackMidi(headerData, conductorTrack, tracks[0]);
      writeFileSync(outputPath, midi);
    } else {
      // Instrument track + conductor
      const midi = buildSingleTrackMidi(headerData, conductorTrack, tracks[i]);
      writeFileSync(outputPath, midi);
    }
  }

  return trackInfo;
}

export { splitMidi, classifyInstrument, GM_INSTRUMENTS };

// CLI entry point — only run when executed directly
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith('midi-split.js') || process.argv[1].endsWith('midi-split'));

if (isDirectExecution) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node midi-split.js <input.mid> <output-dir>');
    process.exit(1);
  }

  const [inputPath, outputDir] = args;
  try {
    const info = splitMidi(inputPath, outputDir);
    console.log(`Split ${info.source} into ${info.numTracks} tracks:`);
    for (const track of info.tracks) {
      const notes = track.noteCount > 0 ? ` (${track.noteCount} notes)` : '';
      const gm = track.gmName ? ` [${track.gmName}]` : '';
      console.log(`  Track ${track.index}: ${track.name}${gm} → ${track.group}${notes}`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
