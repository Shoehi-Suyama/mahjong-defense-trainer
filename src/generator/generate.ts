// テーマ駆動の問題生成（仕様 #30, #31, #61, #63）。
// 完全ランダムにせず、テーマごとに「学ばせたい安全要素」を先に配置し、
// distractor（安全度の低い候補）で埋める。生成後は validateProblem で品質検査する。

import {
  collectVisibleTiles, type GameState, type Meld, type Opponent, type Seat,
} from '../core/gameState';
import type { Problem } from '../core/problem';
import { analyzeHand } from '../core/safety/analyzer';
import { makeRng, type Rng } from '../core/rng';
import {
  ALL_TILE_IDS, sortTileIds, suitedId, toCounts,
  type HonorTileId, type SuitPrefix, type TileId,
} from '../core/tiles';
import { THEMES, type ThemeId } from './themes';
import { validateProblem } from './validate';

const SUITS: SuitPrefix[] = ['man', 'pin', 'sou'];
const GUEST_HONORS: HonorTileId[] = ['west', 'north', 'south'];
const ALL_HONORS: HonorTileId[] = ['east', 'south', 'west', 'north', 'white', 'green', 'red'];

/** 場全体の枚数を数えながら牌を足す補助。4 枚を超えないよう弾く。 */
class Bag {
  private counts = new Map<TileId, number>();
  add(tiles: TileId[]) {
    for (const t of tiles) this.counts.set(t, (this.counts.get(t) ?? 0) + 1);
  }
  canAdd(t: TileId, n = 1): boolean {
    return (this.counts.get(t) ?? 0) + n <= 4;
  }
  count(t: TileId): number {
    return this.counts.get(t) ?? 0;
  }
}

interface Ingredients {
  answerTiles: TileId[];
  extraHandTiles: TileId[];
  /** 主たる相手（上家）の河。 */
  oppRiver: TileId[];
  /** 2 人目の相手（対面）。ダブルリーチ用。 */
  secondRiver?: TileId[];
  /** 主たる相手の副露。指定すると相手はリーチせず「テンパイ気配の副露者」になる。 */
  oppMelds?: Meld[];
  extraVisible: TileId[];
  dora: TileId[];
  dangerSuit: SuitPrefix;
  liveHonor?: HonorTileId;
}

const DANGER_VALUES = [4, 5, 3, 6, 2, 7, 8]; // 無スジになりやすい中張から埋める

function finalize(ing: Ingredients, rng: Rng): GameState {
  const bag = new Bag();
  bag.add(ing.oppRiver);
  if (ing.secondRiver) bag.add(ing.secondRiver);
  for (const m of ing.oppMelds ?? []) bag.add(m.tiles);
  bag.add(ing.extraVisible);
  bag.add(ing.dora);

  const hand: TileId[] = [];
  const pushHand = (t: TileId) => {
    if (bag.canAdd(t)) { hand.push(t); bag.add([t]); return true; }
    return false;
  };

  for (const t of ing.answerTiles) pushHand(t);
  for (const t of ing.extraHandTiles) pushHand(t);
  if (ing.liveHonor) pushHand(ing.liveHonor);

  // danger suit の中張牌で 14 枚まで埋める（無スジ distractor）。
  const pool: TileId[] = [];
  for (const v of DANGER_VALUES) pool.push(suitedId(ing.dangerSuit, v));
  for (const v of [4, 5, 6, 3, 7, 2, 8]) pool.push(suitedId(ing.dangerSuit, v)); // 2 枚目
  let pi = 0;
  while (hand.length < 14 && pi < pool.length) {
    pushHand(pool[pi]);
    pi++;
  }
  // まだ足りなければ他スジの安全でない牌を足す（保険）。
  const anyRiver = new Set<TileId>([...ing.oppRiver, ...(ing.secondRiver ?? [])]);
  while (hand.length < 14) {
    const t = rng.pick(ALL_TILE_IDS);
    if (!anyRiver.has(t)) pushHand(t);
  }

  const mkOpp = (seat: Seat, river: TileId[]): Opponent => ({
    seat, riichi: true, river, riichiTileIndex: river.length - 1, melds: [],
  });

  const opponents: Opponent[] = [];
  if (ing.oppMelds && ing.oppMelds.length > 0) {
    // 副露者はリーチできない。テンパイ気配として警戒対象にする（仕様 #39）。
    opponents.push({
      seat: 'kamicha', riichi: false, tenpaiLikely: true,
      river: ing.oppRiver, melds: ing.oppMelds,
    });
  } else {
    opponents.push(mkOpp('kamicha', ing.oppRiver));
  }
  if (ing.secondRiver) opponents.push(mkOpp('toimen', ing.secondRiver));

  return {
    round: Math.max(ing.oppRiver.length, ing.secondRiver?.length ?? 0),
    playerHand: sortTileIds(hand),
    opponents,
    doraIndicators: ing.dora,
    extraVisible: ing.extraVisible,
    objective: 'betaori',
  };
}

