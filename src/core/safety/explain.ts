// 判定結果（プログラムが出した事実）を、日本語の説明文へ変換する（仕様 #22-24, #27, #44, #71, #72）。
// AI は使わない。テンプレートの組み立てのみ。

import { tileLabel, type TileId } from '../tiles';
import type { ReasonCode } from './reasons';
import type { WaitAnalysis, WaitKind } from './waits';

export const WAIT_LABEL: Record<WaitKind, string> = {
  ryanmen: '両面',
  penchan: 'ペンチャン',
  kanchan: 'カンチャン',
  shanpon: 'シャンポン',
  tanki: '単騎',
};

function joinTiles(ids: TileId[]): string {
  return ids.map(tileLabel).join('');
}
function listWaits(kinds: WaitKind[]): string {
  return [...new Set(kinds)].map((k) => WAIT_LABEL[k]).join('・');
}

export interface ExplainInput {
  tile: TileId;
  primary: ReasonCode;
  reasons: ReasonCode[];
  w: WaitAnalysis;
  dangerousWaits: WaitKind[];
  completeSafety: boolean;
  /** 序盤にこの牌の近くを切っている場合の該当牌。 */
  earlyOutsideNear?: TileId;
}

/** 「なぜ安全なのか」本文。 */
export function buildExplanation(input: ExplainInput): string {
  const { tile, primary, w, dangerousWaits, completeSafety } = input;
  const name = tileLabel(tile);
  const lines: string[] = [];

  switch (primary) {
    case 'genbutsu':
      lines.push(`${name}はリーチ者の河にあります（現物）。`);
      lines.push('リーチ者は自分が捨てた牌ではロンできない（振り聴）ため、この牌でリーチ者に放銃することはありません。');
      lines.push('ベタオリを目的とするなら、最優先で切れる牌です。');
      break;
    case 'double_genbutsu':
      lines.push(`${name}は警戒中の複数のリーチ者すべてに対して現物です。`);
      lines.push('どのリーチ者からもロンされないため、最も安全な牌のひとつです。');
      break;
    case 'all_visible':
      lines.push(`${name}は場に4枚すべて見えています。`);
      lines.push('リーチ者はこの牌を1枚も持てないため、当たりようがありません（単騎・シャンポンも不可）。');
      break;
    case 'kabe_nochance': {
      const walls = w.deadShapes.filter((d) => d.reason === 'wall');
      const wallTiles = [...new Set(walls.map((d) => d.deadTile!).filter(Boolean))];
      lines.push(`${wallTiles.map(tileLabel).join('・')}が場に4枚見えています（壁）。`);
      lines.push(`そのため ${walls.map((d) => joinTiles(d.tiles)).join(' / ')} という順子待ちは作れません。`);
      lines.push(`${name}に対する${'両面'}待ちが否定できるため、比較的安全です。`);
      break;
    }
    case 'terminal_suji':
    case 'suji':
    case 'naka_suji': {
      const sujiKills = w.deadShapes.filter((d) => d.reason === 'suji');
      const partners = [...new Set(sujiKills.map((d) => d.deadTile!).filter(Boolean))];
      lines.push(`リーチ者が${partners.map(tileLabel).join('・')}を切っています。`);
      lines.push(`そのため ${sujiKills.map((d) => joinTiles(d.tiles)).join(' / ')} の両面待ち（${name}を含む）は振り聴でロンできません。`);
      if (primary === 'naka_suji') {
        lines.push(`${name}は両側のスジが通っているため、両面待ちに対しては安全です。`);
      } else if (primary === 'terminal_suji') {
        lines.push(`${name}は端牌で、スジが通ると当たり得る形がシャンポン・単騎までほぼ限定されます。`);
      } else {
        lines.push(`ただし片側のスジのみで、反対側の両面やカンチャンなどは残ります。「安全」ではなく「比較的安全」です。`);
      }
      break;
    }
    case 'one_chance': {
      const oc = w.unlikelyShapes;
      lines.push(`${name}に当たる順子待ちの構成牌が場に3枚見えています（ワンチャンス）。`);
      lines.push(`${oc.map((s) => joinTiles(s.tiles)).join(' / ')} の形は残り1枚でしか作れないため、可能性は低めです。`);
      lines.push('4枚見え（壁）ほど確実ではなく、完全安全ではありません。');
      break;
    }
    case 'honor_three':
      lines.push(`${name}は場に3枚見えています。`);
      lines.push('リーチ者はこの牌を2枚持てないため、シャンポン待ちはありません。残るのは最後の1枚での単騎のみです。');
      break;
    case 'honor_two':
      lines.push(`${name}は場に2枚見えています。`);
      lines.push('シャンポン・単騎の可能性は残りますが、生牌の字牌よりは危険度が下がります。');
      break;
    case 'honor_live':
      lines.push(`${name}はまだ場に見えていない生牌の字牌です。`);
      lines.push('現物やスジのように待ちを否定する情報がないため、シャンポン・単騎に当たる可能性があります。');
      break;
    case 'terminal':
      lines.push(`${name}は端牌のため、中張牌より当たる待ちの種類は少なめです。`);
      lines.push('ただしスジや壁の裏づけがないため、両面（ペンチャン）・シャンポン・単騎には当たり得ます。');
      break;
    case 'early_outside':
      lines.push(`リーチ者が序盤に${input.earlyOutsideNear ? tileLabel(input.earlyOutsideNear) : 'この付近の牌'}を切っています。`);
      lines.push('その外側の牌は、その周辺を使った手を相手が持ちにくいという読みが立ちます（確定情報ではありません）。');
      break;
    case 'no_info':
    default:
      lines.push(`${name}は無スジで、待ちを否定する情報がありません。`);
      lines.push('両面・カンチャン・ペンチャン・シャンポン・単騎、いずれにも当たり得ます。放銃リスクが高い牌です。');
      break;
  }

  if (!completeSafety && dangerousWaits.length > 0 && primary !== 'no_info' && primary !== 'terminal') {
    lines.push(`残っている可能性: ${listWaits(dangerousWaits)}。`);
  }
  return lines.join('\n');
}

/** 「なぜ他の牌ではなくこの牌なのか」の比較文（仕様 #27）。 */
export function buildComparison(
  chosen: { tile: TileId; label: string; level: number },
  preferred: { tile: TileId; label: string; level: number },
): string {
  if (chosen.tile === preferred.tile) return '';
  const c = tileLabel(chosen.tile);
  const p = tileLabel(preferred.tile);
  if (chosen.level >= 4) {
    return `${c}も${chosen.label}なので大きな誤りではありません。ただしベタオリでは${p}（${preferred.label}）の方がより確実です。`;
  }
  if (chosen.level >= 2) {
    return `${c}は${chosen.label}なので「比較的安全」ですが、${p}は${preferred.label}です。ベタオリなら ${p} ＞ ${c} と評価します。`;
  }
  return `${c}は${chosen.label}で放銃リスクが高い牌です。${p}が${preferred.label}なので、ベタオリなら${p}を切るべきです。`;
}
