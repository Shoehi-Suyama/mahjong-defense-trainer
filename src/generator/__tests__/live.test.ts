import { describe, expect, it } from 'vitest';
import { generateLiveHand } from '../live';
import { analyzeHand } from '../../core/safety/analyzer';
import { toCounts } from '../../core/tiles';

describe('generateLiveHand', () => {
  it('30 シード: 3 分岐が連続し、各分岐に明確な最善手がある', () => {
    const minLevels = [4, 3, 2];
    for (let seed = 1; seed <= 30; seed++) {
      const h = generateLiveHand(seed * 100 + 3);
      expect(h.decisions).toHaveLength(3);

      let prevRound = 0;
      h.decisions.forEach((d, i) => {
        expect(d.state.playerHand).toHaveLength(14);
        expect(d.round).toBeGreaterThanOrEqual(prevRound);
        prevRound = d.round;

        // 河・牌数の健全性
        const counts = toCounts([
          ...d.state.playerHand,
          ...d.state.opponents[0].river,
          ...d.state.doraIndicators,
        ]);
        expect([...counts.values()].every((n) => n <= 4)).toBe(true);
        expect(d.state.opponents[0].river).toHaveLength(d.round);

        // 最善手のレベルと、より悪い候補の存在
        const a = analyzeHand(d.state);
        expect(a.ranking[0].level).toBeGreaterThanOrEqual(minLevels[i]);
        expect(a.ranking.some((r) => r.level <= a.ranking[0].level - 1)).toBe(true);
        expect(a.correctAnswers.length).toBeGreaterThan(0);
      });

      // 決定性
      const again = generateLiveHand(seed * 100 + 3);
      expect(again.decisions.map((d) => d.state.playerHand))
        .toEqual(h.decisions.map((d) => d.state.playerHand));
    }
  });

  it('河は分岐ごとに伸びる（通った牌が増える）', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const h = generateLiveHand(seed * 41 + 9);
      const [r1, r2, r3] = h.decisions.map((d) => d.state.opponents[0].river);
      expect(r2.length).toBeGreaterThan(r1.length);
      expect(r3.length).toBeGreaterThan(r2.length);
      // 前の河は後の河の先頭に含まれる
      expect(r2.slice(0, r1.length)).toEqual(r1);
      expect(r3.slice(0, r2.length)).toEqual(r2);
    }
  });
});
