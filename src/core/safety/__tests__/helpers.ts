import { ALL_TILE_IDS, parseTiles, type TileId } from '../../tiles';
import type { GameState, Meld, Opponent, Seat } from '../../gameState';

const TILE_SET = new Set<string>(ALL_TILE_IDS);

/** "man5 8s 白" のように TileId と記譜を混在して書ける簡易パーサ（テスト専用）。 */
export function tiles(spec: string): TileId[] {
  const out: TileId[] = [];
  for (const tok of spec.trim().split(/\s+/).filter(Boolean)) {
    if (TILE_SET.has(tok)) out.push(tok as TileId);
    else out.push(...parseTiles(tok));
  }
  return out;
}

export function river(spec: string): TileId[] {
  return tiles(spec);
}

export function opponent(opts: {
  seat?: Seat;
  riichi?: boolean;
  river: string;
  riichiTileIndex?: number;
  melds?: Meld[];
}): Opponent {
  return {
    seat: opts.seat ?? 'kamicha',
    riichi: opts.riichi ?? true,
    river: tiles(opts.river),
    riichiTileIndex: opts.riichiTileIndex,
    melds: opts.melds ?? [],
  };
}

export function state(opts: {
  round?: number;
  hand: string;
  opponents: Opponent[];
  dora?: string;
  extra?: string;
}): GameState {
  return {
    round: opts.round ?? 8,
    playerHand: tiles(opts.hand),
    opponents: opts.opponents,
    doraIndicators: opts.dora ? tiles(opts.dora) : [],
    extraVisible: opts.extra ? tiles(opts.extra) : [],
    objective: 'betaori',
  };
}
