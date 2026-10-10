import type { DistSpec } from './distributions';
import type { EstimatorId } from './estimators';

/** 이론값. approx면 점근 근사식이다. */
export interface Theory {
  mean: number;
  variance: number;
  mse: number;
  approx?: boolean;
}

/**
 * 알려진 닫힌 형태의 이론값 (VIZ-3). 없으면 null.
 * truth는 추정 대상(참값)이다.
 */
export function theory(id: EstimatorId, dist: DistSpec, n: number, truth: number): Theory | null {
  const t = (mean: number, variance: number, approx = false): Theory => ({
    mean,
    variance,
    mse: variance + (mean - truth) ** 2,
    approx,
  });

  if (dist.kind === 'normal') {
    const { mu, sigma2 } = dist;
    switch (id) {
      case 'xbar':
        return t(mu, sigma2 / n);
      case 'median':
        return t(mu, (Math.PI / 2) * (sigma2 / n), true);
      case 's2':
        return t(sigma2, (2 * sigma2 * sigma2) / (n - 1));
      case 'sigma2mle':
        return t(((n - 1) / n) * sigma2, (2 * (n - 1) * sigma2 * sigma2) / (n * n));
    }
    return null;
  }

  if (dist.kind === 'uniform') {
    const th = dist.theta;
    switch (id) {
      case 'umvue':
        return t(th, (th * th) / (n * (n + 2)));
      case 'xmax':
        return t((n / (n + 1)) * th, (n * th * th) / ((n + 1) ** 2 * (n + 2)));
      case 'mme':
        return t(th, (th * th) / (3 * n));
    }
    return null;
  }

  if (dist.kind === 't' && id === 'xbar' && dist.df > 2) {
    return t(dist.mu, (dist.scale ** 2 * dist.df) / (dist.df - 2) / n);
  }
  if (dist.kind === 'contaminated' && id === 'xbar') {
    const v = dist.sigma2 * (1 - dist.eps + dist.eps * dist.k * dist.k);
    return t(dist.mu, v / n);
  }
  return null;
}

/**
 * 크래머-라오 하한 (Cramér-Rao Lower Bound, CRLB).
 * null이면 정칙조건이 깨져 적용할 수 없다는 뜻.
 */
export function crlb(param: 'mu' | 'sigma2' | 'theta', dist: DistSpec, n: number): number | null {
  if (dist.kind === 'normal') {
    if (param === 'mu') return dist.sigma2 / n;
    if (param === 'sigma2') return (2 * dist.sigma2 * dist.sigma2) / n;
  }
  // U(0, θ): 지지집합이 θ에 의존 → 정칙조건 위반
  return null;
}
