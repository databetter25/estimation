import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { simulate, type SimConfig } from './simulate';
import { computeMetrics, classifyGroup } from './stats';
import { theory } from './theory';
import { quantileSorted, trimmedMeanSorted, type EstimatorId } from './estimators';
import type { DistSpec } from './distributions';

const B = 40000;

/** 분산 추정치의 몬테카를로 표준오차: sqrt((m4 - var²)/B) */
function seVariance(est: Float64Array): number {
  const n = est.length;
  let mean = 0;
  for (const v of est) mean += v;
  mean /= n;
  let m2 = 0;
  let m4 = 0;
  for (const v of est) {
    const d = (v - mean) ** 2;
    m2 += d;
    m4 += d * d;
  }
  m2 /= n;
  m4 /= n;
  return Math.sqrt((m4 - m2 * m2) / n);
}

const cases: { name: string; dist: DistSpec; n: number; truth: number; ids: EstimatorId[] }[] = [
  { name: '정규 μ', dist: { kind: 'normal', mu: 10, sigma2: 4 }, n: 25, truth: 10, ids: ['xbar'] },
  {
    name: '정규 σ²',
    dist: { kind: 'normal', mu: 10, sigma2: 4 },
    n: 25,
    truth: 4,
    ids: ['s2', 'sigma2mle'],
  },
  {
    name: '균등 θ',
    dist: { kind: 'uniform', theta: 10 },
    n: 20,
    truth: 10,
    ids: ['umvue', 'xmax', 'mme'],
  },
  { name: 't3 μ', dist: { kind: 't', mu: 10, scale: 2, df: 3 }, n: 25, truth: 10, ids: ['xbar'] },
  {
    name: '오염 정규 μ',
    dist: { kind: 'contaminated', mu: 10, sigma2: 4, eps: 0.1, k: 5 },
    n: 25,
    truth: 10,
    ids: ['xbar'],
  },
];

describe('이론값 대조 (±3 MC 표준오차)', () => {
  for (const c of cases) {
    const res = simulate({ dist: c.dist, n: c.n, B, seed: 7, estimators: c.ids });
    for (const id of c.ids) {
      it(`${c.name} — ${id}`, () => {
        const m = computeMetrics(res[id], c.truth);
        const th = theory(id, c.dist, c.n, c.truth)!;
        expect(th).not.toBeNull();
        expect(Math.abs(m.mean - th.mean)).toBeLessThan(3 * m.seMean);
        // t3은 4차 적률이 없어 분산의 표준오차가 불안정 → 상대오차로 느슨하게 확인
        if (c.dist.kind === 't') {
          expect(Math.abs(m.variance / th.variance - 1)).toBeLessThan(0.15);
        } else {
          expect(Math.abs(m.variance - th.variance)).toBeLessThan(3 * seVariance(res[id]));
        }
      });
    }
  }
});

describe('이론식이 없는 추정량 — PRD §6 재검증 값과 대조', () => {
  const normal = simulate({
    dist: { kind: 'normal', mu: 10, sigma2: 4 },
    n: 25,
    B,
    seed: 11,
    estimators: ['xbar', 'trim10', 'median', 'midrange', 'sigma2iqr'],
  });
  it('중앙값 분산 ≈ 0.247', () => {
    expect(computeMetrics(normal.median, 10).variance).toBeCloseTo(0.247, 1);
  });
  it('절사평균 분산 ≈ 0.167', () => {
    expect(computeMetrics(normal.trim10, 10).variance).toBeCloseTo(0.167, 1);
  });
  it('중앙범위 분산 ≈ 0.533', () => {
    expect(Math.abs(computeMetrics(normal.midrange, 10).variance - 0.533)).toBeLessThan(0.02);
  });
  it('IQR 추정량 평균 ≈ 3.76 (편향 있음)', () => {
    expect(Math.abs(computeMetrics(normal.sigma2iqr, 4).mean - 3.76)).toBeLessThan(0.03);
  });
});

describe('재현성 (SIM-4)', () => {
  it('같은 시드 → 같은 결과', () => {
    const cfg: SimConfig = {
      dist: { kind: 'normal', mu: 0, sigma2: 1 },
      n: 10,
      B: 100,
      seed: 2026,
      estimators: ['xbar', 'median'],
    };
    const a = simulate(cfg);
    const b = simulate(cfg);
    expect(Array.from(a.xbar)).toEqual(Array.from(b.xbar));
    expect(Array.from(a.median)).toEqual(Array.from(b.median));
  });
  it('다른 시드 → 다른 결과', () => {
    expect(new Rng(1).uniform()).not.toEqual(new Rng(2).uniform());
  });
  it('균등난수는 (0,1) 안에 있다', () => {
    const r = new Rng(3);
    for (let i = 0; i < 10000; i++) {
      const u = r.uniform();
      expect(u).toBeGreaterThan(0);
      expect(u).toBeLessThan(1);
    }
  });
});

describe('순서통계량 계산', () => {
  const x = Float64Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  it('분위수 type 7 (NumPy linear와 일치)', () => {
    expect(quantileSorted(x, 0.25)).toBeCloseTo(3.25);
    expect(quantileSorted(x, 0.75)).toBeCloseTo(7.75);
    expect(quantileSorted(x, 0.5)).toBeCloseTo(5.5);
  });
  it('10% 절사평균은 양쪽 1개씩 제거', () => {
    expect(trimmedMeanSorted(x, 0.1)).toBeCloseTo(5.5);
    expect(trimmedMeanSorted(Float64Array.from([0, 1, 2, 3, 100, 4, 5, 6, 7, 8].sort((a, b) => a - b)), 0.1)).toBeCloseTo(4.5);
  });
});

describe('과녁 유형 판정 (§4.4)', () => {
  it('균등분포: UMVUE=(a), X(n)=(b), 2X̄=(c)', () => {
    const r = simulate({
      dist: { kind: 'uniform', theta: 10 },
      n: 20,
      B: 2000,
      seed: 1,
      estimators: ['umvue', 'xmax', 'mme'],
    });
    const cls = classifyGroup({
      umvue: computeMetrics(r.umvue, 10),
      xmax: computeMetrics(r.xmax, 10),
      mme: computeMetrics(r.mme, 10),
    });
    expect(cls.umvue.type).toBe('a');
    expect(cls.xmax.type).toBe('b');
    expect(cls.mme.type).toBe('c');
  });
  it('정규 μ: X̄=(a), 중앙값=(c), 중앙범위=(c)', () => {
    const r = simulate({
      dist: { kind: 'normal', mu: 10, sigma2: 4 },
      n: 25,
      B: 2000,
      seed: 1,
      estimators: ['xbar', 'trim10', 'median', 'midrange'],
    });
    const m = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, computeMetrics(v, 10)]));
    const cls = classifyGroup(m);
    expect(cls.xbar.type).toBe('a');
    expect(cls.median.type).toBe('c');
    expect(cls.midrange.type).toBe('c');
  });
});

describe('성능 (SIM-6)', () => {
  it('B=2000, n=25, 4개 추정량이 300ms 안에 끝난다', () => {
    const t0 = performance.now();
    simulate({
      dist: { kind: 'normal', mu: 10, sigma2: 4 },
      n: 25,
      B: 2000,
      seed: 1,
      estimators: ['xbar', 'trim10', 'median', 'midrange'],
    });
    expect(performance.now() - t0).toBeLessThan(300);
  });
});
