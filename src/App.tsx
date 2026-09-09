import { useCallback, useEffect, useRef, useState } from 'react';
import type { Problem } from './core/problem';
import { judgeAnswer, type Verdict } from './core/safety/analyzer';
import type { TileId } from './core/tiles';
import { makeRng } from './core/rng';
import type { PushFoldProblem } from './core/pushfold/model';
import type { LiveHand } from './core/live';
import { generateProblem } from './generator/generate';
import { generatePushFold } from './generator/pushfold';
import { generateLiveHand } from './generator/live';
import { THEMES, type ThemeId } from './generator/themes';
import Home from './ui/Home';
import LearnMode from './ui/LearnMode';
import StatsScreen from './ui/StatsScreen';
import ProblemView from './ui/ProblemView';
import AnswerView from './ui/AnswerView';
import PushFoldView from './ui/PushFoldView';
import PushFoldAnswer from './ui/PushFoldAnswer';
import LiveHandView, { type LiveDecisionResult } from './ui/LiveHandView';
import LiveResult from './ui/LiveResult';
import { useStats } from './ui/useStats';

type Screen = 'home' | 'quiz' | 'pushfold' | 'live' | 'learn' | 'stats';
type Mode = ThemeId | 'all';

interface Session {
  mode: Mode;
  problem: Problem;
  phase: 'q' | 'a';
  chosen?: TileId;
  elapsedMs: number;
}

interface PFSession {
  problem: PushFoldProblem;
  phase: 'q' | 'a';
  choice?: 'push' | 'fold';
  elapsedMs: number;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState<Session | null>(null);
  const [pf, setPf] = useState<PFSession | null>(null);
  const [live, setLive] = useState<{ hand: LiveHand; results: LiveDecisionResult[] | null }>();
  const seedRef = useRef<number>(Date.now() % 1_000_000);
  const recentThemesRef = useRef<ThemeId[]>([]);
  const { record, weakestTheme } = useStats();

  /**
   * テーマを伏せたランダム出題。直前と同じテーマは連続させず、直近で偏ったテーマは除外・減量する。
   * 現物だけ／スジだけ…と偏らないようにする（ユーザー要望）。
   */
  const pickHiddenTheme = useCallback((seed: number): ThemeId => {
    const all = Object.keys(THEMES) as ThemeId[];
    const recent = recentThemesRef.current;
    const prev = recent[recent.length - 1];
    const last3 = recent.slice(-3);
    const last5 = recent.slice(-5);
    const rng = makeRng(seed);

    const weighted: ThemeId[] = [];
    for (const t of all) {
      if (t === prev) continue;                          // 連続させない
      if (last3.filter((x) => x === t).length >= 2) continue; // 直近で偏ったテーマは休ませる
      const seen5 = last5.filter((x) => x === t).length;
      const w = seen5 === 0 ? 4 : seen5 === 1 ? 2 : 1;
      for (let i = 0; i < w; i++) weighted.push(t);
    }
    const pool = weighted.length ? weighted : all.filter((t) => t !== prev);

    const weak = weakestTheme();
    const theme = weak && !last3.includes(weak) && rng.next() < 0.18
      ? weak
      : rng.pick(pool);

    recentThemesRef.current = [...recent, theme].slice(-10);
    return theme;
  }, [weakestTheme]);

  const makeProblem = useCallback((mode: Mode): Problem => {
    seedRef.current += 1;
    const seed = seedRef.current;
    const theme = mode === 'all' ? pickHiddenTheme(seed) : mode;
    return generateProblem(theme, seed);
  }, [pickHiddenTheme]);

