import { useEffect, useState } from 'react';
import { sliceTiles } from './tileSprite';
import type { TileId } from '../core/tiles';

let cache: Map<TileId, string> | null = null;

/** 34牌の切り出し画像（TileId → data URL）。初回に一度だけ分割する。 */
export function useTileImages(): Map<TileId, string> | null {
  const [images, setImages] = useState<Map<TileId, string> | null>(cache);

  useEffect(() => {
    if (cache) {
      setImages(cache);
      return;
    }
    let alive = true;
    sliceTiles()
      .then((m) => {
        cache = m;
        if (alive) setImages(m);
      })
      .catch((e) => console.error('タイル画像の分割に失敗しました', e));
    return () => {
      alive = false;
    };
  }, []);

  return images;
}
