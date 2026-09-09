// 生成した問題の品質チェック（仕様 #62, #63）。
// 「正解が存在するか」「明確な最善手があるか」「牌枚数が正しいか」などを機械的に検証する。

import { collectVisibleTiles } from '../core/gameState';
import type { Problem } from '../core/problem';
import { analyzeHand } from '../core/safety/analyzer';
import { toCounts } from '../core/tiles';
import { THEMES, type ThemeId } from './themes';

export interface ValidationResult {
  ok: boolean;
  issues: string[];
}

export function validateProblem(problem: Problem, theme: ThemeId): ValidationResult {
  const issues: string[] = [];
  const { state } = problem;

  // --- 牌枚数 ---
  if (state.playerHand.length !== 14) {
    issues.push(`手牌が ${state.playerHand.length} 枚（14 枚であるべき）`);
  }
  const counts = toCounts(collectVisibleTiles(state));
  for (const [tile, n] of counts) {
    if (n > 4) issues.push(`${tile} が場に ${n} 枚（4 枚を超えている）`);
  }

  // --- 河 ---
  for (const opp of state.opponents) {
    if (opp.river.length < 1) issues.push('相手の河が空');
    if (opp.river.length > state.round) {
      issues.push(`相手の河（${opp.river.length}）が巡目（${state.round}）を超えている`);
    }
    if (opp.riichi && opp.riichiTileIndex !== undefined) {
      if (opp.riichiTileIndex < 0 || opp.riichiTileIndex >= opp.river.length) {
        issues.push('リーチ宣言牌のインデックスが河の範囲外');
      }
    }
  }

  // --- 正解の明確さ ---
  const analysis = analyzeHand(state);
  const [top, second] = analysis.ranking;
  if (!top) {
    issues.push('候補牌が無い');
    return { ok: false, issues };
  }
  if (analysis.correctAnswers.length === 0) issues.push('正解牌が無い');

  const expected = THEMES[theme].expectedReasons;
  const preferredSafety = analysis.ranking.find((r) => r.tile === analysis.preferred)!;
  if (!preferredSafety.reasons.some((r) => expected.includes(r))) {
    issues.push(
      `最善手 ${analysis.preferred} の根拠 [${preferredSafety.reasons.join(',')}] が` +
      `テーマ ${theme} の想定 [${expected.join(',')}] と一致しない`,
    );
  }

  // 明確な最善手があること: 2 番手と差がある、もしくは 2 番手も正解扱い（同格）。
  if (second && !analysis.correctAnswers.includes(second.tile)) {
    const gap = top.score - second.score;
    if (gap < 10) issues.push(`最善手と 2 番手の差が小さい（${gap}）`);
  }

  // 学習価値: 明確に安全度が下がる distractor が 2 枚以上あること。
  const distractors = analysis.ranking.filter((r) => r.level <= top.level - 1);
  if (distractors.length < 2) issues.push('安全度の低い候補（distractor）が 2 枚未満');

  // 曖昧さ回避: 低難易度では正解が多すぎない。
  if (THEMES[theme].difficulty <= 2 && analysis.correctAnswers.length > 2) {
    issues.push(`低難易度なのに正解が ${analysis.correctAnswers.length} 枚（曖昧）`);
  }

  return { ok: issues.length === 0, issues };
}
