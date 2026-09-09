import { accuracy, useStats } from './useStats';

interface Props {
  /** 実戦練習（テーマ非表示のランダム出題）を開始する。 */
  onStartPractice: () => void;
  onStartPushFold: () => void;
  onStartLive: () => void;
  onLearn: () => void;
  onStats: () => void;
}

export default function Home({ onStartPractice, onStartPushFold, onStartLive, onLearn, onStats }: Props) {
  const { stats } = useStats();
  const pfAcc = accuracy(stats.themes.pushfold);
  const liveAcc = accuracy(stats.themes.live);
  // 安全牌トレーニング全体の通算（テーマ別は事前に見せない）
  const drill = { seen: 0, correct: 0, close: 0 };
  for (const [k, s] of Object.entries(stats.themes)) {
    if (k === 'pushfold' || k === 'live' || !s) continue;
    drill.seen += s.seen; drill.correct += s.correct; drill.close += s.close;
  }
  const drillAcc = drill.seen > 0 ? (drill.correct + drill.close * 0.5) / drill.seen : null;

  return (
    <div className="home">
      <h1 className="home-title">守備判断トレーニング</h1>
      <p className="home-lead">
        実戦の局面を見て、<strong>自分で安全牌を判断する</strong>練習です。
        出題テーマ（現物・スジ・壁…）は事前に知らされません。河・場況・手牌から考えて 1 枚選びます。
      </p>

      <button className="btn-start" onClick={onStartPractice}>
        実戦開始
        <span>
          {drillAcc === null ? 'ランダム出題' : `通算 ${drill.seen} 問・正解率 ${Math.round(drillAcc * 100)}%`}
        </span>
      </button>

      <h2 className="home-section">別モード</h2>
      <div className="theme-grid">
        <button className="theme-btn" onClick={onStartPushFold}>
          <span className="theme-btn-label">押し引き</span>
          <span className="theme-btn-desc">テンパイ時に、リーチへ押すか降りるかを期待値の目安で判断する。</span>
          <span className="theme-btn-acc">
            {pfAcc === null ? '未挑戦' : `正解率 ${Math.round(pfAcc * 100)}%`}
          </span>
        </button>
        <button className="theme-btn" onClick={onStartLive}>
          <span className="theme-btn-label">実戦形式（1局通し）</span>
          <span className="theme-btn-desc">河が伸びる中で 3 回続けて守備の判断をする。守備スコアで評価。</span>
          <span className="theme-btn-acc">
            {liveAcc === null ? '未挑戦' : `正解率 ${Math.round(liveAcc * 100)}%`}
          </span>
        </button>
      </div>

      <div className="home-links">
        <button className="btn" onClick={onLearn}>守備の基本を学ぶ</button>
        <button className="btn" onClick={onStats}>成績・苦手分析</button>
      </div>
    </div>
  );
}
