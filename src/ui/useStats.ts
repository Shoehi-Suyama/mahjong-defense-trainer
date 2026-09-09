// 学習記録（仕様 #55, #56, #57）。localStorage に保存する。

import { useCallback, useEffect, useState } from 'react';
import type { Verdict } from '../core/safety/analyzer';
import type { ThemeId } from '../generator/themes';

/** テーマ ID、または実戦系モード。 */
export type StatKey = ThemeId | 'pushfold' | 'live';

const KEY = 'mdt.stats.v1';

export interface ThemeStat {
  seen: number;
  correct: number;
  close: number;
  wrong: number;
}
export interface HistoryEntry {
  theme: StatKey;
  verdict: Verdict;
  tile: string;
  preferred: string;
  ms: number;
  ts: number;
}
export interface Stats {
  themes: Partial<Record<StatKey, ThemeStat>>;
  history: HistoryEntry[];
}

const EMPTY: Stats = { themes: {}, history: [] };

function load(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Stats;
    return { themes: parsed.themes ?? {}, history: parsed.history ?? [] };
  } catch {
    return EMPTY;
  }
}

function save(s: Stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* localStorage 不可の環境では黙って諦める */
  }
}

export function accuracy(t?: ThemeStat): number | null {
  if (!t || t.seen === 0) return null;
  // 「惜しい」は 0.5 点として扱う。
  return (t.correct + t.close * 0.5) / t.seen;
}

export function useStats() {
  const [stats, setStats] = useState<Stats>(load);

  useEffect(() => { save(stats); }, [stats]);

  const record = useCallback((entry: HistoryEntry) => {
    setStats((prev) => {
      const cur: ThemeStat = prev.themes[entry.theme] ?? { seen: 0, correct: 0, close: 0, wrong: 0 };
      const next: ThemeStat = {
        seen: cur.seen + 1,
        correct: cur.correct + (entry.verdict === 'correct' ? 1 : 0),
        close: cur.close + (entry.verdict === 'close' ? 1 : 0),
        wrong: cur.wrong + (entry.verdict === 'wrong' ? 1 : 0),
      };
      return {
        themes: { ...prev.themes, [entry.theme]: next },
        history: [entry, ...prev.history].slice(0, 100),
      };
    });
  }, []);

  const reset = useCallback(() => setStats(EMPTY), []);

  /** 最も正解率が低いテーマ（3 問以上解いたもの）。'all' モードの重点出題に使う（仕様 #57）。 */
  const weakestTheme = useCallback((): ThemeId | null => {
    let worst: { theme: ThemeId; acc: number } | null = null;
    for (const [key, st] of Object.entries(stats.themes) as [StatKey, ThemeStat][]) {
      if (key === 'pushfold' || key === 'live' || st.seen < 3) continue;
      const acc = accuracy(st)!;
      if (!worst || acc < worst.acc) worst = { theme: key, acc };
    }
    return worst && worst.acc < 0.8 ? worst.theme : null;
  }, [stats]);

  return { stats, record, reset, weakestTheme };
}
