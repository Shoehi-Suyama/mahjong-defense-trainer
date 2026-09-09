import { describe, expect, it } from 'vitest';
import {
  analyzeHand, evaluateTileSafety, judgeAnswer, reasonSummary,
} from '../analyzer';
import { opponent, state, tiles } from './helpers';

describe('evaluateTileSafety', () => {
  it('現物は completeSafety かつ level 5', () => {
    const s = state({ hand: '東', opponents: [opponent({ river: '1m 4m 東 9p' })] });
    const r = evaluateTileSafety('east', s);
    expect(r.completeSafety).toBe(true);
    expect(r.level).toBe(5);
    expect(r.reasons).toContain('genbutsu');
    expect(r.dangerousWaits).toHaveLength(0);
  });

  it('無スジの中張牌は level 1 で両面が危険として残る', () => {
    const s = state({ hand: 'man5', opponents: [opponent({ river: '1p 9s 東' })] });
    const r = evaluateTileSafety('man5', s);
    expect(r.completeSafety).toBe(false);
    expect(r.level).toBe(1);
    expect(r.dangerousWaits).toContain('ryanmen');
    expect(r.reasons).toContain('no_info');
  });

  it('中スジは片スジより安全度が高い', () => {
    const naka = state({ hand: 'man5', opponents: [opponent({ river: '2m 8m 1p' })] });
    const kata = state({ hand: 'man5', opponents: [opponent({ river: '8m 1p 9s' })] });
    const rn = evaluateTileSafety('man5', naka);
    const rk = evaluateTileSafety('man5', kata);
    expect(rn.score).toBeGreaterThan(rk.score);
    expect(rn.reasons).toContain('naka_suji');
    expect(rk.reasons).toContain('suji');
  });

  it('壁はワンチャンスより安全度が高い（仕様 #18）', () => {
    const kabe = state({
      hand: 'sou8 sou8 sou9', opponents: [opponent({ river: '8s 1m 2p' })], dora: 'sou8',
    });
    const onech = state({
      hand: 'sou8 sou8 sou9', opponents: [opponent({ river: '8s 1m 2p' })],
    });
    const rKabe = evaluateTileSafety('sou9', kabe);
    const rOne = evaluateTileSafety('sou9', onech);
    expect(rKabe.reasons).toContain('kabe_nochance');
    expect(rOne.reasons).toContain('one_chance');
    expect(rKabe.score).toBeGreaterThan(rOne.score);
    expect(rKabe.level).toBe(4);
  });

  it('字牌3枚見えは生牌の字牌より安全', () => {
    const three = state({ hand: 'white white', opponents: [opponent({ river: '1m white' })] });
    const live = state({ hand: 'white', opponents: [opponent({ river: '1m 2p' })] });
    expect(evaluateTileSafety('white', three).score)
      .toBeGreaterThan(evaluateTileSafety('white', live).score);
  });
});

describe('analyzeHand / judgeAnswer', () => {
  // A: 現物(東) / B: 中スジ(5m) / C: 無スジ(3p) の複合手
  const compound = state({
    round: 9,
    hand: '東 man5 pin3',
    opponents: [opponent({ river: '2m 8m 東 1s 9s 6p' })],
  });

  it('現物が最優先で選ばれる', () => {
    const a = analyzeHand(compound);
    expect(a.preferred).toBe('east');
    expect(a.correctAnswers).toEqual(['east']);
    expect(a.ranking[0].tile).toBe('east');
    expect(a.ranking[a.ranking.length - 1].tile).toBe('pin3');
  });

  it('現物を選べば正解、中スジは惜しい、無スジは危険', () => {
    expect(judgeAnswer(compound, 'east').verdict).toBe('correct');
    expect(judgeAnswer(compound, 'man5').verdict).toBe('close');
    expect(judgeAnswer(compound, 'pin3').verdict).toBe('wrong');
  });

  it('同程度に安全な現物が2枚あれば両方を正解にする（仕様 #25）', () => {
    const s = state({
      hand: '東 白 man5',
      opponents: [opponent({ river: '1m 東 白 9s 3p' })],
    });
    const a = analyzeHand(s);
    expect(a.correctAnswers.sort()).toEqual(['east', 'white'].sort());
  });

  it('reasonSummary は読める要約を返す', () => {
    const r = evaluateTileSafety('east', compound);
    expect(reasonSummary(r)).toContain('現物');
  });
});

describe('複数リーチ (仕様 #77)', () => {
  const twoRiichi = state({
    round: 9,
    hand: '東 man5 pin3',
    opponents: [
      opponent({ seat: 'kamicha', river: '1m 東 9s 2p 6p' }),
      opponent({ seat: 'toimen', river: '東 4s 7p 3m 8m' }),
    ],
  });

  it('両者の現物はダブル現物・完全安全', () => {
    const r = evaluateTileSafety('east', twoRiichi);
    expect(r.completeSafety).toBe(true);
    expect(r.reasons).toContain('double_genbutsu');
    expect(r.level).toBe(5);
    expect(r.perOpponent).toHaveLength(2);
  });

  it('片方の現物でももう片方に無スジなら完全安全ではない', () => {
    // 1m は上家の現物だが対面には無スジ
    const r = evaluateTileSafety('man1', twoRiichi);
    expect(r.completeSafety).toBe(false);
    const kamicha = r.perOpponent.find((e) => e.seat === 'kamicha')!;
    const toimen = r.perOpponent.find((e) => e.seat === 'toimen')!;
    expect(kamicha.completeSafety).toBe(true);
    expect(toimen.completeSafety).toBe(false);
    expect(r.explanation).toContain('対面');
  });

  it('analyzeHand は両者の現物を最善手にする', () => {
    const a = analyzeHand(twoRiichi);
    expect(a.preferred).toBe('east');
  });
});

describe('序盤の外側 (仕様 #21)', () => {
  it('序盤に切られた牌の外側は無スジより安全度が高い', () => {
    // 1巡目に 3p → 1p はその外側
    const s = state({
      round: 6,
      hand: 'pin1 man7',
      opponents: [opponent({ river: '3p 東 9s 1s 6s' })],
    });
    const outside = evaluateTileSafety('pin1', s);
    const muji = evaluateTileSafety('man7', s);
    expect(outside.reasons).toContain('early_outside');
    expect(outside.level).toBeGreaterThanOrEqual(2);
    expect(outside.score).toBeGreaterThan(muji.score);
  });
});

describe('副露 (仕様 #39, #43)', () => {
  const furo = state({
    round: 8,
    hand: 'sou9 east',
    opponents: [{
      seat: 'kamicha', riichi: false, tenpaiLikely: true,
      river: tiles('1m 2p 東 5s'),
      melds: [
        { type: 'pon', tiles: tiles('white white white') },
        { type: 'pon', tiles: tiles('sou8 sou8 sou8') },
      ],
    }],
    dora: 'sou8',
  });

  it('テンパイ気配の副露者は警戒対象になる', () => {
    const r = evaluateTileSafety('sou9', furo);
    expect(r.perOpponent).toHaveLength(1);
  });

  it('副露牌が壁の枚数に加算される（8sポン + ドラ表示で 9s がノーチャンス）', () => {
    const r = evaluateTileSafety('sou9', furo);
    expect(r.reasons).toContain('kabe_nochance');
    expect(r.explanation).toContain('副露');
  });
});
