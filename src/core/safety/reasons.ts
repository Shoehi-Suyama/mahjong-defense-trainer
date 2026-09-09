// 安全根拠コードと、その表示ラベル・★の目安（仕様 #15, #43, #44, #54）。
// ★は「固定確率」ではなく「現在の情報でどんな待ちを否定できるか」の目安。

export type ReasonCode =
  | 'genbutsu'
  | 'double_genbutsu'
  | 'all_visible'
  | 'kabe_nochance'
  | 'one_chance'
  | 'naka_suji'
  | 'suji'
  | 'terminal_suji'
  | 'honor_three'
  | 'honor_two'
  | 'honor_live'
  | 'terminal'
  | 'early_outside'
  | 'no_info';

export const REASON_LABEL: Record<ReasonCode, string> = {
  genbutsu: '現物',
  double_genbutsu: 'ダブル現物',
  all_visible: '4枚見え',
  kabe_nochance: '壁（ノーチャンス）',
  one_chance: 'ワンチャンス',
  naka_suji: '中スジ',
  suji: '片スジ',
  terminal_suji: '端牌スジ',
  honor_three: '字牌 3枚見え',
  honor_two: '字牌 2枚見え',
  honor_live: '字牌 生牌',
  terminal: '端牌',
  early_outside: '序盤の外側',
  no_info: '無スジ',
};

/** 一覧・学習モードで使う ★ の目安（1〜5）。 */
export const REASON_STAR_GUIDE: Record<ReasonCode, number> = {
  genbutsu: 5,
  double_genbutsu: 5,
  all_visible: 5,
  kabe_nochance: 4,
  terminal_suji: 4,
  one_chance: 3,
  naka_suji: 3,
  honor_three: 4,
  honor_two: 3,
  suji: 2,
  honor_live: 2,
  terminal: 2,
  early_outside: 2,
  no_info: 1,
};
