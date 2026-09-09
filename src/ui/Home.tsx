import { THEME_ORDER, THEMES, type ThemeId } from '../generator/themes';
import { accuracy, useStats } from './useStats';

interface Props {
  onStart: (theme: ThemeId | 'all') => void;
  onStartPushFold: () => void;
  onStartLive: () => void;
  onLearn: () => void;
  onStats: () => void;
}

export default function Home({ onStart, onStartPushFold, onStartLive, onLearn, onStats }: Props) {
  const { stats } = useStats();
  const pfAcc = accuracy(stats.themes.pushfold);
  const liveAcc = accuracy(stats.themes.live);

  return (
    <div className="home">
      <h1 className="home-title">守備判断トレーニング</h1>
      <p className="home-lead">
        相手の河から情報を取り出し、<strong>なぜこの牌が安全なのか</strong>を考えて切る練習をします。
        目的は「ベタオリ」— 放銃をできるだけ避けることです。
      </p>

      <h2 className="home-section">安全牌トレーニング</h2>
      <div className="theme-grid">
        <button className="theme-btn theme-btn-all" aria-label="全部のテーマで練習" onClick={() => onStart('all')}>
          <span className="theme-btn-label">全部</span>
          <span className="theme-btn-desc">全テーマからランダム出題（苦手を重点的に）</span>
        </button>
        {THEME_ORDER.map((id) => {
          const acc = accuracy(stats.themes[id]);
          return (
            <button key={id} className="theme-btn" aria-label={`${THEMES[id].label}の練習`} onClick={() => onStart(id)}>
              <span className="theme-btn-label">{THEMES[id].label}</span>
              <span className="theme-btn-desc">{THEMES[id].description}</span>
              <span className="theme-btn-acc">
                {acc === null ? '未挑戦' : `正解率 ${Math.round(acc * 100)}%`}
              </span>
            </button>
          );
        })}
      </div>

      <h2 className="home-section">実戦トレーニング</h2>
      <div className="theme-grid">
        <button className="theme-btn" aria-label="押し引きの練習" onClick={onStartPushFold}>
          <span className="theme-btn-label">押し引き</span>
          <span className="theme-btn-desc">
            テンパイ時に、リーチへ押す（危険牌を切る）か降りるかを期待値の目安で判断する。
          </span>
          <span className="theme-btn-acc">
            {pfAcc === null ? '未挑戦' : `正解率 ${Math.round(pfAcc * 100)}%`}
          </span>
        </button>
        <button className="theme-btn" aria-label="実戦形式の練習" onClick={onStartLive}>
          <span className="theme-btn-label">実戦形式</span>
          <span className="theme-btn-desc">
            1局を通して、河が伸びる中で3回続けて守備の判断をする。守備スコアで評価。
          </span>
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
