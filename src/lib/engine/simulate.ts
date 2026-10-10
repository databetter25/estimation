import { Rng } from './rng';
import { makeSampler, type DistSpec } from './distributions';
import { ESTIMATORS, summarize, type EstimatorId } from './estimators';

export interface SimConfig {
  dist: DistSpec;
  n: number;
  B: number;
  seed: number;
  estimators: EstimatorId[];
}

export type SimResult = Record<string, Float64Array>;

/**
 * B회 반복: 표본 하나를 뽑고, 같은 표본으로 모든 추정량을 계산한다 (SIM-1, SIM-5).
 * onProgress는 대략 2% 간격으로 호출된다.
 */
export function simulate(cfg: SimConfig, onProgress?: (done: number) => void): SimResult {
  const { n, B, estimators } = cfg;
  const rng = new Rng(cfg.seed);
  const sample = makeSampler(cfg.dist, rng);
  const fns = estimators.map((id) => ESTIMATORS[id]);
  const needsSort = fns.some((f) => f.needsSort);
  const out: Float64Array[] = estimators.map(() => new Float64Array(B));
  const x = new Float64Array(n);
  const step = Math.max(1, Math.floor(B / 50));

  for (let b = 0; b < B; b++) {
    sample(x);
    const s = summarize(x, needsSort);
    for (let j = 0; j < fns.length; j++) out[j][b] = fns[j].compute(s);
    if (onProgress && b % step === 0) onProgress(b);
  }
  onProgress?.(B);

  const result: SimResult = {};
  estimators.forEach((id, j) => (result[id] = out[j]));
  return result;
}
