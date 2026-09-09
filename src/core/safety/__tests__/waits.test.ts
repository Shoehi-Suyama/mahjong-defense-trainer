import { describe, expect, it } from 'vitest';
import { enumerateWaits, hasSujiKill, hasWallKill, isNakaSuji } from '../waits';
import { opponent, state } from './helpers';

describe('enumerateWaits', () => {
  it('現物: 相手の河にある牌', () => {
    const s = state({ hand: '東', opponents: [opponent({ river: '1m 4m 東 9p' })] });
    const w = enumerateWaits('east', s, s.opponents[0]);
    expect(w.genbutsu).toBe(true);
  });

  it('4枚見え: 現物でなくても相手は持てない', () => {
    const s = state({
      hand: 'sou9 sou9',
      opponents: [opponent({ river: '1m 2p 3p' })],
      dora: 'sou9',
      extra: 'sou9',
    });
    const w = enumerateWaits('sou9', s, s.opponents[0]);
    expect(w.genbutsu).toBe(false);
    expect(w.allVisible).toBe(true);
  });

  it('片スジ(中張): 反対側の両面とカンチャンは残る', () => {
    // 相手が 8m を切っている → 5m は 6-7 両面が消えるが 3-4 両面は残る
    const s = state({ hand: 'man5', opponents: [opponent({ river: '8m 1p 9s' })] });
    const w = enumerateWaits('man5', s, s.opponents[0]);
    expect(hasSujiKill(w)).toBe(true);
    expect(isNakaSuji(w)).toBe(false);
    const liveRyanmen = w.liveShapes.filter((x) => x.kind === 'ryanmen');
    expect(liveRyanmen).toHaveLength(1); // 3-4 の両面が生きている
  });

  it('中スジ: 両側のスジが通ると両面は全滅、カンチャンだけ残る', () => {
    const s = state({ hand: 'man5', opponents: [opponent({ river: '2m 8m 1p' })] });
    const w = enumerateWaits('man5', s, s.opponents[0]);
    expect(isNakaSuji(w)).toBe(true);
    expect(w.liveShapes.filter((x) => x.kind === 'ryanmen')).toHaveLength(0);
    expect(w.liveShapes.some((x) => x.kind === 'kanchan')).toBe(true);
  });

  it('端牌スジ: 1p は 4p が通ると順子待ちが消える', () => {
    const s = state({ hand: 'pin1', opponents: [opponent({ river: '4p 9s 1m' })] });
    const w = enumerateWaits('pin1', s, s.opponents[0]);
    expect(w.liveShapes).toHaveLength(0);
    expect(w.unlikelyShapes).toHaveLength(0);
    expect(hasSujiKill(w)).toBe(true);
  });

  it('壁(ノーチャンス): 8s が4枚見え → 9s の両面が作れない', () => {
    const s = state({
      hand: 'sou8 sou8 sou9',
      opponents: [opponent({ river: '8s 1m 2p' })],
      dora: 'sou8',
    });
    const w = enumerateWaits('sou9', s, s.opponents[0]);
    expect(hasWallKill(w)).toBe(true);
    expect(w.liveShapes).toHaveLength(0);
  });

  it('ワンチャンス: 8s が3枚見え → 9s の両面は残り1枚でしか作れない', () => {
    const s = state({
      hand: 'sou8 sou8 sou9',
      opponents: [opponent({ river: '8s 1m 2p' })],
    });
    const w = enumerateWaits('sou9', s, s.opponents[0]);
    expect(hasWallKill(w)).toBe(false);
    expect(w.unlikelyShapes.length).toBeGreaterThan(0);
    expect(w.liveShapes).toHaveLength(0);
  });

  it('無スジ: 手がかりがなければ両面が生きている', () => {
    const s = state({ hand: 'man5', opponents: [opponent({ river: '1p 9s 東' })] });
    const w = enumerateWaits('man5', s, s.opponents[0]);
    expect(w.deadShapes).toHaveLength(0);
    expect(w.liveShapes.filter((x) => x.kind === 'ryanmen')).toHaveLength(2);
  });

  it('字牌: 見えている枚数でシャンポン/単騎の可否が変わる', () => {
    const s3 = state({
      hand: 'white white',
      opponents: [opponent({ river: '1m 2p' })],
      extra: 'white',
    });
    const w3 = enumerateWaits('white', s3, s3.opponents[0]);
    expect(w3.visibleCount).toBe(3);
    expect(w3.shanpon).toBe(false);
    expect(w3.tanki).toBe(true);

    const s1 = state({ hand: 'green', opponents: [opponent({ river: '1m 2p' })] });
    const w1 = enumerateWaits('green', s1, s1.opponents[0]);
    expect(w1.shanpon).toBe(true);
    expect(w1.tanki).toBe(true);
  });
});
