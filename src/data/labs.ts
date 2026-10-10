import type { DistSpec } from '../lib/engine/distributions';
import type { EstimatorId } from '../lib/engine/estimators';

export type LabId = 'mu' | 'sigma2' | 'uniform' | 'robust';

export interface LabParam {
  key: string;
  /** 컨트롤 라벨 (KaTeX) */
  tex: string;
  name: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface DistOption {
  key: string;
  label: string;
  /** 짧은 설명 */
  hint: string;
  spec: DistSpec;
}

export interface LabDef {
  id: LabId;
  /** 추정 대상 모수의 KaTeX 기호 */
  paramTex: string;
  paramName: string;
  estimators: EstimatorId[];
  /** 상대효율의 기준 추정량 */
  reference: EstimatorId;
  crlbParam: 'mu' | 'sigma2' | 'theta';
  params: LabParam[];
  distOptions?: DistOption[];
  defaults: { n: number; B: number; seed: number };
  /** n의 최솟값 (σ² 추정은 n ≥ 3 이 의미 있음) */
  nMin: number;
  dist: (p: Record<string, number>, distKey?: string) => DistSpec;
  truth: (p: Record<string, number>, distKey?: string) => number;
}

const ROBUST_DISTS: DistOption[] = [
  { key: 'normal', label: '정규', hint: 'N(10, 4)', spec: { kind: 'normal', mu: 10, sigma2: 4 } },
  { key: 't3', label: 't₃', hint: '10 + 2·t₃ (두꺼운 꼬리)', spec: { kind: 't', mu: 10, scale: 2, df: 3 } },
  {
    key: 'contaminated',
    label: '오염 정규',
    hint: '90% N(10,4) + 10% N(10,100)',
    spec: { kind: 'contaminated', mu: 10, sigma2: 4, eps: 0.1, k: 5 },
  },
  { key: 'cauchy', label: '코시', hint: '위치 10, 척도 2 (평균이 없음)', spec: { kind: 'cauchy', mu: 10, scale: 2 } },
];

export const LABS: Record<LabId, LabDef> = {
  mu: {
    id: 'mu',
    paramTex: '\\mu',
    paramName: '위치 모수',
    estimators: ['xbar', 'trim10', 'median', 'midrange'],
    reference: 'xbar',
    crlbParam: 'mu',
    params: [
      { key: 'mu', tex: '\\mu', name: '참 평균', min: -100, max: 100, step: 1, default: 10 },
      { key: 'sigma2', tex: '\\sigma^2', name: '모분산', min: 0.25, max: 100, step: 0.25, default: 4 },
    ],
    defaults: { n: 25, B: 2000, seed: 2026 },
    nMin: 2,
    dist: (p) => ({ kind: 'normal', mu: p.mu, sigma2: p.sigma2 }),
    truth: (p) => p.mu,
  },
  sigma2: {
    id: 'sigma2',
    paramTex: '\\sigma^2',
    paramName: '산포 모수',
    estimators: ['s2', 'sigma2mle', 'sigma2iqr'],
    reference: 's2',
    crlbParam: 'sigma2',
    params: [
      { key: 'sigma2', tex: '\\sigma^2', name: '참 분산', min: 0.25, max: 100, step: 0.25, default: 4 },
      { key: 'mu', tex: '\\mu', name: '모평균', min: -100, max: 100, step: 1, default: 10 },
    ],
    defaults: { n: 25, B: 2000, seed: 2026 },
    nMin: 3,
    dist: (p) => ({ kind: 'normal', mu: p.mu, sigma2: p.sigma2 }),
    truth: (p) => p.sigma2,
  },
  uniform: {
    id: 'uniform',
    paramTex: '\\theta',
    paramName: '상한 모수',
    estimators: ['umvue', 'xmax', 'mme'],
    reference: 'umvue',
    crlbParam: 'theta',
    params: [{ key: 'theta', tex: '\\theta', name: '참 상한', min: 0.5, max: 1000, step: 0.5, default: 10 }],
    defaults: { n: 20, B: 2000, seed: 2026 },
    nMin: 2,
    dist: (p) => ({ kind: 'uniform', theta: p.theta }),
    truth: (p) => p.theta,
  },
  robust: {
    id: 'robust',
    paramTex: '\\mu',
    paramName: '중심 위치',
    estimators: ['xbar', 'trim10', 'median'],
    reference: 'xbar',
    crlbParam: 'mu',
    params: [],
    distOptions: ROBUST_DISTS,
    defaults: { n: 25, B: 2000, seed: 2026 },
    nMin: 3,
    dist: (_p, key) => (ROBUST_DISTS.find((d) => d.key === key) ?? ROBUST_DISTS[0]).spec,
    truth: () => 10,
  },
};

export const N_MAX = 1000;
export const B_MIN = 100;
export const B_MAX = 20000;
