// IMG_5688.jpeg（610x340, 9列×4行）から34牌を切り出す。
// 点数計算トレーニングアプリ（mahjong-trainer）と同じ牌画像・同じ切り出しロジック。
// 牌データ（TileId）と画像の対応はここだけが知っている。

import spriteUrl from '../assets/tiles/IMG_5688.jpeg';
import { type TileId } from '../core/tiles';

/**
 * グリッド幾何（元画像 610x340 ピクセル基準、中心＋ピッチモデル）。
 * 実測: 列ピッチ65.4 / 行ピッチ76.2、左上セル中心 (43, 55)。
 */
export const SPRITE = {
  imageWidth: 610,
  imageHeight: 340,
  firstCenterX: 43,
  firstCenterY: 55,
  pitchX: 65.4,
  pitchY: 76.2,
  cellW: 60,
  cellH: 74,
};

// (row, col) → TileId
const ROW_TILES: TileId[][] = [
  ['east', 'south', 'west', 'north', 'white', 'green', 'red'],
  ['man1', 'man2', 'man3', 'man4', 'man5', 'man6', 'man7', 'man8', 'man9'],
  ['pin1', 'pin2', 'pin3', 'pin4', 'pin5', 'pin6', 'pin7', 'pin8', 'pin9'],
  ['sou1', 'sou2', 'sou3', 'sou4', 'sou5', 'sou6', 'sou7', 'sou8', 'sou9'],
];

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function tileGridPos(id: TileId): { row: number; col: number } {
  for (let r = 0; r < ROW_TILES.length; r++) {
    const c = ROW_TILES[r].indexOf(id);
    if (c >= 0) return { row: r, col: c };
  }
  throw new Error(`tileGridPos: 未知の牌 ${id}`);
}

export function cellRect(id: TileId): CellRect {
  const { row, col } = tileGridPos(id);
  const cx = SPRITE.firstCenterX + col * SPRITE.pitchX;
  const cy = SPRITE.firstCenterY + row * SPRITE.pitchY;
  return { x: cx - SPRITE.cellW / 2, y: cy - SPRITE.cellH / 2, w: SPRITE.cellW, h: SPRITE.cellH };
}

let slicedCache: Map<TileId, string> | null = null;
let slicing: Promise<Map<TileId, string>> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 34牌を個別の data URL に分割する（初回のみ実行、以降キャッシュ）。 */
export async function sliceTiles(): Promise<Map<TileId, string>> {
  if (slicedCache) return slicedCache;
  if (slicing) return slicing;

  slicing = (async () => {
    const img = await loadImage(spriteUrl);
    const scaleX = img.naturalWidth / SPRITE.imageWidth;
    const scaleY = img.naturalHeight / SPRITE.imageHeight;
    const out = new Map<TileId, string>();

    for (const row of ROW_TILES) {
      for (const id of row) {
        const r = cellRect(id);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(r.w * scaleX);
        canvas.height = Math.round(r.h * scaleY);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(
          img,
          r.x * scaleX, r.y * scaleY, r.w * scaleX, r.h * scaleY,
          0, 0, canvas.width, canvas.height,
        );
        out.set(id, canvas.toDataURL('image/png'));
      }
    }
    slicedCache = out;
    return out;
  })();

  return slicing;
}

export { spriteUrl };
