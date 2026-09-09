// 再現可能な擬似乱数（問題生成とテストで使う）。mulberry32。

export interface Rng {
  /** [0,1) の乱数。 */
  next(): number;
  /** [min,max] の整数。 */
  int(min: number, max: number): number;
  /** 配列から 1 要素。 */
  pick<T>(arr: readonly T[]): T;
  /** 配列を破壊的にシャッフルして返す。 */
  shuffle<T>(arr: T[]): T[];
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)];
  const shuffle = <T,>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  return { next, int, pick, shuffle };
}
