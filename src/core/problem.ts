import type { GameState } from './gameState';
import type { HandAnalysis } from './safety/analyzer';
import type { TileId } from './tiles';

export interface Problem {
  id: string;
  theme: string;
  /** 難易度 1〜5。 */
  difficulty: number;
  tags: string[];
  state: GameState;
  /** 生成時に安全判定エンジンで計算した正解・ランキング。 */
  analysis: HandAnalysis;
  /** 正解として扱う牌（analysis.correctAnswers のコピー）。 */
  correctAnswers: TileId[];
  /** 最も推奨する 1 枚。 */
  preferred: TileId;
}
