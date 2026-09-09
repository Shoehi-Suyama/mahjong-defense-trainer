// 「その牌がどんな待ちに当たり得るか」を、場の情報から機械的に洗い出す。
// スジ・現物・壁の判定はすべてここへ集約する（仕様 #16, #17, #18, #42, #73）。
//
// 待ちの分類:
//   ryanmen 両面 / penchan ペンチャン / kanchan カンチャン / shanpon シャンポン / tanki 単騎
// 面子の形（数牌 T に当たる順子待ち）:
//   kanchan   : [T-1, T+1]                （2..8）
//   lowerRun  : [T-2, T-1]  → T=3 はペンチャン、T>=4 は両面（スジ相手 T-3）
//   upperRun  : [T+1, T+2]  → T=7 はペンチャン、T<=6 は両面（スジ相手 T+3）

import {
  isHonorId, rankOf, suitOf, suitedId, toCounts,
  type SuitPrefix, type Suit, type TileId,
} from '../tiles';
import { collectVisibleTiles, type GameState, type Opponent } from '../gameState';

export type WaitKind = 'ryanmen' | 'penchan' | 'kanchan' | 'shanpon' | 'tanki';

export interface ShapeInfo {
  kind: WaitKind;
  /** 相手が持っていると想定される 2 枚。 */
  tiles: TileId[];
  /** 両面のときのスジ相手（この牌が河にあると振り聴で消える）。 */
  sujiPartner?: TileId;
}

export interface DeadShape extends ShapeInfo {
  /** suji = 振り聴で消えた / wall = 壁（4 枚見え）で作れない。 */
  reason: 'suji' | 'wall';
  deadTile?: TileId;
}

export interface WaitAnalysis {
  tile: TileId;
  suit: Suit;
  /** 相手の河に同じ牌がある（現物）。 */
  genbutsu: boolean;
  /** 現物ではないが 4 枚すべて見えている → 相手は持てない。 */
  allVisible: boolean;
  /** まだ完全に生きている順子待ちの形。 */
  liveShapes: ShapeInfo[];
  /** 形は残るが、構成牌が 3 枚見え（ワンチャンス）で可能性が低い。 */
  unlikelyShapes: ShapeInfo[];
  /** 否定された順子待ちの形。 */
  deadShapes: DeadShape[];
  /** シャンポン待ちがあり得るか。 */
  shanpon: boolean;
  /** 単騎待ちがあり得るか。 */
  tanki: boolean;
  /** その牌が場に見えている枚数（自分の手牌を含む）。 */
  visibleCount: number;
}

function candidateShapes(tile: TileId): ShapeInfo[] {
  if (isHonorId(tile)) return [];
  const suit = suitOf(tile) as SuitPrefix;
  const t = rankOf(tile);
  const mk = (a: number, b: number): TileId[] => [suitedId(suit, a), suitedId(suit, b)];
  const shapes: ShapeInfo[] = [];

  if (t - 1 >= 1 && t + 1 <= 9) {
    shapes.push({ kind: 'kanchan', tiles: mk(t - 1, t + 1) });
  }
  if (t - 2 >= 1) {
    if (t === 3) shapes.push({ kind: 'penchan', tiles: mk(1, 2) });
    else shapes.push({ kind: 'ryanmen', tiles: mk(t - 2, t - 1), sujiPartner: suitedId(suit, t - 3) });
  }
  if (t + 2 <= 9) {
    if (t === 7) shapes.push({ kind: 'penchan', tiles: mk(8, 9) });
    else shapes.push({ kind: 'ryanmen', tiles: mk(t + 1, t + 2), sujiPartner: suitedId(suit, t + 3) });
  }
  return shapes;
}

/**
 * 1 枚の候補牌について、指定した相手（リーチ者など）への当たり得る待ちを洗い出す。
 */
export function enumerateWaits(tile: TileId, state: GameState, opp: Opponent): WaitAnalysis {
  const suit = suitOf(tile);
  const visible = toCounts(collectVisibleTiles(state));
  const visibleCount = visible.get(tile) ?? 0;
  const oppRiver = new Set(opp.river);

  const genbutsu = oppRiver.has(tile);
  const allVisible = !genbutsu && visibleCount >= 4;

  const liveShapes: ShapeInfo[] = [];
  const unlikelyShapes: ShapeInfo[] = [];
  const deadShapes: DeadShape[] = [];

  if (!genbutsu && !allVisible) {
    for (const shape of candidateShapes(tile)) {
      // 壁: 構成牌のどれかが 4 枚見え → その形は作れない。
      const wallTile = shape.tiles.find((x) => (visible.get(x) ?? 0) >= 4);
      if (wallTile) {
        deadShapes.push({ ...shape, reason: 'wall', deadTile: wallTile });
        continue;
      }
      // スジ: 両面はスジ相手が相手の河にあると振り聴で消える。
      if (shape.kind === 'ryanmen' && shape.sujiPartner && oppRiver.has(shape.sujiPartner)) {
        deadShapes.push({ ...shape, reason: 'suji', deadTile: shape.sujiPartner });
        continue;
      }
      // ワンチャンス: 構成牌のどれかが 3 枚見え → 残り 1 枚、可能性は低い。
      const oneChanceTile = shape.tiles.find((x) => (visible.get(x) ?? 0) >= 3);
      if (oneChanceTile) {
        unlikelyShapes.push(shape);
        continue;
      }
      liveShapes.push(shape);
    }
  }

  const shanpon = !genbutsu && !allVisible && visibleCount <= 2;
  const tanki = !genbutsu && !allVisible && visibleCount <= 3;

  return {
    tile, suit, genbutsu, allVisible,
    liveShapes, unlikelyShapes, deadShapes,
    shanpon, tanki, visibleCount,
  };
}

/** deadShapes のうち「スジで消えた両面」が 1 つでもあるか。 */
export function hasSujiKill(w: WaitAnalysis): boolean {
  return w.deadShapes.some((d) => d.reason === 'suji');
}
/** deadShapes のうち「壁で消えた形」が 1 つでもあるか。 */
export function hasWallKill(w: WaitAnalysis): boolean {
  return w.deadShapes.some((d) => d.reason === 'wall');
}
/** 両側のスジが通っている（中スジ、両無スジではない）か。数牌 4・5・6 のみ真になり得る。 */
export function isNakaSuji(w: WaitAnalysis): boolean {
  const ryanmen = [...w.liveShapes, ...w.unlikelyShapes, ...w.deadShapes].filter((s) => s.kind === 'ryanmen');
  const killedByS = w.deadShapes.filter((d) => d.reason === 'suji' && d.kind === 'ryanmen').length;
  return ryanmen.length >= 2 && killedByS >= 2;
}

export { candidateShapes as _candidateShapes };
export type { Suit, SuitPrefix };
