// 実戦形式の 1 局を生成する（仕様 #66, #67）。
// 相手のリーチに対し、河が伸びていく中で 3 回続けて守備の判断を行う。
// 各分岐は独立に「明確な最善手がある」ことを安全判定エンジンで検証する。

import type { GameState } from '../core/gameState';
import type { LiveDecision, LiveHand } from '../core/live';
import { analyzeHand, type HandAnalysis } from '../core/safety/analyzer';
import { makeRng, type Rng } from '../core/rng';
import {
  isHonorId, rankOf, sortTileIds, suitedId, suitOf, toCounts,
  type HonorTileId, type SuitPrefix, type TileId,
} from '../core/tiles';

const SUITS: SuitPrefix[] = ['man', 'pin', 'sou'];
const HONORS: HonorTileId[] = ['east', 'south', 'west', 'north', 'white', 'green', 'red'];
const HAND_LABELS = ['東1局', '東2局', '東3局', '南1局', '南2局'];

class Bag {
  private c = new Map<TileId, number>();
  addAll(ts: TileId[]) { for (const t of ts) this.c.set(t, (this.c.get(t) ?? 0) + 1); }
  can(t: TileId) { return (this.c.get(t) ?? 0) < 4; }
  add(t: TileId) { this.c.set(t, (this.c.get(t) ?? 0) + 1); }
}

function riverFiller(rng: Rng, suit: SuitPrefix, avoid: Set<number>, n: number): TileId[] {
  const vals = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => !avoid.has(v)));
  return vals.slice(0, n).map((v) => suitedId(suit, v));
}

function mkState(round: number, hand: TileId[], river: TileId[], dora: TileId[]): GameState {
  return {
    round,
    playerHand: sortTileIds(hand),
    opponents: [{
      seat: 'kamicha', riichi: true, river,
      riichiTileIndex: river.length - 1, melds: [],
    }],
    doraIndicators: dora,
    extraVisible: [],
    objective: 'betaori',
  };
}

/** 分岐の最善手が明確か（レベル下限＋より悪い候補が存在）。 */
function decisionOk(a: HandAnalysis, minLevel: number): boolean {
  const [top, second] = a.ranking;
  if (!top || top.level < minLevel) return false;
  if (!a.ranking.some((r) => r.level <= top.level - 1)) return false;
  if (second && !a.correctAnswers.includes(second.tile) && top.score - second.score < 6) return false;
  return true;
}

function buildHand(
  bag: Bag, genbutsu: TileId[], dangerSuit: SuitPrefix, liveHonor: HonorTileId, rng: Rng,
): TileId[] {
  const hand: TileId[] = [];
  const push = (t: TileId) => { if (bag.can(t)) { hand.push(t); bag.add(t); return true; } return false; };
  for (const g of genbutsu) push(g);
  push(liveHonor);
  const pool = rng.shuffle([4, 5, 6, 3, 7, 2, 8]).flatMap((v) => [suitedId(dangerSuit, v), suitedId(dangerSuit, v)]);
  for (const t of pool) { if (hand.length >= 14) break; push(t); }
  let guard = 0;
  while (hand.length < 14 && guard++ < 40) push(suitedId(dangerSuit, rng.int(2, 8)));
  return hand;
}

