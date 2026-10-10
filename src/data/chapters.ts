export interface Chapter {
  /** base 없는 경로 */
  path: string;
  num: string;
  title: string;
  kind: '개념' | '실험실' | '개념 + 실험';
  summary: string;
}

export const CHAPTERS: Chapter[] = [
  {
    path: 'learn/statistic',
    num: '0',
    title: '왜 통계량인가',
    kind: '개념',
    summary: '통계량은 미지의 모수를 밝혀내기 위한 도구다. 데이터 압축, 조준경, 그리고 추정량과의 위계.',
  },
  {
    path: 'learn/why-optimal',
    num: '1',
    title: "왜 '최적'을 따지는가",
    kind: '개념',
    summary: '표본은 단 한 번뿐이고, 틀린 추정에는 비용이 따른다. 최적성이 필요한 네 가지 이유.',
  },
  {
    path: 'learn/methods',
    num: '2',
    title: '추정량 만드는 법',
    kind: '개념',
    summary: '적률추정법과 최대가능도추정법으로 후보를 만들고, 충분성·완비성으로 UMVUE에 도달한다.',
  },
  {
    path: 'learn/criteria',
    num: '3',
    title: '좋은 추정량의 기준과 과녁',
    kind: '개념 + 실험',
    summary: '불편성·효율성·MSE를 과녁 위의 탄착군으로 본다. 한 발씩 직접 쏴 보자.',
  },
  {
    path: 'lab/mu',
    num: '4-1',
    title: '실험실: 정규분포 위치 μ',
    kind: '실험실',
    summary: '표본평균, 절사평균, 중앙값, 중앙범위 — 모두 불편이지만 효율은 다르다.',
  },
  {
    path: 'lab/sigma2',
    num: '4-2',
    title: '실험실: 정규분포 산포 σ²',
    kind: '실험실',
    summary: '편향이 있는 MLE가 불편추정량보다 MSE가 작다. 편향-분산 절충의 현장.',
  },
  {
    path: 'lab/uniform',
    num: '4-3',
    title: '실험실: 균등분포 상한 θ',
    kind: '실험실',
    summary: 'MME, MLE, UMVUE가 과녁 (c), (b), (a)에 정확히 하나씩 대응하는 비정규 모형.',
  },
  {
    path: 'consistency',
    num: '5',
    title: '일치성',
    kind: '실험실',
    summary: '표본이 커지면 편향은 사라지고 분포는 참값으로 모인다. 수렴 속도 1/n 과 1/n².',
  },
  {
    path: 'limits',
    num: '6',
    title: '최적성의 한계',
    kind: '개념 + 실험',
    summary: '가정이 깨지면 최적 추정량도 무너진다. 코시 분포에서 표본평균은 어떻게 되는가.',
  },
  {
    path: 'summary',
    num: '7',
    title: '정리: MLE와 성질 기반 접근',
    kind: '개념',
    summary: '평가 기준(목표)과 도출 기법(엔진)의 관계, 그리고 용어집.',
  },
];

export function chapterIndex(path: string): number {
  return CHAPTERS.findIndex((c) => c.path === path);
}
