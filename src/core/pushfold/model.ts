// 押し引き判定エンジン（仕様 #49, #50）。
//
// 「安全牌を当てる」練習とは別モード。テンパイしている自分が、
// リーチに対して押す（テンパイ維持で危険牌を切る）か降りるかを、
// 期待値の目安で判断する。
//
// これは簡易モデルであり、実際の押し引き表・放銃率を厳密に再現するものではない
// （仕様 #60）。AI ではなくプログラムが判定する（仕様 #72）。

import type { GameState } from '../gameState';
import type { TileSafety } from '../safety/analyzer';
import type { TileId } from '../tiles';

export type TenpaiShape = 'ryanmen' | 'kanchan' | 'penchan' | 'shanpon' | 'tanki' | 'multi';

export interface PushFoldProblem {
  id: string;
  difficulty: number;
  /** 相手（リーチ者）＋自分の 14 枚（テンパイ 13 + ツモ牌）。 */
  state: GameState;
  /** ツモってきた牌（＝押すなら切る牌、危険牌）。 */
  drawnTile: TileId;
  tenpai: {
    shape: TenpaiShape;
    waitCount: number;
    points: number;
    waitTiles: TileId[];
  };
  /** ツモ牌の安全度（SafetyAnalyzer の評価）。 */
  drawnTileSafety: TileSafety;
  result: PushFoldResult;
  recommend: 'push' | 'fold';
}

export const SHAPE_LABEL: Record<TenpaiShape, string> = {
  ryanmen: '両面',
  kanchan: 'カンチャン',
  penchan: 'ペンチャン',
  shanpon: 'シャンポン',
  tanki: '単騎',
  multi: '多面待ち',
};

export function isGoodShape(shape: TenpaiShape): boolean {
  return shape === 'ryanmen' || shape === 'multi';
}

export interface PushFoldInput {
  /** 巡目（1〜18 くらい）。 */
  round: number;
  /** 自分の待ちの形。 */
  shape: TenpaiShape;
  /** 自分の待ち牌の残り枚数（場に見えている分を引いた数）。 */
  waitCount: number;
  /** 和了したときに得られる点数の見積り（リーチ・ツモ・裏込みの平均的な値）。 */
  myPoints: number;
  /**
   * 押す牌をこのリーチ者に切ったときの 1 発の放銃率の目安（0〜1）。
   * SafetyAnalyzer の評価から与える。
   */
  pushTileDealIn: number;
  /** 相手（リーチ者）に放銃したときの平均失点の見積り。 */
  oppValue: number;
}

export interface PushFoldResult {
  recommend: 'push' | 'fold';
  /** 期待値の差が小さい（迷う）局面か。 */
  close: boolean;
  winProb: number;
  /** 押し続けた場合に、最終的に放銃する確率の目安。 */
  pushDealInProb: number;
  evPush: number;
  evFold: number;
  oppValue: number;
  reasoning: string[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 残り自摸数のざっくり見積り。 */
function turnsLeft(round: number): number {
  return clamp(18 - round, 1, 16);
}

const GOOD_SHAPES: TenpaiShape[] = ['ryanmen', 'multi'];

/** 和了率の目安。巡目・形・待ち枚数から。 */
export function estimateWinProb(round: number, shape: TenpaiShape, waitCount: number): number {
  const good = GOOD_SHAPES.includes(shape);
  const baseByTurn = clamp(0.66 - round * 0.035, 0.05, 0.62);
  const shapeMult = good ? 1.0 : shape === 'shanpon' ? 0.7 : 0.6;
  const denom = good ? 8 : 4;
  const countMult = clamp(waitCount / denom, 0.5, 1.3);
  return clamp(baseByTurn * shapeMult * countMult, 0.02, 0.72);
}

/** 押し切った場合の累積放銃率の目安。1 発の危険度を残り巡目ぶん重ねる。
 *  （途中で安全牌を引く・和了する・相手が先に上がる等があるので、巡目そのままではなく係数をかける） */
export function estimatePushDealIn(round: number, perTile: number): number {
  const tl = turnsLeft(round);
  const effectivePushes = 1 + (tl - 1) * 0.33;
  const prob = 1 - Math.pow(1 - perTile, effectivePushes);
  return clamp(prob, 0, 0.33);
}

export function evaluatePushFold(input: PushFoldInput): PushFoldResult {
  const { round, shape, waitCount, myPoints, pushTileDealIn, oppValue } = input;
  const tl = turnsLeft(round);

  const winProb = estimateWinProb(round, shape, waitCount);
  const pushDealInProb = estimatePushDealIn(round, pushTileDealIn);

  // 相手の自摸和了（自分は放銃しないが失点する）。押し・降りでほぼ共通。
  const oppTsumoProb = clamp(0.02 * tl, 0.05, 0.26);
  const tsumoLoss = oppTsumoProb * (oppValue / 3.3);

  // 押し: 和了益 − 放銃損 − 相手自摸損
  const evPush = winProb * myPoints - pushDealInProb * oppValue - tsumoLoss;
  // 降り: 自分の手は捨てる。放銃はほぼ 0。相手自摸損だけ受ける。
  const evFold = -tsumoLoss * 0.95;

  const margin = evPush - evFold;
  const recommend: 'push' | 'fold' = margin > 150 ? 'push' : 'fold';
  const close = Math.abs(margin) < 400;

  const good = GOOD_SHAPES.includes(shape);
  const reasoning: string[] = [
    `和了率の目安 ${(winProb * 100).toFixed(0)}%（${good ? '良形' : '悪形'}・${waitCount}枚・${round}巡目）。`,
    `押し切った場合の放銃率の目安 ${(pushDealInProb * 100).toFixed(0)}%、相手の平均失点 約${Math.round(oppValue)}点。`,
    `押しの期待値 ≈ ${Math.round(winProb * myPoints)}（和了）− ${Math.round(pushDealInProb * oppValue)}（放銃）− ${Math.round(tsumoLoss)}（相手ツモ） ≈ ${Math.round(evPush)}点。`,
    `降りの期待値 ≈ ${Math.round(evFold)}点（自分の手は捨てるが放銃はほぼ避けられる）。`,
  ];
  if (recommend === 'push') {
    reasoning.push(close
      ? '差は小さいが、和了益が放銃リスクをやや上回るので「押し」寄り。'
      : '和了益が放銃リスクを明確に上回るので「押し」。');
  } else {
    reasoning.push(close
      ? '差は小さいが、放銃リスクが和了益をやや上回るので「降り」寄り。迷ったら降り。'
      : '放銃リスクが和了益を明確に上回るので「降り」。');
  }

  return { recommend, close, winProb, pushDealInProb, evPush, evFold, oppValue, reasoning };
}

/** SafetyAnalyzer の score(0..100)/completeSafety を 1 発の放銃率の目安へ変換する。 */
export function dealInProbFromSafety(score: number, completeSafety: boolean): number {
  if (completeSafety) return 0;
  if (score >= 70) return 0.012;
  if (score >= 45) return 0.022;
  if (score >= 25) return 0.038;
  if (score >= 15) return 0.05;
  return 0.06;
}
