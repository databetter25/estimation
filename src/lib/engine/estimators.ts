/**
 * 추정량 계산 함수 (SIM-3).
 * 표본 하나에 대해 요약값을 한 번 계산하고, 모든 추정량이 그 요약을 공유한다 (SIM-5).
 */

export interface Summary {
  /** 표본. sorted가 true면 오름차순 정렬된 상태 */
  x: Float64Array;
  n: number;
  mean: number;
  /** 편차제곱합 Σ(X_i - X̄)² */
  ss: number;
  min: number;
  max: number;
}

export type EstimatorId =
  | 'xbar'
  | 'trim10'
  | 'median'
  | 'midrange'
  | 's2'
  | 'sigma2mle'
  | 'sigma2iqr'
  | 'umvue'
  | 'xmax'
  | 'mme';

export interface EstimatorFn {
  /** 정렬된 표본이 필요한가 (분위수, 절사) */
  needsSort: boolean;
  compute: (s: Summary) => number;
}

/**
 * 분위수 — R type 7 / NumPy 'linear' 정의 (SIM-7).
 * h = (n-1)p, x[floor(h)] + (h - floor(h)) (x[floor(h)+1] - x[floor(h)])
 */
export function quantileSorted(x: Float64Array, p: number): number {
  const n = x.length;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  return x[lo] + (h - lo) * (x[hi] - x[lo]);
}

/** 양쪽에서 floor(0.1 n)개씩 잘라낸 평균 (scipy.stats.trim_mean 과 같은 정의) */
export function trimmedMeanSorted(x: Float64Array, prop: number): number {
  const n = x.length;
  const k = Math.floor(prop * n);
  let sum = 0;
  for (let i = k; i < n - k; i++) sum += x[i];
  return sum / (n - 2 * k);
}

/** IQR을 σ로 바꾸는 정규분포 상수: Φ⁻¹(0.75) - Φ⁻¹(0.25) */
export const IQR_NORMAL_CONST = 1.349;

export const ESTIMATORS: Record<EstimatorId, EstimatorFn> = {
  xbar: { needsSort: false, compute: (s) => s.mean },
  trim10: { needsSort: true, compute: (s) => trimmedMeanSorted(s.x, 0.1) },
  median: { needsSort: true, compute: (s) => quantileSorted(s.x, 0.5) },
  midrange: { needsSort: false, compute: (s) => (s.min + s.max) / 2 },
  s2: { needsSort: false, compute: (s) => s.ss / (s.n - 1) },
  sigma2mle: { needsSort: false, compute: (s) => s.ss / s.n },
  sigma2iqr: {
    needsSort: true,
    compute: (s) => {
      const iqr = quantileSorted(s.x, 0.75) - quantileSorted(s.x, 0.25);
      const sd = iqr / IQR_NORMAL_CONST;
      return sd * sd;
    },
  },
  umvue: { needsSort: false, compute: (s) => ((s.n + 1) / s.n) * s.max },
  xmax: { needsSort: false, compute: (s) => s.max },
  mme: { needsSort: false, compute: (s) => 2 * s.mean },
};

/** 표본 배열에서 요약값을 채운다. needsSort면 x를 제자리 정렬한다. */
export function summarize(x: Float64Array, needsSort: boolean): Summary {
  const n = x.length;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = x[i];
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mean = sum / n;
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const d = x[i] - mean;
    ss += d * d;
  }
  if (needsSort) x.sort();
  return { x, n, mean, ss, min, max };
}
