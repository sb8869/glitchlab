/**
 * The one random number generator in the app.
 *
 * mulberry32: small, fast, and seeded, which is the only property that matters
 * here. Every use of randomness in this project has to be reproducible — the
 * 500-student simulation reports numbers that must come out the same twice,
 * a visit to a robot is a stable puzzle across re-renders, and a test that
 * shuffles has to fail for a reason rather than on a bad afternoon. There is
 * no Math.random anywhere below the UI.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
