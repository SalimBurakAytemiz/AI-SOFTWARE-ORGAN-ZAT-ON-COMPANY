// A single injectable clock so tests are deterministic and time is never read
// directly elsewhere in the runtime.

export interface Clock {
  now(): Date;
  isoNow(): string;
}

export const systemClock: Clock = {
  now: () => new Date(),
  isoNow: () => new Date().toISOString(),
};

/** A fixed clock for tests; advance() moves it forward. */
export function fixedClock(startIso: string): Clock & { advance(ms: number): void } {
  let t = new Date(startIso).getTime();
  return {
    now: () => new Date(t),
    isoNow: () => new Date(t).toISOString(),
    advance: (ms: number) => {
      t += ms;
    },
  };
}
