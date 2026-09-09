// 押し引き問題の生成（仕様 #49, #50, #66 の一部）。
// 「安全牌当て」とは別モード。自分はテンパイ、相手はリーチ。
// ツモ牌（危険牌）を切って押すか、降りるかを判断する。

import type { GameState } from '../core/gameState';
import {
  dealInProbFromSafety, evaluatePushFold, type PushFoldProblem, type TenpaiShape,
} from '../core/pushfold/model';
import { evaluateTileSafety } from '../core/safety/analyzer';
import { makeRng, type Rng } from '../core/rng';
import {
  sortTileIds, suitedId, toCounts,
  type HonorTileId, type SuitPrefix, type TileId,
} from '../core/tiles';

const SUITS: SuitPrefix[] = ['man', 'pin', 'sou'];
const HONORS: HonorTileId[] = ['east', 'south', 'west', 'north', 'white', 'green', 'red'];

type Profile = 'clear_push' | 'clear_fold' | 'close';

interface Situation {
  round: number;
  points: number;
  shape: TenpaiShape;
  /** 待ち牌をわざと減らす枚数（悪形の細い待ちを表現）。 */
  killWait: number;
  /** ツモ牌の狙う危険度: 'muji'（無スジ/生牌）| 'suji'（スジ）| 'genbutsu'。 */
  dangerBand: 'muji' | 'suji' | 'genbutsu';
}

function pickSituation(rng: Rng, profile: Profile): Situation {
  if (profile === 'clear_push') {
    return {
      round: rng.int(3, 7),
      points: rng.pick([5200, 7700, 8000, 8000]),
      shape: 'ryanmen',
      killWait: 0,
      dangerBand: rng.pick(['muji', 'suji']),
    };
  }
  if (profile === 'clear_fold') {
    return {
      round: rng.int(11, 15),
      points: rng.pick([1000, 1300, 2000, 2600]),
      shape: rng.pick(['kanchan', 'penchan']),
      killWait: rng.int(1, 2),
      dangerBand: 'muji',
    };
  }
  return {
    round: rng.int(7, 11),
    points: rng.pick([2600, 3900, 3900, 5200]),
    shape: rng.pick(['ryanmen', 'kanchan', 'shanpon']),
    killWait: rng.int(0, 1),
    dangerBand: rng.pick(['muji', 'suji']),
  };
}

/** 3 面子 + 雀頭 + 待ち partial の 13 枚テンパイを組む（表示用。厳密な役判定はしない）。 */
function buildTenpaiHand(
  rng: Rng, handSuit: SuitPrefix, waitSuit: SuitPrefix, shape: TenpaiShape,
): { hand: TileId[]; waitTiles: TileId[] } {
  const sets: TileId[] = [
    suitedId(handSuit, 1), suitedId(handSuit, 2), suitedId(handSuit, 3),
    suitedId(handSuit, 4), suitedId(handSuit, 5), suitedId(handSuit, 6),
    suitedId(handSuit, 7), suitedId(handSuit, 8), suitedId(handSuit, 9),
  ];
  const pairHonor = rng.pick(HONORS);
  const pair: TileId[] = [pairHonor, pairHonor];

  let partial: TileId[];
  let waitTiles: TileId[];
  switch (shape) {
    case 'ryanmen':
    case 'multi': {
      const a = rng.int(3, 6); // [a,a+1] 待ち a-1 / a+2
      partial = [suitedId(waitSuit, a), suitedId(waitSuit, a + 1)];
      waitTiles = [suitedId(waitSuit, a - 1), suitedId(waitSuit, a + 2)];
      break;
    }
    case 'kanchan': {
      const a = rng.int(2, 6); // [a,a+2] 待ち a+1
      partial = [suitedId(waitSuit, a), suitedId(waitSuit, a + 2)];
      waitTiles = [suitedId(waitSuit, a + 1)];
      break;
    }
    case 'penchan': {
      const low = rng.next() < 0.5;
      partial = low ? [suitedId(waitSuit, 1), suitedId(waitSuit, 2)] : [suitedId(waitSuit, 8), suitedId(waitSuit, 9)];
      waitTiles = [suitedId(waitSuit, low ? 3 : 7)];
      break;
    }
    case 'shanpon': {
      const b = rng.int(2, 8);
      // 雀頭の honor と、waitSuit の対子でシャンポン。
      partial = [suitedId(waitSuit, b), suitedId(waitSuit, b)];
      waitTiles = [pairHonor, suitedId(waitSuit, b)];
      break;
    }
    case 'tanki':
    default: {
      // 生成側では使わないが、型の網羅のため両面と同じ扱いにする。
      const a = rng.int(3, 6);
      partial = [suitedId(waitSuit, a), suitedId(waitSuit, a + 1)];
      waitTiles = [suitedId(waitSuit, a - 1), suitedId(waitSuit, a + 2)];
      break;
    }
  }

  const hand = sortTileIds([...sets, ...pair, ...partial].slice(0, 13));
  return { hand, waitTiles };
}

