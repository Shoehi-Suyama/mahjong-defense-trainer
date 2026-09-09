import { describe, expect, it } from 'vitest';
import { generatePushFold } from '../pushfold';
import { toCounts } from '../../core/tiles';
import { evaluateTileSafety } from '../../core/safety/analyzer';

describe('generatePushFold', () => {
  it('40 シード: 牌枚数が正しく、推奨が result と一致し、決定的', () => {
    let push = 0;
    let fold = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const p = generatePushFold(seed * 100 + 7);

      expect(p.state.playerHand).toHaveLength(14);
      const counts = toCounts([
        ...p.state.playerHand,
        ...p.state.opponents[0].river,
        ...p.state.doraIndicators,
      ]);
      expect([...counts.values()].every((n) => n <= 4)).toBe(true);

      expect(p.recommend).toBe(p.result.recommend);
      expect(p.tenpai.waitCount).toBeGreaterThanOrEqual(1);
      expect(p.state.opponents[0].river).toHaveLength(p.state.round);

      // ツモ牌の安全度は再評価しても一致する
      const safety = evaluateTileSafety(p.drawnTile, p.state);
      expect(safety.score).toBe(p.drawnTileSafety.score);

      const again = generatePushFold(seed * 100 + 7);
      expect(again.state.playerHand).toEqual(p.state.playerHand);
      expect(again.recommend).toBe(p.recommend);

      if (p.recommend === 'push') push++;
      else fold++;
    }
    expect(push).toBeGreaterThan(3);
    expect(fold).toBeGreaterThan(3);
  });

  it('現物ツモ（drawnTile がリーチ者の河にある）なら押し推奨', () => {
    // 何シードか回して現物ケースを拾う
    for (let seed = 1; seed <= 60; seed++) {
      const p = generatePushFold(seed * 13 + 1);
      const inRiver = p.state.opponents[0].river.includes(p.drawnTile);
      if (inRiver) {
        expect(p.recommend).toBe('push');
        expect(p.drawnTileSafety.completeSafety).toBe(true);
      }
    }
  });
});
