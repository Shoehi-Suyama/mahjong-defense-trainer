import { describe, expect, it } from 'vitest';
import { dealInProbFromSafety, evaluatePushFold, type PushFoldInput } from '../model';

const base: PushFoldInput = {
  round: 8,
  shape: 'ryanmen',
  waitCount: 8,
  myPoints: 5200,
  pushTileDealIn: 0.045,
  oppValue: 5000,
};

describe('evaluatePushFold', () => {
  it('満貫・良形・序盤・無スジ押し → 押す', () => {
    const r = evaluatePushFold({
      ...base, round: 4, myPoints: 8000, pushTileDealIn: 0.062,
    });
    expect(r.recommend).toBe('push');
    expect(r.close).toBe(false);
  });

  it('安手・悪形・終盤・無スジ押し → 降りる', () => {
    const r = evaluatePushFold({
      ...base, round: 13, shape: 'kanchan', waitCount: 4, myPoints: 1300, pushTileDealIn: 0.062,
    });
    expect(r.recommend).toBe('fold');
    expect(r.close).toBe(false);
  });

  it('リーチのみ・良形・中盤・無スジ → 降り寄り', () => {
    const r = evaluatePushFold({
      ...base, round: 9, myPoints: 2000, pushTileDealIn: 0.062,
    });
    expect(r.recommend).toBe('fold');
  });

  it('3900・良形・中盤・スジ押し → 押し寄り', () => {
    const r = evaluatePushFold({
      ...base, round: 8, myPoints: 3900, pushTileDealIn: 0.03,
    });
    expect(r.recommend).toBe('push');
  });

  it('現物で押せる（放銃率 0）なら必ず押す', () => {
    const r = evaluatePushFold({ ...base, round: 12, myPoints: 1300, pushTileDealIn: 0 });
    expect(r.recommend).toBe('push');
    expect(r.pushDealInProb).toBe(0);
  });

  it('和了率は巡目が進むと下がる', () => {
    const early = evaluatePushFold({ ...base, round: 4 });
    const late = evaluatePushFold({ ...base, round: 13 });
    expect(early.winProb).toBeGreaterThan(late.winProb);
  });
});

describe('dealInProbFromSafety', () => {
  it('完全安全は 0、無スジは最大', () => {
    expect(dealInProbFromSafety(100, true)).toBe(0);
    expect(dealInProbFromSafety(12, false)).toBeGreaterThan(dealInProbFromSafety(50, false));
    expect(dealInProbFromSafety(74, false)).toBeLessThan(dealInProbFromSafety(30, false));
  });
});
