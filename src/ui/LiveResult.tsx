import { MAX_DECISION_SCORE, type LiveHand } from '../core/live';
import Tile from './Tile';
import type { LiveDecisionResult } from './LiveHandView';

interface Props {
  hand: LiveHand;
  results: LiveDecisionResult[];
  onReplay: () => void;
  onHome: () => void;
}

const MARK: Record<string, string> = { correct: '○', close: '△', wrong: '×' };
const VCLASS: Record<string, string> = {
  correct: 'verdict-correct', close: 'verdict-close', wrong: 'verdict-wrong',
};

export default function LiveResult({ hand, results, onReplay, onHome }: Props) {
  const total = results.reduce((n, r) => n + r.score, 0);
  const max = results.length * MAX_DECISION_SCORE;
  const pct = Math.round((total / max) * 100);
  const dangerous = results.some((r) => r.verdict === 'wrong' && r.chosenLevel <= 1);
  const allSafe = results.every((r) => r.verdict === 'correct');

  const headline = dangerous
    ? { cls: 'verdict-wrong', text: '危険牌あり — 実戦なら放銃の可能性' }
    : allSafe
      ? { cls: 'verdict-correct', text: 'ベタオリ完遂 — 終局まで安全に受けきった' }
      : { cls: 'verdict-close', text: 'おおむね安全 — もう一段しぼれる場面あり' };

  return (
    <div className="answer live-result">
      <div className={`verdict ${headline.cls}`}>
        <span className="verdict-label">{headline.text}</span>
        <span className="verdict-time">{hand.handLabel}</span>
      </div>

      <div className="live-score">
        <div className="live-score-big">{total} <span>/ {max} 点</span></div>
        <div className="live-score-bar"><span style={{ width: `${pct}%` }} /></div>
        <div className="live-score-pct">守備スコア {pct}%</div>
      </div>

      <section className="explain-block">
        <h3>【各判断のふり返り】</h3>
        <ol className="live-recap">
          {results.map((r, i) => (
            <li key={i} className={`live-recap-row ${VCLASS[r.verdict]}`}>
              <span className="live-recap-round">{r.round}巡目</span>
              <span className="live-recap-mark">{MARK[r.verdict]}</span>
              <span className="live-recap-tiles">
                <span>切:</span><Tile id={r.chosen} size="sm" />
                {r.chosen !== r.preferred && (
                  <><span className="live-recap-arrow">最善:</span><Tile id={r.preferred} size="sm" /></>
                )}
              </span>
              <span className="live-recap-score">+{r.score}</span>
            </li>
          ))}
        </ol>
        {results.some((r) => r.chosen !== r.preferred) && (
          <p className="explain-compare">
            ※ 2 回目以降の手牌は「理想手順で最善手を切った」前提で進みます。
            実戦では自分の選択に合わせて手牌が変わります。
          </p>
        )}
      </section>

      <div className="home-links">
        <button className="btn btn-primary" onClick={onReplay}>もう一局</button>
        <button className="btn" onClick={onHome}>ホームへ</button>
      </div>
      <p className="pf-disclaimer">
        ※ スコアは学習用の目安です（上家リーチ想定・ベタオリ前提）。
      </p>
    </div>
  );
}
