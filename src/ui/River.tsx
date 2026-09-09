import type { Meld } from '../core/gameState';
import type { TileId } from '../core/tiles';
import Tile from './Tile';

interface RiverProps {
  tiles: TileId[];
  riichiIndex?: number;
  /** 1 行あたりの枚数。 */
  perRow?: number;
}

/** リーチ者の河。実際の卓に近く、6 枚ずつ折り返す（仕様 #38）。 */
export function River({ tiles, riichiIndex, perRow = 6 }: RiverProps) {
  return (
    <div className="river" style={{ gridTemplateColumns: `repeat(${perRow}, auto)` }}>
      {tiles.map((t, i) => (
        <Tile key={i} id={t} size="sm" rotated={i === riichiIndex} />
      ))}
    </div>
  );
}

export function Melds({ melds }: { melds: Meld[] }) {
  if (melds.length === 0) return null;
  return (
    <div className="melds">
      {melds.map((m, i) => (
        <div key={i} className="meld">
          {m.tiles.map((t, j) => <Tile key={j} id={t} size="sm" />)}
        </div>
      ))}
    </div>
  );
}
