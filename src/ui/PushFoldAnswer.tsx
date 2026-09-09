import { reasonSummary } from '../core/safety/analyzer';
import { WAIT_LABEL } from '../core/safety/explain';
import type { PushFoldProblem } from '../core/pushfold/model';
import { tileLabel } from '../core/tiles';
import Tile from './Tile';
import SafetyStars from './SafetyStars';

interface Props {
  problem: PushFoldProblem;
  choice: 'push' | 'fold';
  elapsedMs: number;
  onNext: () => void;
}

const CHOICE_JP = { push: '押す', fold: '降りる' } as const;

export default function PushFoldAnswer({ problem, choice, elapsedMs, onNext }: Props) {
  const { result, recommend, drawnTileSafety } = problem;
  const correct = choice === recommend;
  const verdict = correct ? 'correct' : result.close ? 'close' : 'wrong';
  const label = correct ? '正解' : result.close ? '際どい（推奨と逆）' : '不正解';

  return (
    <div className="answer pushfold-answer">
      <div className={`verdict verdict-${verdict}`}>
        <span className="verdict-mark">{correct ? '○' : result.close ? '△' : '×'}</span>
        <span className="verdict-label">{label}</span>
        <span className="verdict-time">回答時間 {(elapsedMs / 1000).toFixed(1)}秒</span>
      </div>

      <div className="pf-verdict-cards">
        <div className={`pf-vcard ${recommend === 'push' ? 'is-push' : 'is-fold'}`}>
          <div className="pf-vcard-title">エンジンの推奨</div>
          <div className="pf-vcard-choice">{CHOICE_JP[recommend]}</div>
        </div>
        <div className="pf-vcard pf-vcard-you">
          <div className="pf-vcard-title">あなたの選択</div>
          <div className="pf-vcard-choice">{CHOICE_JP[choice]}</div>
        </div>
      </div>

      <section className="explain-block">
        <h3>【期待値の目安】</h3>
        <table className="pf-ev">
          <tbody>
            <tr><th>和了率</th><td>{(result.winProb * 100).toFixed(0)}%</td></tr>
            <tr><th>押し切った場合の放銃率（推定）</th><td>{(result.pushDealInProb * 100).toFixed(0)}%</td></tr>
            <tr><th>相手の平均失点</th><td>約 {Math.round(result.oppValue).toLocaleString()} 点</td></tr>
            <tr className="pf-ev-strong">
              <th>押しの期待値</th>
              <td className={result.evPush >= result.evFold ? 'pf-good' : 'pf-bad'}>
                {result.evPush >= 0 ? '+' : ''}{Math.round(result.evPush).toLocaleString()} 点
              </td>
            </tr>
            <tr className="pf-ev-strong">
              <th>降りの期待値</th>
              <td className={result.evFold > result.evPush ? 'pf-good' : 'pf-bad'}>
                {Math.round(result.evFold).toLocaleString()} 点
              </td>
            </tr>
          </tbody>
        </table>
        <ul className="pf-reasoning">
          {result.reasoning.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      </section>

      <section className="explain-block">
        <h3>【ツモ牌 {tileLabel(problem.drawnTile)} の危険度】</h3>
        <div className="pf-draw-row">
          <Tile id={problem.drawnTile} size="md" />
          <div className="pf-draw-info">
            <SafetyStars level={drawnTileSafety.level} />
            <span>{reasonSummary(drawnTileSafety)}</span>
          </div>
        </div>
        <p className="explain-text">{drawnTileSafety.explanation}</p>
        {drawnTileSafety.dangerousWaits.length > 0 && (
          <p className="danger-chips">
            当たり得る待ち:
            {drawnTileSafety.dangerousWaits.map((w) => (
              <span key={w} className="danger-chip">{WAIT_LABEL[w]}</span>
            ))}
          </p>
        )}
      </section>

      <p className="pf-disclaimer">
        ※ 期待値・放銃率は簡易モデルによる目安です。実戦では点棒状況・他家の気配・ウラドラ期待なども加味します。
      </p>

      <button className="btn btn-primary btn-next" onClick={onNext}>次の問題</button>
    </div>
  );
}