/** suit の値 vals を河向けに（answer と重複しないよう）作る。 */
function riverFiller(rng: Rng, suit: SuitPrefix, avoid: Set<number>, n: number): TileId[] {
  const out: TileId[] = [];
  const vals = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => !avoid.has(v)));
  for (const v of vals.slice(0, n)) out.push(suitedId(suit, v));
  return out;
}

function pickTwoSuits(rng: Rng): [SuitPrefix, SuitPrefix] {
  const s = rng.shuffle([...SUITS]);
  return [s[0], s[1]];
}

/** 河に含まれない字牌を 1 枚選ぶ（生牌の字牌 distractor 用）。 */
function pickLiveHonor(rng: Rng, river: TileId[]): HonorTileId {
  const riverSet = new Set<TileId>(river);
  const avail = ALL_HONORS.filter((h) => !riverSet.has(h));
  return rng.pick(avail.length ? avail : ALL_HONORS);
}

// ---- テーマ別コンストラクタ ----

function buildGenbutsu(rng: Rng): Ingredients {
  const [aSuit, dSuit] = pickTwoSuits(rng);
  const gHonor = rng.pick(GUEST_HONORS);
  const gNumV = rng.pick([2, 3, 4, 5, 6, 7, 8]);
  const gNum = suitedId(aSuit, gNumV);
  const river = rng.shuffle([
    gHonor, gNum,
    ...riverFiller(rng, aSuit, new Set([gNumV]), 3),
    rng.pick(ALL_HONORS.filter((h) => h !== gHonor)),
  ]);
  return {
    answerTiles: [gHonor, gNum],
    extraHandTiles: [],
    oppRiver: river,
    extraVisible: [],
    dora: [rng.pick(ALL_HONORS)],
    dangerSuit: dSuit,
    liveHonor: pickLiveHonor(rng, river),
  };
}

function buildSuji(rng: Rng): Ingredients {
  const [aSuit, dSuit] = pickTwoSuits(rng);
  const mode = rng.pick(['naka', 'terminal'] as const);
  let answerV: number;
  let partners: number[];
  if (mode === 'naka') {
    answerV = rng.pick([4, 5, 6]);
    partners = [answerV - 3, answerV + 3];
  } else {
    answerV = rng.pick([1, 9]);
    partners = [answerV === 1 ? 4 : 6];
  }
  const answer = suitedId(aSuit, answerV);
  const avoid = new Set([answerV, ...partners]);
  const river = rng.shuffle([
    ...partners.map((p) => suitedId(aSuit, p)),
    ...riverFiller(rng, aSuit, avoid, 3),
    rng.pick(ALL_HONORS),
    rng.pick(ALL_HONORS),
  ]);
  return {
    answerTiles: [answer],
    extraHandTiles: [],
    oppRiver: river,
    extraVisible: [],
    dora: [rng.pick(ALL_HONORS)],
    dangerSuit: dSuit,
    liveHonor: pickLiveHonor(rng, river),
  };
}

function buildWall(rng: Rng, copies: 4 | 3): Ingredients {
  const [aSuit, dSuit] = pickTwoSuits(rng);
  const wallN = rng.pick([2, 8]);
  const answerV = wallN === 8 ? 9 : 1;
  const wall = suitedId(aSuit, wallN);
  const river = rng.shuffle([
    ...riverFiller(rng, aSuit, new Set([answerV, wallN]), 4),
    rng.pick(ALL_HONORS),
    rng.pick(ALL_HONORS),
    rng.pick(ALL_HONORS),
  ]);
  return {
    answerTiles: [suitedId(aSuit, answerV)],
    extraHandTiles: [],
    // 壁の 4（または 3）枚はすべて場に見せる。手牌には持たせない
    // （持たせると「4枚見え＝当たり無し」になり、壁の学習にならない）。
    oppRiver: river,
    extraVisible: Array<TileId>(copies).fill(wall),
    dora: [rng.pick(ALL_HONORS)],
    dangerSuit: dSuit,
    liveHonor: pickLiveHonor(rng, river),
  };
}

