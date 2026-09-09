import type { KeyboardEvent } from 'react';
import { tileLabel, type TileId } from '../core/tiles';
import TileFace from './tileFace';

export type TileSize = 'sm' | 'md' | 'lg';

interface TileProps {
  id: TileId;
  size?: TileSize;
  red?: boolean;
  /** クリックで選択できる牌にする。 */
  onSelect?: (id: TileId) => void;
  selected?: boolean;
  disabled?: boolean;
  /** 正解・不正解などの装飾。 */
  mark?: 'correct' | 'preferred' | 'chosen-wrong' | 'dim';
  /** 河のリーチ宣言牌を横向きにする。 */
  rotated?: boolean;
  /** ドラ表示（放銃時の失点が大きい・仕様 #40）。 */
  dora?: boolean;
}

export default function Tile({
  id, size = 'md', red = false, onSelect, selected = false, disabled = false, mark, rotated = false, dora = false,
}: TileProps) {
  const clickable = !!onSelect && !disabled;
  const cls = [
    'tile', `tile-${size}`,
    selected ? 'tile-selected' : '',
    clickable ? 'tile-clickable' : '',
    disabled ? 'tile-disabled' : '',
    rotated ? 'tile-rotated' : '',
    dora ? 'tile-dora' : '',
    mark ? `tile-mark-${mark}` : '',
  ].filter(Boolean).join(' ');

  const activate = () => clickable && onSelect!(id);
  const onKey = (e: KeyboardEvent) => {
    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      activate();
    }
  };

  return (
    <span
      className={cls}
      onClick={activate}
      onKeyDown={onKey}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${tileLabel(id)}を切る` : undefined}
      aria-pressed={clickable ? selected : undefined}
    >
      <TileFace id={id} red={red} />
      {dora && <span className="tile-dora-badge" aria-hidden="true">ドラ</span>}
    </span>
  );
}
