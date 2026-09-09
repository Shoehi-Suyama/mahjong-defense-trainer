import { useEffect, useMemo, useRef, useState } from 'react';
import { seatLabel } from '../core/safety/analyzer';
import {
  doraFromIndicator, doraTiles, sortTileIds, tileLabel, uniqueTiles, type TileId,
} from '../core/tiles';
import type { Problem } from '../core/problem';
import { THEMES } from '../generator/themes';
import { River, Melds } from './River';
import Tile from './Tile';

interface Props {
  problem: Problem;
  onAnswer: (tile: TileId, elapsedMs: number) => void;
}

export default function ProblemView({ problem, onAnswer }: Props) {
  const { state } = problem;
  const [selected, setSelected] = useState<TileId | null>(null);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setSelected(null);
  }, [problem.id]);

  const handTiles = useMemo(() => sortTileIds(state.playerHand), [state.playerHand]);
  const choices = useMemo(() => uniqueTiles(state.playerHand), [state.playerHand]);
  const dora = useMemo(() => doraTiles(state.doraIndicators), [state.doraIndicators]);
  const seen = useMemo(
    () => sortTileIds([...state.extraVisible, ...state.doraIndicators]),
    [state.extraVisible, state.doraIndicators],
  );

  const confirm = () => {
    if (!selected) return;
    onAnswer(selected, Date.now() - startRef.current);
  };

  const riichiOpps = state.opponents.filter((o) => o.riichi);
  const furoOpps = state.opponents.filter((o) => !o.riichi && o.tenpaiLikely);
  const threatChip = riichiOpps.length >= 2
    ? `${riichiOpps.length}人リーチ`
    : riichiOpps.length === 1
      ? `${seatLabel(riichiOpps[0].seat)}リーチ`
      : furoOpps.length > 0
        ? `${seatLabel(furoOpps[0].seat)} 副露（テンパイ気配）`
        : `${seatLabel(state.opponents[0].seat)}`;

  return (
    <div className="problem">
      <div className="problem-head">
        <span className="chip chip-theme">{THEMES[problem.theme as keyof typeof THEMES]?.label ?? problem.theme}</span>
        <span className="chip">{state.round}巡目</span>
        <span className="chip chip-riichi">{threatChip}</span>
        {state.doraIndicators.length > 0 && (
          <span className="chip">
            ドラ {state.doraIndicators.map((d) => tileLabel(doraFromIndicator(d))).join('・')}
            （表示 {state.doraIndicators.map(tileLabel).join('・')}）
          </span>
        )}
      </div>

      {state.opponents.map((opp, i) => (
        <div className="table" key={i}>
          <div className="table-label">
            {seatLabel(opp.seat)}の河
            {opp.riichi ? '（リーチ）' : opp.melds.length > 0 ? '（副露・テンパイ気配）' : ''}
          </div>
          <River tiles={opp.river} riichiIndex={opp.riichi ? opp.riichiTileIndex : undefined} />
          <Melds melds={opp.melds} />
        </div>
      ))}

      {seen.length > 0 && (
        <div className="seen-block">
          <div className="table-label">場に見えている牌（他家の河・ドラ表示など）</div>
          <div className="seen-row">
            {seen.map((t, i) => <Tile key={`${t}-${i}`} id={t} size="sm" />)}
          </div>
        </div>
      )}

      <div className="hand-block">
        <div className="table-label">あなたの手牌</div>
        <div className="hand">
          {handTiles.map((t, i) => (
            <Tile
              key={`${t}-${i}`}
              id={t}
              size="md"
              onSelect={setSelected}
              selected={selected === t}
              dora={dora.has(t)}
            />
          ))}
        </div>
      </div>

      <div className="ask">
        <p>何を切りますか？{selected && <> — <strong>{tileLabel(selected)}</strong></>}</p>
        <div className="choice-row">
          {choices.map((t) => (
            <Tile key={t} id={t} size="md" onSelect={setSelected} selected={selected === t} dora={dora.has(t)} />
          ))}
        </div>
        <button className="btn btn-primary" disabled={!selected} onClick={confirm}>
          この牌を切る
        </button>
      </div>
    </div>
  );
}