function buildHonor(rng: Rng): Ingredients {
  const [aSuit, dSuit] = pickTwoSuits(rng);
  const safeHonor = rng.pick(ALL_HONORS);
  const liveHonor = rng.pick(ALL_HONORS.filter((h) => h !== safeHonor));
  const river = rng.shuffle([
    ...riverFiller(rng, aSuit, new Set(), 5),
    rng.pick(ALL_HONORS.filter((h) => h !== safeHonor && h !== liveHonor)),
  ]);
  return {
    answerTiles: [safeHonor],
    extraHandTiles: [],
    oppRiver: river,
    extraVisible: [safeHonor, safeHonor], // 手牌の 1 枚と合わせて 3 枚見え
    dora: [rng.pick(ALL_HONORS)],
    dangerSuit: dSuit,
    liveHonor,
  };
}

function buildTerminal(rng: Rng): Ingredients {
  const [aSuit, dSuit] = pickTwoSuits(rng);
  const safeEnd = rng.pick([1, 9]);
  const partner = safeEnd === 1 ? 4 : 6;
  const dangerEnd = safeEnd === 1 ? 9 : 1;
  const river = rng.shuffle([
    suitedId(aSuit, partner),
    ...riverFiller(rng, aSuit, new Set([1, 9, partner, safeEnd === 1 ? 6 : 4]), 3),
    rng.pick(ALL_HONORS),
    rng.pick(ALL_HONORS),
  ]);
  return {
    answerTiles: [suitedId(aSuit, safeEnd)],
    extraHandTiles: [suitedId(aSuit, dangerEnd)],
    oppRiver: river,
    extraVisible: [],
    dora: [rng.pick(ALL_HONORS)],
    dangerSuit: dSuit,
    liveHonor: pickLiveHonor(rng, river),
  };
}

function buildCompound(rng: Rng): Ingredients {
  const suits = rng.shuffle([...SUITS]);
  const [aSuit, bSuit, dSuit] = suits;
  const gHonor = rng.pick(GUEST_HONORS);
  const sujiV = rng.pick([4, 5, 6]);
  const wallN = rng.pick([2, 8]);
  const wallAnsV = wallN === 8 ? 9 : 1;
  const wall = suitedId(bSuit, wallN);
  const river = rng.shuffle([
    gHonor,
    suitedId(aSuit, sujiV - 3),
    suitedId(aSuit, sujiV + 3),
    ...riverFiller(rng, aSuit, new Set([sujiV, sujiV - 3, sujiV + 3]), 3),
    ...riverFiller(rng, bSuit, new Set([wallN, wallAnsV]), 2),
    rng.pick(ALL_HONORS.filter((h) => h !== gHonor)),
  ]);
  return {
    answerTiles: [gHonor, suitedId(aSuit, sujiV), suitedId(bSuit, wallAnsV)],
    extraHandTiles: [],
    oppRiver: river,
    extraVisible: [wall, wall, wall],
    dora: [rng.pick(ALL_HONORS)],
    dangerSuit: dSuit,
  };
}

/** ダブルリーチ（仕様 #77）。両方に安全な牌（両者の現物）を最善手にし、
 *  「片方の現物でももう片方には無スジ」という罠牌を distractor に置く。 */
function buildDoubleRiichi(rng: Rng): Ingredients {
  const [aSuit, bSuit, dSuit] = rng.shuffle([...SUITS]);
  const dHonor = rng.pick(GUEST_HONORS);
  const trapV = rng.pick([3, 4, 5, 6, 7]);
  const trap = suitedId(aSuit, trapV);
  const river1 = rng.shuffle([
    dHonor, trap,
    ...riverFiller(rng, aSuit, new Set([trapV]), 3),
    rng.pick(ALL_HONORS.filter((h) => h !== dHonor)),
  ]);
  const river2 = rng.shuffle([
    dHonor,
    ...riverFiller(rng, bSuit, new Set(), 4),
    rng.pick(ALL_HONORS.filter((h) => h !== dHonor)),
  ]);
  return {
    answerTiles: [dHonor],
    extraHandTiles: [trap],
    oppRiver: river1,
    secondRiver: river2,
    extraVisible: [],
    dora: [rng.pick(ALL_HONORS)],
    dangerSuit: dSuit,
    liveHonor: pickLiveHonor(rng, [...river1, ...river2]),
  };
}

/** 序盤の外側（仕様 #21, #45）。1〜2 巡目に切られた数牌の「外側」を最善手にする。
 *  例: 相手が 1 巡目に 3s を切っている → 1s・2s はその周辺の待ちを持ちにくい。 */
