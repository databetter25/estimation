import { runInWorker } from '../engine/client';
import type { SimConfig } from '../engine/simulate';
import type { DistSpec } from '../engine/distributions';
import type { EstimatorId } from '../engine/estimators';
import { computeMetrics, kde } from '../engine/stats';
import { theory } from '../engine/theory';
import { lineChart, cssVar, fmt, type Series } from './charts';

const NS_DENS = [10, 50, 200, 1000];
const NS_RATE = [5, 10, 20, 50, 100, 200, 500, 1000];
const B_DENS = 2000;
const B_RATE = 1000;
const NORMAL: DistSpec = { kind: 'normal', mu: 10, sigma2: 4 };
const UNIFORM: DistSpec = { kind: 'uniform', theta: 10 };
const SIG_IDS: EstimatorId[] = ['s2', 'sigma2mle'];
const UNI_IDS: EstimatorId[] = ['umvue', 'xmax', 'mme'];
const LABEL: Record<string, string> = {
  s2: 'S²',
  sigma2mle: 'σ̂² (MLE)',
  umvue: '(n+1)/n·X(n) (UMVUE)',
  xmax: 'X(n) (MLE)',
  mme: '2X̄ (MME)',
};

export function initConsistency(root: HTMLElement) {
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const progress = root.querySelector<HTMLElement>('[data-progress]')!;
  const seedEl = root.querySelector<HTMLInputElement>('[data-seed]')!;
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
  let data: Awaited<ReturnType<typeof compute>> | null = null;

  async function compute(seed: number) {
    const configs: SimConfig[] = [
      ...NS_DENS.map((n, i) => ({ dist: NORMAL, n, B: B_DENS, seed: seed + i, estimators: SIG_IDS })),
      ...NS_RATE.map((n, i) => ({ dist: NORMAL, n, B: B_RATE, seed: seed + 100 + i, estimators: SIG_IDS })),
      ...NS_RATE.map((n, i) => ({ dist: UNIFORM, n, B: B_RATE, seed: seed + 200 + i, estimators: UNI_IDS })),
    ];
    const res = await runInWorker(configs, (f) => (progress.style.width = `${Math.round(f * 100)}%`));
    return {
      dens: res.slice(0, NS_DENS.length),
      sig: res.slice(NS_DENS.length, NS_DENS.length + NS_RATE.length),
      uni: res.slice(NS_DENS.length + NS_RATE.length),
    };
  }

  async function run() {
    const seed = Math.max(0, Math.round(+seedEl.value || 0));
    runBtn.disabled = true;
    status.textContent = '시뮬레이션 실행 중… (표본 약 1,300만 개)';
    const t0 = performance.now();
    data = await compute(seed);
    runBtn.disabled = false;
    status.textContent = `완료 · 시드 ${seed} · ${Math.round(performance.now() - t0)}ms`;
    setTimeout(() => (progress.style.width = '0%'), 500);
    draw();
  }

  function seqColors() {
    return ['--viz-seq-1', '--viz-seq-2', '--viz-seq-3', '--viz-seq-4'].map(cssVar);
  }

  function draw() {
    if (!data) return;
    const colors = seqColors();
    // 범례: n
    root.querySelector('[data-n-legend]')!.innerHTML = NS_DENS.map(
      (n, i) => `<span class="lg"><i class="sw-line" style="background:${colors[i]}"></i>n = ${n}</span>`,
    ).join('');

    // 밀도곡선 (CON-1)
    const xs = Array.from({ length: 241 }, (_, i) => (i / 240) * 10);
    for (const id of SIG_IDS) {
      const svg = root.querySelector<SVGSVGElement>(`[data-dens="${id}"]`)!;
      let ymax = 0;
      const series: Series[] = data.dens.map((r, i) => {
        const ys = kde(r[id], xs);
        ymax = Math.max(ymax, ...ys);
        return { label: `n = ${NS_DENS[i]}`, color: colors[i], points: xs.map((x, j) => [x, ys[j]] as [number, number]) };
      });
      const yTop = Math.ceil(ymax * 2) / 2;
      lineChart(svg, series, {
        width: 460,
        height: 260,
        xDomain: [0, 10],
        yDomain: [0, yTop],
        xTicks: [0, 2, 4, 6, 8, 10],
        yTicks: [0, yTop / 2, yTop],
        xLabel: '추정치',
        yLabel: '밀도',
        vline: { x: 4, label: 'σ² = 4' },
        tickFmt: (v) => String(+v.toFixed(2)),
      });
    }

    // 표
    const tbody = root.querySelector<HTMLElement>('[data-cons-table] tbody')!;
    tbody.innerHTML = data.dens
      .map((r, i) => {
        const a = computeMetrics(r.s2, 4);
        const b = computeMetrics(r.sigma2mle, 4);
        return `<tr><th scope="row" style="text-align:right">${NS_DENS[i]}</th><td>${fmt(a.bias)}</td><td>${fmt(a.mse)}</td><td>${fmt(b.bias)}</td><td>${fmt(b.mse)}</td><td>${fmt(b.mse / a.mse, 3)}</td></tr>`;
      })
      .join('');

    // 로그-로그 (CON-2, CON-3)
    const cat = ['--viz-s1', '--viz-s2', '--viz-s3'].map(cssVar);
    rate('sig', data.sig, SIG_IDS, NORMAL, 4, cat);
    rate('uni', data.uni, UNI_IDS, UNIFORM, 10, cat);
  }

  function rate(
    key: string,
    res: Record<string, Float64Array>[],
    ids: EstimatorId[],
    dist: DistSpec,
    truth: number,
    cat: string[],
  ) {
    const series: Series[] = [];
    let lo = Infinity;
    let hi = 0;
    ids.forEach((id, k) => {
      const sim = NS_RATE.map((n, i) => [n, computeMetrics(res[i][id], truth).mse] as [number, number]);
      const th = NS_RATE.map((n) => [n, theory(id, dist, n, truth)!.mse] as [number, number]);
      [...sim, ...th].forEach(([, y]) => {
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      });
      series.push({ label: `${LABEL[id]} 이론`, color: cat[k], points: th, dashed: true });
      series.push({ label: LABEL[id], color: cat[k], points: sim, markers: true });
    });
    const yLo = Math.pow(10, Math.floor(Math.log10(lo)));
    const yHi = Math.pow(10, Math.ceil(Math.log10(hi)));
    const yTicks: number[] = [];
    for (let v = yLo; v <= yHi * 1.0001; v *= 10) yTicks.push(v);
    lineChart(root.querySelector<SVGSVGElement>(`[data-loglog="${key}"]`)!, series, {
      width: 460,
      height: 280,
      xDomain: [4, 1250],
      yDomain: [yLo, yHi],
      logX: true,
      logY: true,
      xTicks: [5, 10, 50, 100, 500, 1000],
      yTicks,
      xLabel: '표본 크기 n',
      yLabel: 'MSE',
      tickFmt: (v) => (v >= 0.001 ? String(+v.toPrecision(3)) : `10${sup(Math.round(Math.log10(v)))}`),
    });
    root.querySelector(`[data-legend="${key}"]`)!.innerHTML = ids
      .map((id, k) => `<span class="lg"><i class="sw-dot" style="background:${cat[k]}"></i>${LABEL[id]}</span>`)
      .join('');
  }

  runBtn.addEventListener('click', run);
  document.addEventListener('themechange', draw);
  run();
}

/** 10의 거듭제곱 지수를 위첨자로 */
function sup(k: number): string {
  const map: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(k)
    .split('')
    .map((c) => map[c])
    .join('');
}
