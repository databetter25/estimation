/** 과녁 유형 배지 (§4.4). 색 + 글자로 이중 표기한다. */
export const TYPE_LABEL: Record<string, { text: string; cls: string; long: string }> = {
  a: { text: '(a) 불편·고효율', cls: 'badge-green', long: '편향이 없고 분산이 작다' },
  b: { text: '(b) 편향·고효율', cls: 'badge-yellow', long: '중심에서 벗어났지만 조밀하다' },
  c: { text: '(c) 불편·저효율', cls: 'badge-blue', long: '중심은 맞지만 넓게 퍼진다' },
  d: { text: '(d) 편향·저효율', cls: 'badge-red', long: '중심에서 벗어나고 넓게 퍼진다' },
  /** 기댓값이 존재하지 않아 편향을 정의할 수 없음 (코시 분포의 X̄) */
  none: { text: '기댓값 없음', cls: 'badge-red', long: '추정량의 기댓값과 분산이 존재하지 않는다' },
};