function buildEarlyRead(rng: Rng): Ingredients {
  const [aSuit, dSuit] = pickTwoSuits(rng);
  const lowSide = rng.next() < 0.5;
  // 端に寄った early 牌と、そのさらに外側の答え。
  const earlyV = lowSide ? rng.pick([3, 4]) : rng.pick([6, 7]);
  const answerV = lowSide ? earlyV - 2 : earlyV + 2;
  const answer = suitedId(aSuit, answerV);
  const early = suitedId(aSuit, earlyV);
  // answer を現物・スジにしないよう avoid。
  const avoid = new Set([answerV, answerV - 3, answerV + 3, earlyV]);
  const rest = rng.shuffle([
    ...riverFiller(rng, aSuit, avoid, 3),
    rng.pick(ALL_HONORS),
    rng.pick(ALL_HONORS),
  ]);
  return {
    answerTiles: [answer],
    extraHandTiles: [],
    oppRiver: [early, ...rest], // early を 1 巡目に固定
    extraVisible: [],
    dora: [rng.pick(ALL_HONORS)],
    dangerSuit: dSuit,
    // 生牌の字牌は early_outside より安全度が高くなり得るので distractor に混ぜない。
  };
}

/** 副露（仕様 #39, #43）。鳴いた牌が壁／ワンチャンスの材料になることを学ぶ。 */
function buildFuro(rng: Rng): Ingredients {
  const [aSuit, dSuit] = pickTwoSuits(rng);
  const yakuhai = rng.pick(['white', 'green', 'red'] as const);
  // aSuit の端 answer を、鳴き（ポン）でできた壁で否定する。
  const wallN = rng.pick([2, 8]);
  const answerV = wallN === 8 ? 9 : 1;
  const wall = suitedId(aSuit, wallN);
  const river = rng.shuffle([
    ...riverFiller(rng, aSuit, new Set([answerV, wallN]), 4),
    rng.pick(ALL_HONORS.filter((h) => h !== yakuhai)),
    rng.pick(ALL_HONORS.filter((h) => h !== yakuhai)),
  ]);
  return {
    answerTiles: [suitedId(aSuit, answerV)],
    extraHandTiles: [],
    oppRiver: river,
    oppMelds: [
      { type: 'pon', tiles: [yakuhai, yakuhai, yakuhai] },
      { type: 'pon', tiles: [wall, wall, wall] }, // 鳴きの 3 枚 + 河/ドラで 4 枚に
    ],
    extraVisible: [wall],
    dora: [rng.pick(ALL_HONORS)],
    dangerSuit: dSuit,
    liveHonor: pickLiveHonor(rng, [...river, yakuhai]),
  };
}

function construct(theme: ThemeId, rng: Rng): Ingredients {
  switch (theme) {
    case 'genbutsu': return buildGenbutsu(rng);
    case 'suji': return buildSuji(rng);
    case 'kabe': return buildWall(rng, 4);
    case 'one_chance': return buildWall(rng, 3);
    case 'honor': return buildHonor(rng);
    case 'terminal': return buildTerminal(rng);
    case 'early_read': return buildEarlyRead(rng);
    case 'furo': return buildFuro(rng);
    case 'compound': return buildCompound(rng);
    case 'double_riichi': return buildDoubleRiichi(rng);
  }
}

export interface GenerateResult {
  problem: Problem;
  attempts: number;
}

/** テーマとシードから 1 問生成する。品質検査に通るまで再試行する。 */
export function generateProblem(theme: ThemeId, seed: number, maxAttempts = 80): Problem {
  let lastIssues: string[] = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = makeRng(seed + attempt * 7919);
    const state = finalize(construct(theme, rng), rng);
    const analysis = analyzeHand(state);
    const problem: Problem = {
      id: `${theme}-${seed}-${attempt}`,
      theme,
      difficulty: THEMES[theme].difficulty,
      tags: buildTags(theme, state, analysis),
      state,
      analysis,
      correctAnswers: analysis.correctAnswers,
      preferred: analysis.preferred,
    };
    const v = validateProblem(problem, theme);
    if (v.ok) return problem;
    lastIssues = v.issues;
  }
  throw new Error(`generateProblem(${theme}) が ${maxAttempts} 回失敗: ${lastIssues.join(' / ')}`);
}

function buildTags(theme: ThemeId, state: GameState, analysis: ReturnType<typeof analyzeHand>): string[] {
  const preferred = analysis.ranking.find((r) => r.tile === analysis.preferred)!;
  const tags = new Set<string>([theme, ...preferred.reasons]);
  if (toCounts(collectVisibleTiles(state)).size > 0) tags.add(`round-${state.round}`);
  return [...tags];
}

/** ランダムなテーマで 1 問。'all' モード用。 */
export function generateAny(seed: number): Problem {
  const rng = makeRng(seed);
  const themes = Object.keys(THEMES) as ThemeId[];
  return generateProblem(rng.pick(themes), seed);
}
