// 実戦形式（仕様 #66, #67）。
// 1 局を通して複数回、守備の判断（何を切る？）を連続で行う。
// 「河を見る → 情報を整理する → 安全牌を探す → 複数候補を比較する → 切る」
// という思考手順を繰り返し練習することが目的。

import type { GameState } from './gameState';
import type { HandAnalysis } from './safety/analyzer';

export interface LiveDecision {
  /** この分岐の巡目。 */
  round: number;
  /** 相手（リーチ者）＋自分の 14 枚。 */
  state: GameState;
  /** 生成時に安全判定エンジンで計算したランキング・正解。 */
  analysis: HandAnalysis;
}

export interface LiveHand {
  id: string;
  /** 局の表示（例: 「東1局」）。 */
  handLabel: string;
  /** リーチが入った巡目。 */
  riichiRound: number;
  decisions: LiveDecision[];
}

/** 1 回の判断の得点（仕様 #60）。★の目安に対応。 */
export function decisionScore(level: number): number {
  return [0, 0, 30, 55, 80, 100][Math.max(0, Math.min(5, level))] ?? 0;
}

export const MAX_DECISION_SCORE = 100;
