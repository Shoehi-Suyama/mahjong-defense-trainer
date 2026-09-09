// 苦手分析（仕様 #56, #57）。

import { seatLabel } from '../core/safety/analyzer';
import { tileLabel, type TileId } from '../core/tiles';
import { THEME_ORDER, THEMES } from '../generator/themes';
import { accuracy, useStats } from './useStats';

interface Props {
  onBack: () => void;
}

const VERDICT_JP: Record<string, string> = { correct: '正解', close: '惜しい', wrong: '不正解' };

function themeLabel(key: string): string {
  if (key === 'pushfold') return '押し引き';
  if (key === 'live') return '実戦形式';
  return (THEMES as Record<string, { label: string }>)[key]?.label ?? key;
}

function historyPair(h: { theme: string; tile: string; preferred: string }): string {
  if (h.theme === 'pushfold') {
    const jp = (c: string) => (c === 'push' ? '押す' : c === 'fold' ? '降りる' : c);
    return `選択: ${jp(h.tile)} / 推奨: ${jp(h.preferred)}`;
  }
  return `切: ${tileLabel(h.tile as TileId)} / 推奨: ${tileLabel(h.preferred as TileId)}`;
}

export default function StatsScreen({ onBack }: Props) {
  const { stats, reset } = useStats();
  const total = Object.values(stats.themes).reduce((n, t) => n + (t?.seen ?? 0), 0);
  const pf = stats.themes.pushfold;
  const pfAcc = accuracy(pf);
  const lv = stats.themes.live;
  const lvAcc = accuracy(lv);

  return (
    <div className="stats">
      <button className="btn btn-back" onClick={onBack}>← 戻る</button>
      <h1>成績・苦手分析</h1>
      <p className="stats-total">通算 {total} 問</p>

      <h2>テーマ別 守備力</h2>
      <table className="stats-table">
        <thead>
          <tr><th>テーマ</th><th>正解率</th><th>出題</th><th>内訳</th></tr>
        </thead>
        <tbody>
          {THEME_ORDER.map((id) => {
            const st = stats.themes[id];
            const acc = accuracy(st);
            return (
              <tr key={id}>
                <td>{THEMES[id].label}</td>
                <td className="stats-acc">
                  {acc === null ? '—' : `${Math.round(acc * 100)}%`}
                  {acc !== null && (
                    <span className="stats-bar"><span style={{ width: `${Math.round(acc * 100)}%` }} /></span>
                  )}
                </td>
                <td>{st?.seen ?? 0}</td>
                <td className="stats-breakdown">
                  {st ? `正${st.correct} 惜${st.close} 誤${st.wrong}` : '—'}
                </td>
              </tr>
            );
          })}
          <tr className="stats-row-pf">
            <td>押し引き</td>
            <td className="stats-acc">
              {pfAcc === null ? '—' : `${Math.round(pfAcc * 100)}%`}
              {pfAcc !== null && (
                <span className="stats-bar"><span style={{ width: `${Math.round(pfAcc * 100)}%` }} /></span>
              )}
            </td>
            <td>{pf?.seen ?? 0}</td>
            <td className="stats-breakdown">
              {pf ? `正${pf.correct} 際${pf.close} 誤${pf.wrong}` : '—'}
            </td>
          </tr>
          <tr>
            <td>実戦形式</td>
            <td className="stats-acc">
              {lvAcc === null ? '—' : `${Math.round(lvAcc * 100)}%`}
              {lvAcc !== null && (
                <span className="stats-bar"><span style={{ width: `${Math.round(lvAcc * 100)}%` }} /></span>
              )}
            </td>
            <td>{lv?.seen ?? 0}</td>
            <td className="stats-breakdown">
              {lv ? `正${lv.correct} 惜${lv.close} 誤${lv.wrong}` : '—'}
            </td>
          </tr>
        </tbody>
      </table>

      <h2>最近の回答</h2>
      {stats.history.length === 0 ? (
        <p>まだ記録がありません。</p>
      ) : (
        <ul className="history">
          {stats.history.slice(0, 20).map((h, i) => (
            <li key={i} className={`history-${h.verdict}`}>
              <span className="history-theme">{themeLabel(h.theme)}</span>
              <span>{VERDICT_JP[h.verdict]}</span>
              <span className="history-tiles">{historyPair(h)}</span>
              <span className="history-ms">{(h.ms / 1000).toFixed(1)}秒</span>
            </li>
          ))}
        </ul>
      )}

      <button className="btn btn-danger" onClick={() => { if (confirm('記録をすべて消去しますか？')) reset(); }}>
        記録を消去
      </button>
      <p className="stats-note">
        ※ スコア・正解率は学習用の目安です。実際の放銃率を直接表すものではありません（{seatLabel('kamicha')}リーチ想定）。
      </p>
    </div>
  );
}
