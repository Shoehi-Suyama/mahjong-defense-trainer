import { useMemo } from 'react';
import type { Problem } from '../core/problem';
import {
  judgeAnswer, reasonSummary, seatLabel, type TileSafety,
} from '../core/safety/analyzer';
import { buildComparison, WAIT_LABEL } from '../core/safety/explain';
import { REASON_LABEL } from '../core/safety/reasons';
import { doraTiles, tileLabel, type TileId } from '../core/tiles';
import Tile from './Tile';
import SafetyStars from './SafetyStars';

interface Props {
  problem: Problem;
  chosen: TileId;
  elapsedMs: number;
  onNext: () => void;
}

const VERDICT_CLASS: Record<string, string> = {
  correct: 'verdict-correct',
  close: 'verdict-close',
  wrong: 'verdict-wrong',
};
const VERDICT_MARK: Record<string, string> = { correct: '○', close: '△', wrong: '×' };

export default function AnswerView({ problem, chosen, elapsedMs, onNext }: Props) {
  const judge = useMemo(() => judgeAnswer(problem.state, chosen), [problem, chosen]);
  const { ranking, correctAnswers, preferred } = problem.analysis;
  const prefSafety = ranking.find((r) => r.tile === preferred)!;
  const chosenSafety = judge.chosen;

  const comparison = buildComparison(
    { tile: chosen, label: reasonSummary(chosenSafety), level: chosenSafety.level },
    { tile: preferred, label: reasonSummary(prefSafety), level: prefSafety.level },
  );

  const others = ranking.filter((r) => r.tile !== preferred && r.tile !== chosen).slice(0, 3);
  const chosenIsAccepted = correctAnswers.includes(chosen);
  const dora = useMemo(() => doraTiles(problem.state.doraIndicators), [problem.state.doraIndicators]);
  const multiOpp = problem.state.opponents.length > 1;

  return (
    <div className="answer">
      <div className={`verdict ${VERDICT_CLASS[judge.verdict]}`}>
        <span className="verdict-mark">{VERDICT_MARK[judge.verdict]}</span>
        <span className="verdict-label">{judge.label}</span>
        <span className="verdict-time">回答時間 {(elapsedMs / 1000).toFixed(1)}秒</span>
      </div>

      <div className="answer-cards">
        <TileCard
          title="あなたの回答"
          safety={chosenSafety}
          mark={judge.verdict === 'correct' ? 'correct' : 'chosen-wrong'}
          dora={dora.has(chosen)}
        />
        <TileCard
          title="おすすめ"
          safety={prefSafety}
          mark="preferred"
          dora={dora.has(preferred)}
          extra={correctAnswers.length > 1
            ? `同程度に安全: ${correctAnswers.filter((t) => t !== preferred).map(tileLabel).join('・')}`
            : undefined}
        />
      </div>

      <section className="explain-block">
        <h3>【理由】なぜ {tileLabel(preferred)} が安全か</h3>
        <p className="explain-text">{prefSafety.explanation}</p>
        {multiOpp && <PerOppBreakdown safety={prefSafety} />}
        <DangerChips safety={prefSafety} />
      </section>

      {chosen !== preferred && chosenIsAccepted && (
        <section className="explain-block">
          <h3>【あなたの選択】{tileLabel(chosen)}</h3>
          <p className="explain-text">{chosenSafety.explanation}</p>
          {multiOpp && <PerOppBreakdown safety={chosenSafety} />}
          <p className="explain-compare">{tileLabel(chosen)}も同程度に安全なので、これも正解です。</p>
        </section>
      )}

      {chosen !== preferred && !chosenIsAccepted && (
        <section className="explain-block">
          <h3>【あなたの選択】{tileLabel(chosen)}</h3>
          <p className="explain-text">{chosenSafety.explanation}</p>
          {multiOpp && <PerOppBreakdown safety={chosenSafety} />}
          {comparison && <p className="explain-compare">{comparison}</p>}
          {dora.has(chosen) && chosenSafety.level <= 2 && (
            <p className="explain-compare">
              しかも{tileLabel(chosen)}はドラです。放銃時の失点が大きいぶん、なおさら切りたくない牌です。
            </p>
          )}
        </section>
      )}

      <section className="explain-block">
        <h3>【安全度ランキング】</h3>
        <ol className="ranking">
          {ranking.map((r, i) => (
            <li key={r.tile} className={rankRowClass(r, chosen, preferred, correctAnswers)}>
              <span className="ranking-rank">{i + 1}</span>
              <Tile id={r.tile} size="sm" />
              <SafetyStars level={r.level} size="sm" />
              <span className="ranking-reason">{reasonSummary(r)}</span>
              {r.completeSafety && <span className="ranking-flag">完全安全</span>}
            </li>
          ))}
        </ol>
      </section>

      {others.length > 0 && (
        <section className="explain-block">
          <h3>【他の候補】</h3>
          <ul className="others">
            {others.map((r) => (
              <li key={r.tile}>
                <Tile id={r.tile} size="sm" />
                <SafetyStars level={r.level} size="sm" />
                <span>{reasonSummary(r)}</span>
                {r.dangerousWaits.length > 0 && (
                  <span className="others-danger">
                    残: {r.dangerousWaits.map((w) => WAIT_LABEL[w]).join('・')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <button className="btn btn-primary btn-next" onClick={onNext}>次の問題</button>
    </div>
  );
}

function TileCard({ title, safety, mark, extra, dora }: {
  title: string; safety: TileSafety; mark: 'correct' | 'preferred' | 'chosen-wrong';
  extra?: string; dora?: boolean;
}) {
  return (
    <div className="tile-card">
      <div className="tile-card-title">{title}</div>
      <Tile id={safety.tile} size="lg" mark={mark} dora={dora} />
      <div className="tile-card-name">{tileLabel(safety.tile)}</div>
      <SafetyStars level={safety.level} />
      <div className="tile-card-reason">{safety.reasons.map((r) => REASON_LABEL[r]).join('・')}</div>
      {dora && <div className="tile-card-dora">ドラ（放銃時の失点大）</div>}
      {extra && <div className="tile-card-extra">{extra}</div>}
    </div>
  );
}

/** 複数リーチ時、相手ごとの安全度を並べる（仕様 #77）。 */
function PerOppBreakdown({ safety }: { safety: TileSafety }) {
  return (
    <div className="per-opp">
      {safety.perOpponent.map((e) => (
        <div key={e.seat} className="per-opp-row">
          <span className="per-opp-seat">{seatLabel(e.seat)}</span>
          <span className="per-opp-reason">
            {REASON_LABEL[e.reasons[0]]}
            {e.completeSafety
              ? <span className="per-opp-safe">完全安全</span>
              : <span className="per-opp-danger">当たり得る</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function DangerChips({ safety }: { safety: TileSafety }) {
  if (safety.completeSafety) {
    return <p className="danger-chips danger-none">否定できない待ちはありません（完全安全）。</p>;
  }
  if (safety.dangerousWaits.length === 0) return null;
  return (
    <p className="danger-chips">
      まだ当たり得る待ち:
      {safety.dangerousWaits.map((w) => (
        <span key={w} className="danger-chip">{WAIT_LABEL[w]}</span>
      ))}
    </p>
  );
}

function rankRowClass(r: TileSafety, chosen: TileId, preferred: TileId, correct: TileId[]): string {
  const c = ['ranking-row'];
  if (r.tile === preferred) c.push('is-preferred');
  if (r.tile === chosen) c.push('is-chosen');
  if (correct.includes(r.tile)) c.push('is-correct');
  return c.join(' ');
}
