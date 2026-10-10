import type { Rng } from './rng';

/** 모집단 분포 정의 (SIM-2, SIM-8) */
export type DistSpec =
  | { kind: 'normal'; mu: number; sigma2: number }
  | { kind: 'uniform'; theta: number }
  /** 위치 mu, 척도 scale의 t 분포 (자유도 df, 정수) */
  | { kind: 't'; mu: number; scale: number; df: number }
  /** (1-eps) N(mu, sigma2) + eps N(mu, k^2 sigma2) */
  | { kind: 'contaminated'; mu: number; sigma2: number; eps: number; k: number }
  /** 위치 mu, 척도 scale의 코시 분포 */
  | { kind: 'cauchy'; mu: number; scale: number };

export type Sampler = (out: Float64Array) => void;

export function makeSampler(spec: DistSpec, rng: Rng): Sampler {
  switch (spec.kind) {
    case 'normal': {
      const { mu } = spec;
      const sd = Math.sqrt(spec.sigma2);
      return (out) => {
        for (let i = 0; i < out.length; i++) out[i] = mu + sd * rng.normal();
      };
    }
    case 'uniform': {
      const { theta } = spec;
      return (out) => {
        for (let i = 0; i < out.length; i++) out[i] = theta * rng.uniform();
      };
    }
    case 't': {
      const { mu, scale, df } = spec;
      return (out) => {
        for (let i = 0; i < out.length; i++) {
          let chi2 = 0;
          for (let j = 0; j < df; j++) {
            const z = rng.normal();
            chi2 += z * z;
          }
          out[i] = mu + scale * (rng.normal() / Math.sqrt(chi2 / df));
        }
      };
    }
    case 'contaminated': {
      const { mu, eps, k } = spec;
      const sd = Math.sqrt(spec.sigma2);
      return (out) => {
        for (let i = 0; i < out.length; i++) {
          const s = rng.uniform() < eps ? k * sd : sd;
          out[i] = mu + s * rng.normal();
        }
      };
    }
    case 'cauchy': {
      const { mu, scale } = spec;
      return (out) => {
        for (let i = 0; i < out.length; i++) out[i] = mu + scale * (rng.normal() / rng.normal());
      };
    }
  }
}

/** 분포의 중심(대칭 분포의 위치) — 위치 추정량의 참값 */
export function center(spec: DistSpec): number {
  return spec.kind === 'uniform' ? spec.theta / 2 : spec.mu;
}
