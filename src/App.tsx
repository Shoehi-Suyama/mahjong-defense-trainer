import { useCallback, useMemo, useRef, useState } from 'react';
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
  const { record, weakestTheme } = useStats();

  const makeProblem = useCallback((mode: Mode): Problem => {
    seedRef.current += 1;
    const seed = seedRef.current;
    let theme: ThemeId;
    if (mode === 'all') {
      const weak = weakestTheme();
      const rng = makeRng(seed);
      theme = weak && rng.next() < 0.35
        ? weak
        : rng.pick(Object.keys(THEMES) as ThemeId[]);
    } else {
      theme = mode;
    }
    return generateProblem(theme, seed);
  }, [weakestTheme]);

  const start = useCallback((mode: Mode) => {
    setSession({ mode, problem: makeProblem(mode), phase: 'q', elapsedMs: 0 });
    setScreen('quiz');
  }, [makeProblem]);

  const answer = useCallback((tile: TileId, elapsedMs: number) => {
    setSession((s) => {
      if (!s) return s;
      const judge = judgeAnswer(s.problem.state, tile);
      record({
        theme: s.problem.theme as ThemeId,
        verdict: judge.verdict,
        tile,
        preferred: s.problem.preferred,
        ms: elapsedMs,
        ts: Date.now(),
      });
      return { ...s, phase: 'a', chosen: tile, elapsedMs };
    });
  }, [record]);

  const next = useCallback(() => {
    setSession((s) => (s ? { ...s, problem: makeProblem(s.mode), phase: 'q', chosen: undefined, elapsedMs: 0 } : s));
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
    setPf((s) => {
      if (!s) return s;
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
      return { ...s, phase: 'a', choice, elapsedMs };
    });
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

  const modeLabel = useMemo(
    () => (session ? (session.mode === 'all' ? '全部' : THEMES[session.mode].label) : ''),
    [session],
  );

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
          <span className="quiz-mode">{modeLabel}（{THEMES[session.problem.theme as ThemeId].label}）</span>
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
        onStart={start}
        onStartPushFold={startPushFold}
        onStartLive={startLive}
        onLearn={() => setScreen('learn')}
        onStats={() => setScreen('stats')}
      />
    </div>
  );
}
