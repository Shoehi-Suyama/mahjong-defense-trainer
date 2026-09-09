// SafetyAnalyzer 本体（仕様 #42, #43, #73, #74, #75, #76）。
//
// 設計方針:
//   - 「完全安全（completeSafety）」と「相対的に安全（score / level）」を分けて持つ。
//   - 固定ランキング（現物=100, 壁=90…）ではなく、
//     「どの待ちを否定できたか」「どの待ちが残るか」から score を組み立てる。
//   - 複数リーチには最も危険な相手（min score）で評価する（仕様 #77）。

import {
  isHonorId, isDragon, isTerminal, rankOf, sortTileIds, suitOf, tileLabel, uniqueTiles,
  type TileId,
} from '../tiles';
import {
  SEAT_LABEL, threateningOpponents, type GameState, type Opponent, type Seat,
} from '../gameState';
import { REASON_LABEL, type ReasonCode } from './reasons';
import { buildExplanation } from './explain';
import {
  enumerateWaits, hasSujiKill, hasWallKill, isNakaSuji,
  type WaitAnalysis, type WaitKind,
} from './waits';

export type StarLevel = 1 | 2 | 3 | 4 | 5;

export interface TileSafety {
  tile: TileId;
  /** 学習用の目安スコア（0〜100）。実際の放銃率そのものではない（仕様 #60, #76）。 */
  score: number;
  level: StarLevel;
  /** 対象の相手全員からロンされないことが確定しているか。 */
  completeSafety: boolean;
  reasons: ReasonCode[];
  /** まだ当たり得る待ちの種類。 */
  dangerousWaits: WaitKind[];
  perOpponent: OpponentEval[];
  explanation: string;
}

export interface OpponentEval {
  seat: Seat;
  score: number;
  completeSafety: boolean;
  reasons: ReasonCode[];
  dangerousWaits: WaitKind[];
  analysis: WaitAnalysis;
}

