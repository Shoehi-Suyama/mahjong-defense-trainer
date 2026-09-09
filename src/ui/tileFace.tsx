// 牌の絵柄。仕様 #12 より Unicode 麻雀牌（🀇 等）はメイン表示に使わない。
// いまは SVG で描画し、将来ここに牌画像スプライトを差し込めるよう
// Tile.tsx からはこのモジュール経由でのみ絵柄を取得する。

import {
  isHonorId, rankOf, suitOf, tileLabel, type SuitPrefix, type TileId,
} from '../core/tiles';

const SUIT_COLOR: Record<SuitPrefix, string> = {
  man: '#b0281a',
  pin: '#14507a',
  sou: '#1f6f3a',
};
const SUIT_KANJI: Record<SuitPrefix, string> = { man: '萬', pin: '筒', sou: '索' };

const HONOR_TEXT: Record<string, { text: string; color: string }> = {
  east: { text: '東', color: '#20242b' },
  south: { text: '南', color: '#20242b' },
  west: { text: '西', color: '#20242b' },
  north: { text: '北', color: '#20242b' },
  green: { text: '發', color: '#1f6f3a' },
  red: { text: '中', color: '#b0281a' },
  // 白は枠のみ
};

interface FaceProps {
  id: TileId;
  /** 赤ドラ表示（赤5）。 */
  red?: boolean;
}

/** 単体の牌の絵柄（viewBox 60x84 の <svg>）。 */
export default function TileFace({ id, red = false }: FaceProps) {
  return (
    <svg
      className="tile-face"
      viewBox="0 0 60 84"
      role="img"
      aria-label={red ? `赤${tileLabel(id)}` : tileLabel(id)}
    >
      <rect x="1.5" y="1.5" width="57" height="81" rx="7" className="tile-face-bg" />
      {renderGlyph(id, red)}
    </svg>
  );
}

function renderGlyph(id: TileId, red: boolean) {
  if (isHonorId(id)) {
    if (id === 'white') {
      return <rect x="15" y="20" width="30" height="44" rx="3" fill="none" stroke="#14507a" strokeWidth="2.5" />;
    }
    const h = HONOR_TEXT[id];
    return (
      <text x="30" y="46" className="tile-glyph tile-glyph-honor" fill={h.color}>{h.text}</text>
    );
  }

  const suit = suitOf(id) as SuitPrefix;
  const n = rankOf(id);
  const color = red ? '#c62828' : SUIT_COLOR[suit];
  return (
    <>
      <text x="30" y="40" className="tile-glyph tile-glyph-num" fill={color}>{n}</text>
      <text x="30" y="68" className="tile-glyph tile-glyph-suit" fill={color}>{SUIT_KANJI[suit]}</text>
    </>
  );
}
