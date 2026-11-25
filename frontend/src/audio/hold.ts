// While the microphone listens (note detection, recording, speech recognition) background music must be silent,
// or Melo would hear its own music as the child. Every place that opens the mic holds the music; nesting is fine.
let holds = 0;

export function holdMusic(on: boolean): void {
  holds = Math.max(0, holds + (on ? 1 : -1));
}

export const musicHeld = () => holds > 0;