function buildOppRiver(rng: Rng, suit: SuitPrefix, round: number): TileId[] {
  const vals = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const river: TileId[] = [];
  for (let i = 0; i < round; i++) {
    if (i % 3 === 2) river.push(rng.pick(HONORS));
    else river.push(suitedId(suit, vals[i % vals.length]));
  }
  return river;
}

/** 狙った危険度帯になるツモ牌を選ぶ。 */
function pickDrawnTile(
  rng: Rng, riverSuit: SuitPrefix, river: TileId[], band: Situation['dangerBand'],
): TileId {
  const riverSet = new Set(river);
  if (band === 'genbutsu') {
    const g = river.find((t) => !HONORS.includes(t as HonorTileId));
    if (g) return g;
    return river[0];
  }
  if (band === 'suji') {
    // river の数牌 X に対する X±3 を返す
    for (const t of river) {
      if (HONORS.includes(t as HonorTileId)) continue;
      const v = Number(t.slice(3));
      for (const d of [v - 3, v + 3]) {
        if (d >= 1 && d <= 9) {
          const cand = suitedId(riverSuit, d);
          if (!riverSet.has(cand)) return cand;
        }
      }
    }
  }
  // muji: river にも河のスジにもない中張、無ければ生牌の役牌
  for (const v of rng.shuffle([4, 5, 3, 6, 2])) {
    const cand = suitedId(riverSuit, v);
    if (!riverSet.has(cand)) {
      const isSuji = [v - 3, v + 3].some((d) => d >= 1 && d <= 9 && riverSet.has(suitedId(riverSuit, d)));
      if (!isSuji) return cand;
    }
  }
  return rng.pick(HONORS.filter((h) => !riverSet.has(h)));
}

function construct(rng: Rng, profile: Profile): PushFoldProblem | null {
  const sit = pickSituation(rng, profile);
  const [handSuit, waitSuit, riverSuit] = rng.shuffle([...SUITS]);
  const { hand, waitTiles } = buildTenpaiHand(rng, handSuit, waitSuit, sit.shape);
  const river = buildOppRiver(rng, riverSuit, sit.round);
  const drawn = pickDrawnTile(rng, riverSuit, river, sit.dangerBand);
  const doraInd = rng.pick(HONORS);

  const state: GameState = {
    round: sit.round,
    playerHand: sortTileIds([...hand, drawn]),
    opponents: [{
      seat: 'kamicha', riichi: true, river,
      riichiTileIndex: river.length - 1, melds: [],
    }],
    doraIndicators: [doraInd],
    extraVisible: [],
    objective: 'betaori',
  };

  // 待ち枚数: 4 * 待ち種類 − 場に見えている分 − わざと減らす分。
  const visible = toCounts([...state.playerHand, ...river, doraInd]);
  let waitCount = 0;
  for (const w of new Set(waitTiles)) {
    waitCount += Math.max(0, 4 - (visible.get(w) ?? 0));
  }
  waitCount = Math.max(1, waitCount - sit.killWait * 2);

  const drawnTileSafety = evaluateTileSafety(drawn, state);
  const oppValue = 5000 + (state.doraIndicators.length - 1) * 800;

  const result = evaluatePushFold({
    round: sit.round,
    shape: sit.shape,
    waitCount,
    myPoints: sit.points,
    pushTileDealIn: dealInProbFromSafety(drawnTileSafety.score, drawnTileSafety.completeSafety),
    oppValue,
  });

  // プロファイルの意図と食い違う clear_* は捨てる。
  if (profile === 'clear_push' && result.recommend !== 'push') return null;
  if (profile === 'clear_fold' && result.recommend !== 'fold') return null;
  if (profile !== 'close' && result.close) return null;

  return {
    id: `pf-${profile}`,
    difficulty: profile === 'close' ? 4 : 3,
    state,
    drawnTile: drawn,
    tenpai: { shape: sit.shape, waitCount, points: sit.points, waitTiles: [...new Set(waitTiles)] },
    drawnTileSafety,
    result,
    recommend: result.recommend,
  };
}

const PROFILES: Profile[] = ['clear_push', 'clear_push', 'clear_fold', 'clear_fold', 'close', 'close', 'close'];

export function generatePushFold(seed: number, maxAttempts = 120): PushFoldProblem {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rng = makeRng(seed + attempt * 7919);
    const profile = PROFILES[(seed + attempt) % PROFILES.length];
    const p = construct(rng, profile);
    if (p) {
      // 牌枚数の健全性チェック。
      const counts = toCounts([
        ...p.state.playerHand,
        ...p.state.opponents.flatMap((o) => o.river),
        ...p.state.doraIndicators,
      ]);
      if ([...counts.values()].every((n) => n <= 4) && p.state.playerHand.length === 14) {
        return { ...p, id: `pf-${seed}-${attempt}` };
      }
    }
  }
  // フォールバック（まず来ない）: 素直な現物押し。
  const rng = makeRng(seed);
  const forced = construct(rng, 'clear_push');
  if (forced) return { ...forced, id: `pf-${seed}-fallback` };
  throw new Error('generatePushFold: 生成に失敗しました');
}