function tryBuild(rng: Rng, seed: number): LiveHand | null {
  const [aSuit, dSuit] = rng.shuffle([...SUITS]);
  const riichiRound = rng.int(5, 7);
  const dora: TileId[] = [rng.pick(HONORS)];

  // ベースの河（リーチ宣言まで）。
  const baseHonors = rng.shuffle([...HONORS]).slice(0, 2);
  const river1 = rng.shuffle([
    ...baseHonors,
    ...riverFiller(rng, aSuit, new Set(), Math.max(3, riichiRound - 2)),
  ]);
  const round1 = river1.length;

  // 分岐 1 の手牌: 河にある牌を 2 枚（字牌＋数牌）現物として持つ。
  const gHonor = baseHonors[0];
  const gNum = river1.find((t) => !isHonorId(t) && suitOf(t) === aSuit);
  if (!gNum) return null;
  const liveHonor1 = rng.pick(HONORS.filter((h) => !river1.includes(h)));

  const bag = new Bag();
  bag.addAll(river1);
  bag.addAll(dora);
  const hand1 = buildHand(bag, [gHonor, gNum], dSuit, liveHonor1, rng);
  if (hand1.length !== 14) return null;

  const state1 = mkState(round1, hand1, river1, dora);
  const a1 = analyzeHand(state1);
  if (!decisionOk(a1, 4)) return null;

  // 分岐 2: 理想手順で a1.preferred を切り、危険牌を 1 枚ツモった。
  const drawn2 = suitedId(dSuit, rng.int(2, 8));
  const hand2 = removeOne([...hand1], a1.preferred);
  hand2.push(drawn2);
  if (hand2.length !== 14) return null;

  // 河が伸び、手牌の危険牌 1 種が新たに通る（仕様 #67）。
  const newGenbutsu2 = hand2.find((t) => !isHonorId(t) && !river1.includes(t)) ?? drawn2;
  const river2 = [
    ...river1,
    newGenbutsu2,
    ...riverFiller(rng, aSuit, new Set(river1.filter((t) => !isHonorId(t)).map(rankOf)), 2),
  ];
  const round2 = Math.max(river2.length, round1 + 2);
  const state2 = mkState(round2, hand2, river2, dora);
  const a2 = analyzeHand(state2);
  if (!decisionOk(a2, 3)) return null;

  // 分岐 3: 終盤。スジは確保しつつ、無スジ主体で選択肢を絞る。
  const drawn3 = suitedId(dSuit, rng.int(3, 7));
  const hand3 = removeOne([...hand2], a2.preferred);
  hand3.push(drawn3);
  if (hand3.length !== 14) return null;

  const sujiSeed = hand3.find((t) => !isHonorId(t) && suitOf(t) === dSuit
    && rankOf(t) >= 4 && rankOf(t) <= 6);
  const sujiPartners = sujiSeed
    ? [suitedId(dSuit, rankOf(sujiSeed) - 3), suitedId(dSuit, rankOf(sujiSeed) + 3)]
    : [];
  const river3 = [
    ...river2,
    ...sujiPartners,
    ...riverFiller(rng, aSuit, new Set(river2.filter((t) => !isHonorId(t)).map(rankOf)), 2),
  ];
  const round3 = Math.max(river3.length, round2 + 2);
  const state3 = mkState(round3, hand3, river3, dora);
  const a3 = analyzeHand(state3);
  if (!decisionOk(a3, 2)) return null;

  const counts = toCounts([
    ...hand1, ...hand2, ...hand3, ...river3, ...dora,
  ]);
  // 各分岐の局面単位で 4 枚超が無いかは decisionOk 前提だが、河は共有なので個別に確認。
  for (const st of [state1, state2, state3]) {
    const c = toCounts([...st.playerHand, ...st.opponents[0].river, ...st.doraIndicators]);
    for (const n of c.values()) if (n > 4) return null;
  }
  void counts;

  const decisions: LiveDecision[] = [
    { round: round1, state: state1, analysis: a1 },
    { round: round2, state: state2, analysis: a2 },
    { round: round3, state: state3, analysis: a3 },
  ];

  return {
    id: `live-${seed}`,
    handLabel: rng.pick(HAND_LABELS),
    riichiRound,
    decisions,
  };
}

function removeOne(arr: TileId[], t: TileId): TileId[] {
  const i = arr.indexOf(t);
  if (i >= 0) arr.splice(i, 1);
  return arr;
}

export function generateLiveHand(seed: number, maxAttempts = 80): LiveHand {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = makeRng(seed + attempt * 7919);
    const hand = tryBuild(rng, seed);
    if (hand) return { ...hand, id: `live-${seed}-${attempt}` };
  }
  throw new Error(`generateLiveHand(${seed}) が ${maxAttempts} 回失敗しました`);
}
