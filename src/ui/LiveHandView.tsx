import { useEffect, useMemo, useRef, useState } from 'react';
import { decisionScore, type LiveHand } from '../core/live';
import { judgeAnswer, seatLabel, type Verdict } from '../core/safety/analyzer';
import {
  doraFromIndicator, sortTileIds, tileLabel, uniqueTiles, type TileId,
} from '../core/tiles';
import Tile from './Tile';

export interface LiveDecisionResult {
  round: number;
  chosen: TileId;
  preferred: TileId;
  verdict: Verdict;
  chosenLevel: number;
  score: number;
}

interface Props {
  hand: LiveHand;
  onFinish: (results: LiveDecisionResult[]) => void;
}

export default function LiveHandView({ hand, onFinish }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [results, setResults] = useState<LiveDecisionResult[]>([]);
  const [selected, setSelected] = useState<TileId | null>(null);
  const startRef = useRef(Date.now());

  const decision = hand.decisions[stepIdx];
  const prevRiverLen = stepIdx === 0 ? 0 : hand.decisions[stepIdx - 1].state.opponents[0].river.length;

  useEffect(() => { setSelected(null); startRef.current = Date.now(); }, [stepIdx]);

  const handTiles = useMemo(
    () => sortTileIds(decision.state.playerHand),
    [decision.state.playerHand],
  );
  const choices = useMemo(() => uniqueTiles(decision.state.playerHand), [decision.state.playerHand]);

  const confirm = () => {
    if (!selected) return;
    const j = judgeAnswer(decision.state, selected);
    const res: LiveDecisionResult = {
      round: decision.round,
      chosen: selected,
      preferred: decision.analysis.preferred,
      verdict: j.verdict,
      chosenLevel: j.chosen.level,
      score: decisionScore(j.chosen.level),
    };
    const all = [...results, res];
    if (stepIdx + 1 >= hand.decisions.length) onFinish(all);
    else { setResults(all); setStepIdx(stepIdx + 1); }
  };

  const opp = decision.state.opponents[0];

  return (
    <div className="problem live">
      <div className="problem-head">
        <span className="chip chip-theme">実戦形式</span>
        <span className="chip">{hand.handLabel}</span>
        <span className="chip">{decision.round}巡目</span>
        <span className="chip chip-riichi">{seatLabel(opp.seat)}リーチ（{hand.riichiRound}巡目〜）</span>
        <span className="chip">
          ドラ {decision.state.doraIndicators.map((d) => tileLabel(doraFromIndicator(d))).join('・')}
        </span>
      </div>

      <div className="live-progress">
        {hand.decisions.map((_, i) => (
          <span key={i} className={`live-dot ${i < stepIdx ? 'done' : i === stepIdx ? 'now' : ''}`}>
            {i + 1}
          </span>
        ))}
        <span className="live-progress-label">判断 {stepIdx + 1} / {hand.decisions.length}</span>
      </div>

      <div className="table">
        <div className="table-label">
          {seatLabel(opp.seat)}の河（リーチ）
          {prevRiverLen > 0 && <span className="live-new-hint"> — 前回から {opp.river.length - prevRiverLen} 枚増えた</span>}
        </div>
        <div className="river" style={{ gridTemplateColumns: 'repeat(6, auto)' }}>
          {opp.river.map((t, i) => (
            <span key={i} className={i >= prevRiverLen && prevRiverLen > 0 ? 'live-river-new' : undefined}>
              <Tile id={t} size="sm" rotated={i === opp.riichiTileIndex} />
            </span>
          ))}
        </div>
      </div>

      <div className="hand-block">
        <div className="table-label">あなたの手牌</div>
        <div className="hand">
          {handTiles.map((t, i) => (
            <Tile key={`${t}-${i}`} id={t} size="md" onSelect={setSelected} selected={selected === t} />
          ))}
        </div>
      </div>

      <div className="ask">
        <p>何を切りますか？{selected && <> — <strong>{tileLabel(selected)}</strong></>}</p>
        <div className="choice-row">
          {choices.map((t) => (
            <Tile key={t} id={t} size="md" onSelect={setSelected} selected={selected === t} />
          ))}
        </div>
        <button className="btn btn-primary" disabled={!selected} onClick={confirm}>
          この牌を切る
        </button>
      </div>
    </div>
  );
}
