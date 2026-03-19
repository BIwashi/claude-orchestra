/**
 * Base class for audio engines.
 * Defines the interface that SynthEngine and SampleEngine must implement.
 */
class BaseEngine {
  constructor(config = {}) {
    this.config = config;
  }

  async init(_instruments) {
    throw new Error('init() must be implemented by subclass');
  }

  handleToolEvent(_event, _instrument, _sessionCount) {
    throw new Error('handleToolEvent() must be implemented by subclass');
  }

  handleSessionJoin(_instrument, _count) {
    throw new Error('handleSessionJoin() must be implemented by subclass');
  }

  handleSessionLeave(_instrument, _count) {
    throw new Error('handleSessionLeave() must be implemented by subclass');
  }

  handleError(_instrument, _count) {
    throw new Error('handleError() must be implemented by subclass');
  }

  handleCompact(_sessions) {
    throw new Error('handleCompact() must be implemented by subclass');
  }

  handleIdle(_sessions, _chordIndex) {
    throw new Error('handleIdle() must be implemented by subclass');
  }

  stopAll() {
    throw new Error('stopAll() must be implemented by subclass');
  }
}

export { BaseEngine };
