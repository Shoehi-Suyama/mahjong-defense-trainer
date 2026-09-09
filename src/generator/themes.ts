// 出題テーマ（仕様 #30-36, #61）。完全ランダムではなく
// 「何を学ばせる問題か」を先に決めてから局面を生成する。

import type { ReasonCode } from '../core/safety/reasons';

export type ThemeId =
  | 'genbutsu'
  | 'suji'
  | 'kabe'
  | 'one_chance'
  | 'honor'
  | 'terminal'
  | 'early_read'
  | 'furo'
  | 'compound'
  | 'double_riichi';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  short: string;
  description: string;
  /** 想定難易度（1〜5）。 */
  difficulty: number;
  /** この牌が最善手になっていれば「テーマ通り」とみなす根拠コード。 */
  expectedReasons: ReasonCode[];
}

export const THEMES: Record<ThemeId, ThemeMeta> = {
  genbutsu: {
    id: 'genbutsu',
    label: '現物',
    short: '現物',
    description: '相手の河から現物（当たらない牌）を見つける。守備の基本。',
    difficulty: 1,
    expectedReasons: ['genbutsu', 'double_genbutsu', 'all_visible'],
  },
  suji: {
    id: 'suji',
    label: 'スジ',
    short: 'スジ',
    description: '相手が切った牌からスジを読み、両面待ちに対する安全牌を探す。',
    difficulty: 2,
    expectedReasons: ['suji', 'naka_suji', 'terminal_suji'],
  },
  kabe: {
    id: 'kabe',
    label: '壁',
    short: '壁',
    description: '場に4枚見えている牌（壁）を使って、両面待ちを否定する。',
    difficulty: 3,
    expectedReasons: ['kabe_nochance'],
  },
  one_chance: {
    id: 'one_chance',
    label: 'ワンチャンス',
    short: 'ワンチャンス',
    description: '3枚見えの牌を利用する。壁ほど確実ではないことを理解する。',
    difficulty: 3,
    expectedReasons: ['one_chance'],
  },
  honor: {
    id: 'honor',
    label: '字牌',
    short: '字牌',
    description: '字牌の安全度は「場に何枚見えているか」で大きく変わる。',
    difficulty: 2,
    expectedReasons: ['honor_three'],
  },
  terminal: {
    id: 'terminal',
    label: '端牌',
    short: '端牌',
    description: '1・9は当たる待ちが少なめだが、無条件で安全ではない。',
    difficulty: 2,
    expectedReasons: ['terminal_suji', 'terminal', 'suji'],
  },
  early_read: {
    id: 'early_read',
    label: '序盤の外側',
    short: '河読み',
    description: '相手が序盤に切った数牌の外側を読む。確定情報ではないが無スジよりは根拠がある。',
    difficulty: 3,
    expectedReasons: ['early_outside'],
  },
  furo: {
    id: 'furo',
    label: '副露',
    short: '副露',
    description: '鳴いている相手。リーチはないがテンパイ気配。副露牌も壁・ワンチャンスの材料になる。',
    difficulty: 3,
    expectedReasons: ['kabe_nochance', 'one_chance', 'genbutsu'],
  },
  compound: {
    id: 'compound',
    label: '複合',
    short: '複合',
    description: '現物・スジ・ワンチャンス・無スジを並べ、最も安全な牌を選ぶ。',
    difficulty: 4,
    expectedReasons: ['genbutsu', 'double_genbutsu', 'all_visible'],
  },
  double_riichi: {
    id: 'double_riichi',
    label: 'ダブルリーチ',
    short: '複数リーチ',
    description: '2人リーチ。片方の現物でももう片方に危険なことがある。両方に安全な牌を選ぶ。',
    difficulty: 4,
    expectedReasons: ['double_genbutsu', 'genbutsu'],
  },
};

export const THEME_ORDER: ThemeId[] = [
  'genbutsu', 'suji', 'kabe', 'one_chance', 'honor', 'terminal',
  'early_read', 'furo', 'compound', 'double_riichi',
];
