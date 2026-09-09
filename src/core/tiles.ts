// 牌データモデル。画像・UI には一切依存しない（仕様 #12, #72, #73）。
// 記譜 "123m 45p 6s 東白" ⇔ TileId[] の相互変換もここが担当する。

export type SuitPrefix = 'man' | 'pin' | 'sou';
export type Suit = SuitPrefix | 'honor';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SuitedTileId = `${SuitPrefix}${Rank}`;
export type HonorTileId =
  | 'east' | 'south' | 'west' | 'north'
  | 'white' | 'green' | 'red';
export type TileId = SuitedTileId | HonorTileId;

const HONOR_ORDER: HonorTileId[] = ['east', 'south', 'west', 'north', 'white', 'green', 'red'];
const WIND_IDS: HonorTileId[] = ['east', 'south', 'west', 'north'];
const DRAGON_IDS: HonorTileId[] = ['white', 'green', 'red'];
const SUIT_PREFIXES: SuitPrefix[] = ['man', 'pin', 'sou'];

/** 全 34 種（man1..9, pin1..9, sou1..9, 東南西北白發中）。 */
export const ALL_TILE_IDS: TileId[] = [
  ...SUIT_PREFIXES.flatMap((p) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${p}${n}` as SuitedTileId)),
  ...HONOR_ORDER,
];

const HONOR_LABEL: Record<HonorTileId, string> = {
  east: '東', south: '南', west: '西', north: '北', white: '白', green: '發', red: '中',
};
const SUIT_KANJI: Record<SuitPrefix, string> = { man: '萬', pin: '筒', sou: '索' };

export function isHonorId(id: TileId): id is HonorTileId {
  return (HONOR_ORDER as string[]).includes(id);
}

export function suitOf(id: TileId): Suit {
  return isHonorId(id) ? 'honor' : (id.slice(0, 3) as SuitPrefix);
}

/** 数牌の数字（字牌は 0 を返す）。 */
export function rankOf(id: TileId): number {
  return isHonorId(id) ? 0 : Number(id.slice(3));
}

export function suitedId(suit: SuitPrefix, rank: number): SuitedTileId {
  return `${suit}${rank as Rank}` as SuitedTileId;
}

export function isWind(id: TileId): boolean {
  return (WIND_IDS as string[]).includes(id);
}
export function isDragon(id: TileId): boolean {
  return (DRAGON_IDS as string[]).includes(id);
}
/** 1・9 の数牌。 */
export function isTerminal(id: TileId): boolean {
  const r = rankOf(id);
  return r === 1 || r === 9;
}
/** 么九牌（1・9・字牌）。 */
export function isYaochu(id: TileId): boolean {
  return isHonorId(id) || isTerminal(id);
}
/** 中張牌（2〜8 の数牌）。 */
export function isSimple(id: TileId): boolean {
  return !isYaochu(id);
}

/** ドラ表示牌 → ドラ本体。数牌は 9→1、風は 北→東、三元は 中→白 で循環。 */
export function doraFromIndicator(indicator: TileId): TileId {
  if (isWind(indicator)) {
    const i = WIND_IDS.indexOf(indicator as HonorTileId);
    return WIND_IDS[(i + 1) % WIND_IDS.length];
  }
  if (isDragon(indicator)) {
    const i = DRAGON_IDS.indexOf(indicator as HonorTileId);
    return DRAGON_IDS[(i + 1) % DRAGON_IDS.length];
  }
  const suit = suitOf(indicator) as SuitPrefix;
  const v = rankOf(indicator);
  return suitedId(suit, v === 9 ? 1 : v + 1);
}

/** ドラ表示牌の一覧から、ドラ本体の集合を返す（仕様 #40）。 */
export function doraTiles(indicators: TileId[]): Set<TileId> {
  return new Set(indicators.map(doraFromIndicator));
}

const SUIT_SORT: Record<Suit, number> = { man: 0, pin: 1, sou: 2, honor: 3 };

export function compareTileIds(a: TileId, b: TileId): number {
  const sa = suitOf(a);
  const sb = suitOf(b);
  if (sa !== sb) return SUIT_SORT[sa] - SUIT_SORT[sb];
  if (sa === 'honor') return HONOR_ORDER.indexOf(a as HonorTileId) - HONOR_ORDER.indexOf(b as HonorTileId);
  return rankOf(a) - rankOf(b);
}

export function sortTileIds(ids: TileId[]): TileId[] {
  return [...ids].sort(compareTileIds);
}

export function tileLabel(id: TileId): string {
  if (isHonorId(id)) return HONOR_LABEL[id];
  return `${rankOf(id)}${SUIT_KANJI[suitOf(id) as SuitPrefix]}`;
}

export function toCounts(ids: TileId[]): Map<TileId, number> {
  const m = new Map<TileId, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

/** 重複を除いた牌の一覧（並び順は標準ソート）。 */
export function uniqueTiles(ids: TileId[]): TileId[] {
  return sortTileIds([...new Set(ids)]);
}

// ---- 記譜パーサ（出題データ・テスト用） ----

const NOTATION_HONOR: Record<string, HonorTileId> = {
  東: 'east', 南: 'south', 西: 'west', 北: 'north',
  白: 'white', 發: 'green', 発: 'green', 中: 'red',
};

/**
 * "123m 99p 東東 5z" のような記譜を TileId[] に展開する。
 * m/p/s = 萬筒索、z = 字牌（1..7 = 東南西北白發中）、漢字の字牌も可。
 */
export function parseTiles(notation: string): TileId[] {
  const out: TileId[] = [];
  for (const group of notation.trim().split(/\s+/).filter(Boolean)) {
    const suit = group[group.length - 1];
    if (suit === 'm' || suit === 'p' || suit === 's') {
      const prefix = ({ m: 'man', p: 'pin', s: 'sou' } as const)[suit];
      for (const ch of group.slice(0, -1)) out.push(suitedId(prefix, Number(ch)));
    } else if (suit === 'z') {
      for (const ch of group.slice(0, -1)) out.push(HONOR_ORDER[Number(ch) - 1]);
    } else {
      for (const ch of group) {
        const h = NOTATION_HONOR[ch];
        if (!h) throw new Error(`parseTiles: 解釈できない記譜 "${group}"`);
        out.push(h);
      }
    }
  }
  return out;
}

/** TileId[] を "123m 45p 東" 形式の記譜へ戻す（デバッグ・表示用）。 */
export function toNotation(ids: TileId[]): string {
  const sorted = sortTileIds(ids);
  const parts: string[] = [];
  let curSuit: Suit | null = null;
  let buf = '';
  const flush = () => {
    if (!buf) return;
    if (curSuit === 'honor') parts.push(buf);
    else parts.push(buf + ({ man: 'm', pin: 'p', sou: 's' } as const)[curSuit as SuitPrefix]);
    buf = '';
  };
  for (const id of sorted) {
    const s = suitOf(id);
    if (s !== curSuit) { flush(); curSuit = s; }
    buf += s === 'honor' ? tileLabel(id) : String(rankOf(id));
  }
  flush();
  return parts.join(' ');
}
