// 局面のデータモデル（仕様 #41）。安全判定エンジンはこの型だけを見る。

import type { TileId } from './tiles';

export type Seat = 'kamicha' | 'toimen' | 'shimocha';

export const SEAT_LABEL: Record<Seat, string> = {
  kamicha: '上家',
  toimen: '対面',
  shimocha: '下家',
};

export interface Meld {
  type: 'chi' | 'pon' | 'kan';
  tiles: TileId[];
}

export interface Opponent {
  seat: Seat;
  /** リーチ済みか。 */
  riichi: boolean;
  /** 捨て牌（切った順）。 */
  river: TileId[];
  /** リーチ宣言牌の river インデックス（0 始まり）。riichi=false のときは無視。 */
  riichiTileIndex?: number;
  melds: Meld[];
  /** テンパイが濃厚だがリーチしていない相手（副露リーチ気配など）。将来用。 */
  tenpaiLikely?: boolean;
}

export type Objective = 'betaori';

export interface GameState {
  /** 巡目。 */
  round: number;
  /** 自分の手牌（14 枚。ここから 1 枚切る）。 */
  playerHand: TileId[];
  /** 警戒対象の相手（Phase 1 では 1 人）。 */
  opponents: Opponent[];
  /** ドラ表示牌。 */
  doraIndicators: TileId[];
  /**
   * 河・手牌・副露・ドラ表示牌以外に「場に見えている」牌
   * （他家の河など、簡易表現）。壁判定の集計に加算される。
   */
  extraVisible: TileId[];
  objective: Objective;
}

/** 壁・ワンチャンス判定用に「場に見えている」全牌を集める。 */
export function collectVisibleTiles(state: GameState): TileId[] {
  const out: TileId[] = [...state.playerHand, ...state.doraIndicators, ...state.extraVisible];
  for (const opp of state.opponents) {
    out.push(...opp.river);
    for (const m of opp.melds) out.push(...m.tiles);
  }
  return out;
}

/** 警戒対象（リーチ済み or テンパイ気配の副露者）。ベタオリの主対象。 */
export function threateningOpponents(state: GameState): Opponent[] {
  return state.opponents.filter((o) => o.riichi || o.tenpaiLikely);
}