  // StrictMode は state updater を二重呼び出しする。副作用（record / makeProblem の
  // seed・履歴更新）を updater 内に置かず、ref 経由で updater の外で 1 回だけ実行する。
  const modeRef = useRef<Mode>('all');
  const sessionRef = useRef<Session | null>(null);
  const pfRef = useRef<PFSession | null>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { pfRef.current = pf; }, [pf]);

  const start = useCallback((mode: Mode) => {
    modeRef.current = mode;
    setSession({ mode, problem: makeProblem(mode), phase: 'q', elapsedMs: 0 });
    setScreen('quiz');
  }, [makeProblem]);

  const answer = useCallback((tile: TileId, elapsedMs: number) => {
    const s = sessionRef.current;
    if (!s) return;
    const judge = judgeAnswer(s.problem.state, tile);
    record({
      theme: s.problem.theme as ThemeId,
      verdict: judge.verdict,
      tile,
      preferred: s.problem.preferred,
      ms: elapsedMs,
      ts: Date.now(),
    });
    setSession((cur) => (cur ? { ...cur, phase: 'a', chosen: tile, elapsedMs } : cur));
  }, [record]);

  const next = useCallback(() => {
    const problem = makeProblem(modeRef.current);
    setSession((cur) => (cur ? { ...cur, problem, phase: 'q', chosen: undefined, elapsedMs: 0 } : cur));
  }, [makeProblem]);

  // ---- 押し引きモード ----
  const makePushFold = useCallback((): PushFoldProblem => {
    seedRef.current += 1;
    return generatePushFold(seedRef.current);
  }, []);

  const startPushFold = useCallback(() => {
    setPf({ problem: makePushFold(), phase: 'q', elapsedMs: 0 });
    setScreen('pushfold');
  }, [makePushFold]);

  const answerPushFold = useCallback((choice: 'push' | 'fold', elapsedMs: number) => {
    const s = pfRef.current;
    if (!s) return;
    const correct = choice === s.problem.recommend;
    const verdict: Verdict = correct ? 'correct' : s.problem.result.close ? 'close' : 'wrong';
    record({
      theme: 'pushfold',
      verdict,
      tile: choice,
      preferred: s.problem.recommend,
      ms: elapsedMs,
      ts: Date.now(),
    });
    setPf((cur) => (cur ? { ...cur, phase: 'a', choice, elapsedMs } : cur));
  }, [record]);

  const nextPushFold = useCallback(() => {
    setPf({ problem: makePushFold(), phase: 'q', elapsedMs: 0 });
  }, [makePushFold]);

  // ---- 実戦形式 ----
  const startLive = useCallback(() => {
    seedRef.current += 1;
    setLive({ hand: generateLiveHand(seedRef.current), results: null });
    setScreen('live');
  }, []);

  const finishLive = useCallback((results: LiveDecisionResult[]) => {
    for (const r of results) {
      record({
        theme: 'live',
        verdict: r.verdict,
        tile: r.chosen,
        preferred: r.preferred,
        ms: 0,
        ts: Date.now(),
      });
    }
    setLive((s) => (s ? { ...s, results } : s));
  }, [record]);

  const replayLive = useCallback(() => {
    seedRef.current += 1;
    setLive({ hand: generateLiveHand(seedRef.current), results: null });
  }, []);

  const home = useCallback(() => {
    setSession(null);
    setPf(null);
    setLive(undefined);
    setScreen('home');
  }, []);

  if (screen === 'learn') return <LearnMode onBack={home} />;
  if (screen === 'stats') return <StatsScreen onBack={home} />;

  if (screen === 'live' && live) {
    return (
      <div className="app quiz-screen">
        <header className="quiz-bar">
          <button className="btn btn-back" onClick={home}>← やめる</button>
          <span className="quiz-mode">実戦形式</span>
        </header>
        {live.results
          ? <LiveResult hand={live.hand} results={live.results} onReplay={replayLive} onHome={home} />
          : <LiveHandView hand={live.hand} onFinish={finishLive} />}
      </div>
    );
  }

  if (screen === 'pushfold' && pf) {
    return (
      <div className="app quiz-screen">
        <header className="quiz-bar">
          <button className="btn btn-back" onClick={home}>← やめる</button>
          <span className="quiz-mode">押し引き</span>
        </header>
        {pf.phase === 'q' ? (
          <PushFoldView problem={pf.problem} onAnswer={answerPushFold} />
        ) : (
          <PushFoldAnswer
            problem={pf.problem}
            choice={pf.choice!}
            elapsedMs={pf.elapsedMs}
            onNext={nextPushFold}
          />
        )}
      </div>
    );
  }

  if (screen === 'quiz' && session) {
    return (
      <div className="app quiz-screen">
        <header className="quiz-bar">
          <button className="btn btn-back" onClick={home}>← やめる</button>
          <span className="quiz-mode">{session.phase === 'q' ? '守備判断' : '結果'}</span>
        </header>
        {session.phase === 'q' ? (
          <ProblemView problem={session.problem} onAnswer={answer} />
        ) : (
          <AnswerView
            problem={session.problem}
            chosen={session.chosen!}
            elapsedMs={session.elapsedMs}
            onNext={next}
          />
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <Home
        onStartPractice={() => start('all')}
        onStartPushFold={startPushFold}
        onStartLive={startLive}
        onLearn={() => setScreen('learn')}
        onStats={() => setScreen('stats')}
      />
    </div>
  );
}
