/**
 * 반복 실험 결과 → 지표 (VIZ-3, VIZ-4) 와 과녁 유형 판정 (§4.4).
 */

export interface Metrics {
  B: number;
  mean: number;
  bias: number;
  /** 분모 B — Var + Bias² 가 MSE와 정확히 같아지도록 */
  variance: number;
  sd: number;
  mse: number;
  /** 몬테카를로 표준오차 */
  seMean: number;
  seMse: number;
  /** |θ̂ - θ|의 95% 분위수 — 과녁 축척 계산용 */
  q95AbsDev: number;
  /** 유한하지 않은 값의 개수 (코시 등) */
  nonFinite: number;
}

export function computeMetrics(est: Float64Array, truth: number): Metrics {
  const B = est.length;
  let sum = 0;
  let k = 0;
  for (let i = 0; i < B; i++) {
    if (Number.isFinite(est[i])) {
      sum += est[i];
      k++;
    }
  }
  const mean = sum / k;
  let v = 0;
  let mse = 0;
  let mse2 = 0;
  const absDev = new Float64Array(k);
  let j = 0;
  for (let i = 0; i < B; i++) {
    const e = est[i];
    if (!Number.isFinite(e)) continue;
    const d = e - mean;
    v += d * d;
    const sq = (e - truth) * (e - truth);
    mse += sq;
    mse2 += sq * sq;
    absDev[j++] = Math.abs(e - truth);
  }
  const variance = v / k;
  mse /= k;
  const varSq = Math.max(0, mse2 / k - mse * mse);
  absDev.sort();
  const q95 = absDev[Math.min(k - 1, Math.floor(0.95 * (k - 1)))];
  return {
    B,
    mean,
    bias: mean - truth,
    variance,
    sd: Math.sqrt(variance),
    mse,
    seMean: Math.sqrt(variance / k),
    seMse: Math.sqrt(varSq / k),
    q95AbsDev: q95,
    nonFinite: B - k,
  };
}

export type TargetType = 'a' | 'b' | 'c' | 'd';

export interface Classification {
  type: TargetType;
  biased: boolean;
  efficient: boolean;
  /** 그룹 최소분산 대비 분산 비 */
  varRatio: number;
}

export const BIAS_SE_MULT = 2;
export const BIAS_SD_RATIO = 0.2;
export const EFFICIENT_RATIO = 1.2;

/**
 * 같은 모수 그룹 안에서 과녁 유형을 판정한다.
 * - 편향 유의: |Bias| > 2·SE(평균) 이고 |Bias|/SD > 0.2
 * - 고효율: 분산 ≤ 그룹 최소분산 × 1.2
 */
export function classifyGroup(metrics: Record<string, Metrics>): Record<string, Classification> {
  const ids = Object.keys(metrics);
  const minVar = Math.min(...ids.map((id) => metrics[id].variance));
  const out: Record<string, Classification> = {};
  for (const id of ids) {
    const m = metrics[id];
    const biased =
      Math.abs(m.bias) > BIAS_SE_MULT * m.seMean && Math.abs(m.bias) / m.sd > BIAS_SD_RATIO;
    const varRatio = m.variance / minVar;
    const efficient = varRatio <= EFFICIENT_RATIO;
    const type: TargetType = !biased ? (efficient ? 'a' : 'c') : efficient ? 'b' : 'd';
    out[id] = { type, biased, efficient, varRatio };
  }
  return out;
}

/**
 * 과녁·히스토그램 공통 축척 (반지름, 참값으로부터의 거리).
 * 가장 퍼진 추정량의 95% 분위수를 쓰되, 가장 조밀한 추정량의 4배를 넘지 않게 자른다.
 * (코시 분포의 X̄처럼 발산하는 경우에도 나머지 추정량이 보이도록)
 */
export function groupExtent(metrics: Metrics[]): number {
  const qs = metrics.map((m) => m.q95AbsDev).filter((q) => Number.isFinite(q) && q > 0);
  if (qs.length === 0) return 1;
  const ext = Math.min(Math.max(...qs), 4 * Math.min(...qs));
  return niceCeil(ext * 1.1);
}

/** 1, 2, 2.5, 5 × 10^k 단위로 올림 */
export function niceCeil(x: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * p >= x) return m * p;
  }
  return 10 * p;
}

/** 가우시안 커널 밀도추정 (Silverman 대역폭). xs 격자에서의 밀도를 돌려준다. */
export function kde(data: Float64Array, xs: number[]): number[] {
  const n = data.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += data[i];
  mean /= n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (data[i] - mean) ** 2;
  const sd = Math.sqrt(v / (n - 1));
  const sorted = Float64Array.from(data).sort();
  const iqr = sorted[Math.floor(0.75 * (n - 1))] - sorted[Math.floor(0.25 * (n - 1))];
  const h = 0.9 * Math.min(sd, iqr / 1.34 || sd) * Math.pow(n, -0.2);
  const norm = 1 / (n * h * Math.sqrt(2 * Math.PI));
  return xs.map((x) => {
    let s = 0;
    // 정렬된 자료에서 ±5h 범위만 더한다
    const lo = lowerBound(sorted, x - 5 * h);
    for (let i = lo; i < n && sorted[i] <= x + 5 * h; i++) {
      const z = (x - sorted[i]) / h;
      s += Math.exp(-0.5 * z * z);
    }
    return s * norm;
  });
}

function lowerBound(a: Float64Array, v: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (a[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
