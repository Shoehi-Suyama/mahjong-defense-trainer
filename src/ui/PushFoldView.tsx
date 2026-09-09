import { useEffect, useMemo, useRef } from 'react';
import { seatLabel } from '../core/safety/analyzer';
import { reasonSummary } from '../core/safety/analyzer';
import { isGoodShape, SHAPE_LABEL, type PushFoldProblem } from '../core/pushfold/model';
import { doraFromIndicator, sortTileIds, tileLabel } from '../core/tiles';
import { River } from './River';
import Tile from './Tile';
import SafetyStars from './SafetyStars';

interface Props {
  problem: PushFoldProblem;
  onAnswer: (choice: 'push' | 'fold', elapsedMs: number) => void;
}

export default function PushFoldView({ problem, onAnswer }: Props) {
  const { state, drawnTile, tenpai } = problem;
  const opp = state.opponents[0];
  const startRef = useRef<number>(Date.now());

  useEffect(() => { startRef.current = Date.now(); }, [problem.id]);

  const hand = useMemo(() => {
    const h = [...state.playerHand];
    const i = h.indexOf(drawnTile);
    if (i >= 0) h.splice(i, 1);
    return sortTileIds(h);
  }, [state.playerHand, drawnTile]);

  const answer = (choice: 'push' | 'fold') => onAnswer(choice, Date.now() - startRef.current);

  return (
    <div className="problem pushfold">
      <div className="problem-head">
        <span className="chip chip-theme">押し引き</span>
        <span className="chip">{state.round}巡目</span>
        <span className="chip chip-riichi">{seatLabel(opp.seat)}リーチ</span>
        <span className="chip">
          ドラ {state.doraIndicators.map((d) => tileLabel(doraFromIndicator(d))).join('・')}
        </span>
      </div>

      <div className="table">
        <div className="table-label">{seatLabel(opp.seat)}の河（リーチ）</div>
        <River tiles={opp.river} riichiIndex={opp.riichiTileIndex} />
      </div>

      <div className="pf-mine">
        <div className="table-label">あなた（テンパイ）</div>
        <div className="hand pf-hand">
          {hand.map((t, i) => <Tile key={`${t}-${i}`} id={t} size="sm" />)}
        </div>
        <div className="pf-facts">
          <span>待ち <strong>{tenpai.waitTiles.map(tileLabel).join('・')}</strong>（{tenpai.waitCount}枚）</span>
          <span className={isGoodShape(tenpai.shape) ? 'pf-good' : 'pf-bad'}>
            {SHAPE_LABEL[tenpai.shape]}・{isGoodShape(tenpai.shape) ? '良形' : '悪形'}
          </span>
          <span>打点 約 <strong>{tenpai.points.toLocaleString()}</strong> 点（リーチ）</span>
        </div>
      </div>

      <div className="pf-draw">
        <div className="table-label">ツモ牌（押すならこれを切る）</div>
        <div className="pf-draw-row">
          <Tile id={drawnTile} size="lg" />
          <div className="pf-draw-info">
            <div className="pf-draw-name">{tileLabel(drawnTile)}</div>
            <SafetyStars level={problem.drawnTileSafety.level} />
            <div className="pf-draw-reason">{reasonSummary(problem.drawnTileSafety)}</div>
          </div>
        </div>
      </div>

      <div className="pf-actions">
        <button className="btn pf-btn pf-btn-push" onClick={() => answer('push')}>
          押す<span>テンパイ維持でツモ牌を切る</span>
        </button>
        <button className="btn pf-btn pf-btn-fold" onClick={() => answer('fold')}>
          降りる<span>手を崩して安全に受ける</span>
        </button>
      </div>
    </div>
  );
}