interface RawEval {
  score: number;
  completeSafety: boolean;
  reasons: ReasonCode[];
  dangerousWaits: WaitKind[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function levelFromScore(score: number, complete: boolean): StarLevel {
  if (complete) return 5;
  if (score >= 70) return 4;
  if (score >= 45) return 3;
  if (score >= 25) return 2;
  return 1;
}

/** 序盤（3 巡目以内）にこの牌の隣接値を切っているか。弱い根拠（仕様 #21, #45）。 */
function earlyOutsideNear(tile: TileId, opp: Opponent): TileId | undefined {
  if (isHonorId(tile)) return undefined;
  const suit = suitOf(tile);
  const t = rankOf(tile);
  const early = opp.river.slice(0, 3);
  for (const d of early) {
    if (suitOf(d) !== suit) continue;
    const dv = rankOf(d);
    // d より外側（端に近い側）で、距離 1〜2 の牌なら「外側」とみなす。
    const outside = (dv <= 4 && t < dv) || (dv >= 6 && t > dv);
    if (outside && Math.abs(dv - t) <= 2) return d;
  }
  return undefined;
}

function evalHonor(w: WaitAnalysis, tile: TileId): RawEval {
  if (w.genbutsu) return { score: 100, completeSafety: true, reasons: ['genbutsu'], dangerousWaits: [] };
  if (w.allVisible) return { score: 95, completeSafety: true, reasons: ['all_visible'], dangerousWaits: [] };

  if (w.visibleCount >= 3) {
    return { score: 80, completeSafety: false, reasons: ['honor_three'], dangerousWaits: ['tanki'] };
  }
  if (w.visibleCount === 2) {
    return { score: 58, completeSafety: false, reasons: ['honor_two'], dangerousWaits: ['shanpon', 'tanki'] };
  }
  // 生牌に近い字牌。役牌はやや危険寄りに。
  const yakuhai = isDragon(tile) || tile === 'east';
  return {
    score: yakuhai ? 30 : 36,
    completeSafety: false,
    reasons: ['honor_live'],
    dangerousWaits: ['shanpon', 'tanki'],
  };
}

function evalNumber(w: WaitAnalysis, tile: TileId, opp: Opponent): RawEval {
  if (w.genbutsu) return { score: 100, completeSafety: true, reasons: ['genbutsu'], dangerousWaits: [] };
  if (w.allVisible) return { score: 95, completeSafety: true, reasons: ['all_visible'], dangerousWaits: [] };

  const terminal = isTerminal(tile);
  const liveRyanmen = w.liveShapes.filter((s) => s.kind === 'ryanmen').length;
  const liveEdge = w.liveShapes.filter((s) => s.kind === 'kanchan' || s.kind === 'penchan').length;
  const totalRyanmen = [...w.liveShapes, ...w.unlikelyShapes, ...w.deadShapes]
    .filter((s) => s.kind === 'ryanmen').length;
  const noLiveSeq = liveRyanmen + liveEdge === 0;
  const hasUnlikely = w.unlikelyShapes.length > 0;

  const liveKinds = (): WaitKind[] => {
    const k: WaitKind[] = [];
    for (const s of w.liveShapes) k.push(s.kind);
    for (const s of w.unlikelyShapes) k.push(s.kind);
    if (w.shanpon) k.push('shanpon');
    if (w.tanki) k.push('tanki');
    return k;
  };

  // (A) 順子待ちが完全に消えた（壁 and/or スジ）。残りはシャンポン・単騎のみ。
  if (noLiveSeq && !hasUnlikely) {
    const reasons: ReasonCode[] = [];
    if (hasWallKill(w)) reasons.push('kabe_nochance');
    if (hasSujiKill(w)) reasons.push(terminal ? 'terminal_suji' : isNakaSuji(w) ? 'naka_suji' : 'suji');
    if (reasons.length === 0) reasons.push(terminal ? 'terminal' : 'no_info');
    let score = 64;
    if (w.visibleCount >= 1) score += 6;
    if (terminal) score += 4;
    if (!w.shanpon) score += 14; // シャンポンも消えている
    return {
      score: clamp(score, 0, 82),
      completeSafety: false,
      reasons,
      dangerousWaits: [w.shanpon ? 'shanpon' : null, w.tanki ? 'tanki' : null].filter(Boolean) as WaitKind[],
    };
  }

  // (B) 順子待ちはワンチャンスでしか残らない。
  if (noLiveSeq && hasUnlikely) {
    const reasons: ReasonCode[] = ['one_chance'];
    if (hasSujiKill(w)) reasons.push(isNakaSuji(w) ? 'naka_suji' : 'suji');
    return { score: 50, completeSafety: false, reasons, dangerousWaits: liveKinds() };
  }

  // (C) 両面は全部消えたが、カンチャン／ペンチャンは残る（中スジ・片スジ）。
  if (liveRyanmen === 0 && totalRyanmen > 0) {
    const naka = isNakaSuji(w);
    const reasons: ReasonCode[] = [naka ? 'naka_suji' : 'suji'];
    if (hasUnlikely) reasons.push('one_chance');
    if (hasWallKill(w)) reasons.push('kabe_nochance');
    let score = naka ? 50 : 40;
    if (hasUnlikely) score += 6;
    if (terminal) score += 4;
    return { score: clamp(score, 25, 60), completeSafety: false, reasons, dangerousWaits: liveKinds() };
  }

  // (D) 生きた両面が残る。
  const reasons: ReasonCode[] = [];
  let score: number;
  if (hasSujiKill(w)) {
    reasons.push('suji'); // 片スジ（反対側は無スジ）
    score = 24;
  } else if (hasUnlikely) {
    reasons.push('one_chance');
    score = 30;
  } else {
    const near = earlyOutsideNear(tile, opp);
    if (near) {
      // 序盤に切られた牌の外側。確定情報ではないが、無スジよりは根拠がある（仕様 #21, #45）。
      reasons.push('early_outside');
      score = 27;
    } else {
      reasons.push(terminal ? 'terminal' : 'no_info');
      score = terminal ? 16 : 12;
    }
  }
  if (terminal && !reasons.includes('terminal')) score += 4;
  return { score: clamp(score, 5, 34), completeSafety: false, reasons, dangerousWaits: liveKinds() };
}

function evalAgainst(tile: TileId, state: GameState, opp: Opponent): OpponentEval {
  const w = enumerateWaits(tile, state, opp);
  const raw = isHonorId(tile) ? evalHonor(w, tile) : evalNumber(w, tile, opp);
  return {
    seat: opp.seat,
    score: raw.score,
    completeSafety: raw.completeSafety,
    reasons: raw.reasons,
    dangerousWaits: [...new Set(raw.dangerousWaits)],
    analysis: w,
  };
}

/** 1 枚の候補牌の総合安全評価。 */
export function evaluateTileSafety(tile: TileId, state: GameState): TileSafety {
  const opps = threateningOpponents(state);
  if (opps.length === 0) {
    return {
      tile, score: 100, level: 5, completeSafety: true,
      reasons: ['genbutsu'], dangerousWaits: [], perOpponent: [],
      explanation: 'リーチ・テンパイ気配の相手がいないため、放銃の心配はありません。',
    };
  }

  const perOpponent = opps.map((o) => evalAgainst(tile, state, o));
  // 最も危険な相手（min score）を基準にする。
  const worst = perOpponent.reduce((a, b) => (b.score < a.score ? b : a));
  const completeSafety = perOpponent.every((e) => e.completeSafety);

  const reasons = [...worst.reasons];
  if (completeSafety && perOpponent.length > 1 && perOpponent.every((e) => e.analysis.genbutsu)) {
    reasons.unshift('double_genbutsu');
  }

  const dangerousWaits = [...new Set(perOpponent.flatMap((e) => e.dangerousWaits))];
  const level = levelFromScore(worst.score, completeSafety);
  const primary = reasons[0];

  let explanation = buildExplanation({
    tile,
    primary,
    reasons,
    w: worst.analysis,
    dangerousWaits,
    completeSafety,
    earlyOutsideNear: earlyOutsideNear(tile, opps.find((o) => o.seat === worst.seat)!),
  });

  // 複数リーチ: 相手ごとの状況を先頭に添える（仕様 #77）。
  if (perOpponent.length > 1) {
    const mixed = new Set(perOpponent.map((e) => e.reasons[0])).size > 1;
    const parts = perOpponent.map((e) => `${SEAT_LABEL[e.seat]}には${REASON_LABEL[e.reasons[0]]}`);
    const head = `${parts.join('、')}。`
      + (mixed && !completeSafety
        ? '\n誰に対しても比較的安全な牌を優先します。最も危険な相手を基準に評価します。'
        : '');
    explanation = `${head}\n\n${explanation}`;
  }

  // 副露相手: 河読みが難しく、テンパイ確度も読みづらい旨を添える（仕様 #39, #43）。
  const worstOpp = opps.find((o) => o.seat === worst.seat)!;
  if (worstOpp.melds.length > 0 && !worstOpp.riichi) {
    const yakuhaiPon = worstOpp.melds.find(
      (m) => m.type === 'pon' && m.tiles.length > 0 && isHonorId(m.tiles[0]),
    );
    const note = yakuhaiPon
      ? '相手は役牌を仕掛けており、テンパイの可能性があります。'
      : '相手は副露しており、リーチはないもののテンパイの可能性があります。';
    explanation = `${note}副露牌も「場に見えている牌」として壁・ワンチャンスの判定に含めています。\n\n${explanation}`;
  }

  return {
    tile,
    score: worst.score,
    level,
    completeSafety,
    reasons,
    dangerousWaits,
    perOpponent,
    explanation,
  };
}

export interface HandAnalysis {
  /** 手牌に含まれる全種類の牌の評価（安全度降順）。 */
  ranking: TileSafety[];
  /** 正解として扱う牌（同程度に安全な牌が複数あれば全部）。仕様 #25, #26。 */
  correctAnswers: TileId[];
  /** 最も推奨する 1 枚。 */
  preferred: TileId;
}

function betterFirst(a: TileSafety, b: TileSafety): number {
  if (a.completeSafety !== b.completeSafety) return a.completeSafety ? -1 : 1;
  if (b.score !== a.score) return b.score - a.score;
  // 同点なら根拠が多い方 → 端牌/字牌より数牌現物を優先といった細かい差はつけない
  return b.reasons.length - a.reasons.length;
}

/** 手牌全体を評価してランキング・正解牌・推奨牌を返す。 */
export function analyzeHand(state: GameState): HandAnalysis {
  const tiles = uniqueTiles(state.playerHand);
  const ranking = tiles.map((t) => evaluateTileSafety(t, state)).sort(betterFirst);

  const top = ranking[0];
  const correctAnswers = ranking
    .filter((r) =>
      r.completeSafety === top.completeSafety &&
      r.level === top.level &&
      Math.abs(r.score - top.score) <= 6)
    .map((r) => r.tile);

  return {
    ranking,
    correctAnswers: sortTileIds(correctAnswers),
    preferred: top.tile,
  };
}

// ---- 回答判定（仕様 #28, #29） ----

export type Verdict = 'correct' | 'close' | 'wrong';

export interface JudgeResult {
  verdict: Verdict;
  chosen: TileSafety;
  preferred: TileSafety;
  /** 表示用ラベル（例: 「正解」「惜しい」「危険」）。 */
  label: string;
}

export function judgeAnswer(state: GameState, chosenTile: TileId): JudgeResult {
  const analysis = analyzeHand(state);
  const chosen = analysis.ranking.find((r) => r.tile === chosenTile)
    ?? evaluateTileSafety(chosenTile, state);
  const preferred = analysis.ranking.find((r) => r.tile === analysis.preferred)!;

  let verdict: Verdict;
  let label: string;
  if (analysis.correctAnswers.includes(chosenTile) || chosen.level === 5) {
    verdict = 'correct';
    label = '正解';
  } else if (chosen.level >= 3 && preferred.level - chosen.level <= 2) {
    verdict = 'close';
    label = '惜しい';
  } else {
    verdict = 'wrong';
    label = chosen.level <= 1 ? '危険' : '別の牌が安全';
  }
  return { verdict, chosen, preferred, label };
}

/** 一覧表示用の 1 行サマリ（例: 「現物」「4mのスジ」）。 */
export function reasonSummary(s: TileSafety): string {
  const parts = s.reasons.filter((r) => r !== 'no_info' || s.reasons.length === 1).map((r) => REASON_LABEL[r]);
  return parts.join('・') || REASON_LABEL.no_info;
}

export function seatLabel(seat: Seat): string {
  return SEAT_LABEL[seat];
}

export { tileLabel };
