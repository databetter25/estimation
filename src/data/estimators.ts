import type { EstimatorId } from '../lib/engine/estimators';

export interface EstimatorMeta {
  id: EstimatorId;
  /** 짧은 KaTeX 기호 */
  tex: string;
  /** 일반 텍스트 기호 (캔버스·툴팁용) */
  plain: string;
  name: string;
  /** 도출 방법 배지 */
  method: string;
  /** 정의식 (KaTeX, display) */
  formula: string;
  /** 도출 근거와 성질 (KaTeX 인라인은 $...$) */
  note: string;
}

export const ESTIMATOR_META: Record<EstimatorId, EstimatorMeta> = {
  xbar: {
    id: 'xbar',
    tex: '\\bar{X}',
    plain: 'X̄',
    name: '표본평균',
    method: '정규분포의 MLE · UMVUE',
    formula: '\\bar{X} = \\frac{1}{n}\\sum_{i=1}^{n} X_i',
    note: '정규분포에서 최대가능도추정량이자 적률추정량이다. 완비충분통계량의 함수이면서 불편이므로 UMVUE이고, 분산 $\\sigma^2/n$이 CRLB와 같다.',
  },
  trim10: {
    id: 'trim10',
    tex: '\\bar{X}_{0.1}',
    plain: 'X̄₀.₁',
    name: '10% 절사평균',
    method: '강건 추정량',
    formula: '\\bar{X}_{0.1} = \\frac{1}{n-2k}\\sum_{i=k+1}^{n-k} X_{(i)},\\quad k=\\lfloor 0.1n \\rfloor',
    note: '양쪽 끝 $k$개씩을 버리고 평균한다. 대칭 분포에서 불편이며, 정규분포에서는 $\\bar{X}$보다 효율이 아주 조금 낮다. 대신 이상치에 강하다.',
  },
  median: {
    id: 'median',
    tex: '\\tilde{X}',
    plain: 'Median',
    name: '표본중앙값',
    method: '강건 추정량',
    formula: '\\tilde{X} = \\mathrm{Median}(X_1,\\dots,X_n)',
    note: '대칭 분포에서 불편이다. 정규분포에서 $\\mathrm{Var}(\\tilde{X}) \\approx \\frac{\\pi}{2}\\frac{\\sigma^2}{n} \\approx 1.57\\,\\mathrm{Var}(\\bar{X})$로 효율이 낮다.',
  },
  midrange: {
    id: 'midrange',
    tex: '\\tfrac{X_{(1)}+X_{(n)}}{2}',
    plain: 'Mid-range',
    name: '중앙범위',
    method: '순서통계량',
    formula: '\\text{Mid-range} = \\frac{X_{(1)}+X_{(n)}}{2}',
    note: '양 끝 극단값만 쓴다. 불편이지만 정보를 거의 버리므로 정규분포에서 분산이 가장 크다.',
  },
  s2: {
    id: 's2',
    tex: 'S^2',
    plain: 'S²',
    name: '표본분산',
    method: 'UMVUE',
    formula: 'S^2 = \\frac{1}{n-1}\\sum_{i=1}^{n}(X_i-\\bar{X})^2',
    note: '$E[S^2]=\\sigma^2$로 불편이고, 완비충분통계량 $(\\bar X, \\sum X_i^2)$의 함수이므로 레만-셰페 정리에 의해 UMVUE다. $\\mathrm{Var}(S^2)=\\frac{2\\sigma^4}{n-1}$.',
  },
  sigma2mle: {
    id: 'sigma2mle',
    tex: '\\hat{\\sigma}^2',
    plain: 'σ̂²',
    name: '분산의 최대가능도추정량',
    method: 'MLE',
    formula: '\\hat{\\sigma}^2 = \\frac{1}{n}\\sum_{i=1}^{n}(X_i-\\bar{X})^2',
    note: '$E[\\hat\\sigma^2]=\\frac{n-1}{n}\\sigma^2$로 과소추정 편향이 있다. 대신 분산 $\\frac{2(n-1)\\sigma^4}{n^2}$이 $S^2$보다 작다.',
  },
  sigma2iqr: {
    id: 'sigma2iqr',
    tex: '\\hat{\\sigma}^2_{\\mathrm{IQR}}',
    plain: 'σ̂²(IQR)',
    name: '사분위수범위 변환 추정량',
    method: '강건 추정량',
    formula: '\\hat{\\sigma}^2_{\\mathrm{IQR}} = \\left(\\frac{Q_3-Q_1}{1.349}\\right)^2',
    note: '정규분포에서 $Q_3-Q_1 \\approx 1.349\\sigma$임을 이용한다. 이상치에 강하지만 정규분포에서는 효율 손실이 크고, 소표본에서는 아래쪽으로 편향된다. 분위수는 R type 7(NumPy linear) 정의.',
  },
  umvue: {
    id: 'umvue',
    tex: '\\tfrac{n+1}{n}X_{(n)}',
    plain: '(n+1)/n·X(n)',
    name: '균등분포 UMVUE',
    method: 'UMVUE',
    formula: '\\hat{\\theta}_{\\mathrm{UMVUE}} = \\frac{n+1}{n}X_{(n)}',
    note: '$X_{(n)}$은 $\\theta$의 완비충분통계량이다. 이를 불편하게 보정한 함수이므로 레만-셰페 정리에 의해 UMVUE다. 분산 $\\frac{\\theta^2}{n(n+2)} = O(1/n^2)$.',
  },
  xmax: {
    id: 'xmax',
    tex: 'X_{(n)}',
    plain: 'X(n)',
    name: '표본최댓값',
    method: 'MLE',
    formula: '\\hat{\\theta}_{\\mathrm{MLE}} = X_{(n)} = \\max(X_1,\\dots,X_n)',
    note: '가능도 $\\theta^{-n}\\,\\mathbb{1}(\\theta \\ge X_{(n)})$을 최대화한다. 항상 $\\theta$보다 작으므로 $E[X_{(n)}]=\\frac{n}{n+1}\\theta$로 음의 편향이 있다.',
  },
  mme: {
    id: 'mme',
    tex: '2\\bar{X}',
    plain: '2X̄',
    name: '균등분포 적률추정량',
    method: 'MME',
    formula: '\\tilde{\\theta} = 2\\bar{X}',
    note: '$E[X]=\\theta/2$를 표본평균과 같다고 놓는다. 불편이지만 최댓값의 정보를 쓰지 못해 분산 $\\frac{\\theta^2}{3n} = O(1/n)$이 크다.',
  },
};
