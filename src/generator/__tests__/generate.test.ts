import { describe, expect, it } from 'vitest';
import { generateProblem } from '../generate';
import { validateProblem } from '../validate';
import { THEMES, THEME_ORDER } from '../themes';
import { analyzeHand } from '../../core/safety/analyzer';

describe('generateProblem', () => {
  for (const theme of THEME_ORDER) {
    it(`テーマ「${THEMES[theme].label}」を 30 シード分、品質検査に通る形で生成できる`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const p = generateProblem(theme, seed * 1000 + 13);
        const v = validateProblem(p, theme);
        expect(v.issues).toEqual([]);
        expect(v.ok).toBe(true);

        // 手牌 14 枚・正解あり
        expect(p.state.playerHand).toHaveLength(14);
        expect(p.correctAnswers.length).toBeGreaterThan(0);

        // 最善手はテーマ通りの根拠を持つ
        const a = analyzeHand(p.state);
        const pref = a.ranking.find((r) => r.tile === a.preferred)!;
        expect(pref.reasons.some((r) => THEMES[theme].expectedReasons.includes(r))).toBe(true);

        // 決定性: 同じシードなら同じ問題
        const again = generateProblem(theme, seed * 1000 + 13);
        expect(again.state.playerHand).toEqual(p.state.playerHand);
        expect(again.state.opponents[0].river).toEqual(p.state.opponents[0].river);
      }
    });
  }

  it('genbutsu 問題の正解は現物のみ', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = generateProblem('genbutsu', seed * 31 + 5);
      const riverSet = new Set(p.state.opponents[0].river);
      for (const ans of p.correctAnswers) {
        expect(riverSet.has(ans)).toBe(true);
      }
    }
  });

  it('suji 問題は手牌に現物を含まない', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = generateProblem('suji', seed * 41 + 7);
      const riverSet = new Set(p.state.opponents[0].river);
      const genbutsuInHand = p.state.playerHand.filter((t) => riverSet.has(t));
      expect(genbutsuInHand).toEqual([]);
    }
  });
});
