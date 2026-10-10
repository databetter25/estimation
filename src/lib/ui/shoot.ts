import { Rng } from '../engine/rng';
import { ESTIMATORS, summarize, type EstimatorId } from '../engine/estimators';
import { computeMetrics, classifyGroup } from '../engine/stats';
import { drawTarget, fmt } from './charts';
import { TYPE_LABEL } from './typeLabels';

const THETA = 10;
const N = 20;
const EXTENT = 3;
const IDS: EstimatorId[] = ['umvue', 'xmax', 'mme'];
const MIN_SHOTS_FOR_BADGE = 100;
const MAX_SHOTS = 3000;

export function initShoot(root: HTMLElement) {
  let rng = new Rng(20261010);
  const est: Record<string, number[]> = Object.fromEntries(IDS.map((id) => [id, []]));
  let lastSample: Float64Array | null = null;
  let anim = 0;
  const shotsEl = root.querySelector<HTMLElement>('[data-shots]')!;
  const samplesEl = root.querySelector<HTMLElement>('[data-samples]')!;
  const strip = root.querySelector<SVGSVGElement>('[data-strip]')!;

  function shootOnce() {
    for (let k = 0; k < 2; k++) {
      const x = new Float64Array(N);
      for (let i = 0; i < N; i++) x[i] = THETA * rng.uniform();
      lastSample = Float64Array.from(x);
      const s = summarize(x, false);
      for (const id of IDS) est[id].push(ESTIMATORS[id].compute(s));
    }
  }

  function render(highlight: boolean) {
    const shots = est[IDS[0]].length / 2;
    shotsEl.textContent = String(shots);
    samplesEl.textContent = String(shots * 2);
    const metrics = Object.fromEntries(IDS.map((id) => [id, computeMetrics(Float64Array.from(est[id]), THETA)]));
    const cls = shots >= MIN_SHOTS_FOR_BADGE ? classifyGroup(metrics) : null;
    for (const id of IDS) {
      const card = root.querySelector<HTMLElement>(`[data-est="${id}"]`)!;
      const dev = Float64Array.from(est[id], (v) => v - THETA);
      const m = metrics[id];
      drawTarget(card.querySelector('canvas')!, {
        dev,
        extent: EXTENT,
        bias: shots ? m.bias : NaN,
        sd: shots >= 2 ? m.sd : NaN,
        highlightLast: highlight,
      });
      const badge = card.querySelector<HTMLElement>('[data-type]')!;
      if (cls) {
        const t = TYPE_LABEL[cls[id].type];
        badge.className = `badge ${t.cls}`;
        badge.textContent = t.text;
      } else {
        badge.className = 'badge badge-gray';
        badge.textContent = shots ? '모으는 중' : '대기';
      }
      card.querySelector('[data-k="bias"]')!.textContent = shots ? fmt(m.bias) : '—';
      card.querySelector('[data-k="sd"]')!.textContent = shots >= 2 ? fmt(m.sd) : '—';
      card.querySelector('[data-k="mse"]')!.textContent = shots ? fmt(m.mse) : '—';
    }
    drawStrip();
  }

  function drawStrip() {
    const W = 640;
    const H = 64;
    const lo = 0;
    const hi = 13;
    const X = (v: number) => 16 + ((v - lo) / (hi - lo)) * (W - 32);
    const parts: string[] = [];
    parts.push(`<line x1="${X(0)}" x2="${X(hi)}" y1="40" y2="40" stroke="var(--viz-axis)" />`);
    for (let t = 0; t <= 12; t += 2) {
      parts.push(`<line x1="${X(t)}" x2="${X(t)}" y1="37" y2="43" stroke="var(--viz-axis)" />`);
      parts.push(`<text x="${X(t)}" y="56" text-anchor="middle" font-size="11" fill="var(--viz-muted)">${t}</text>`);
    }
    parts.push(
      `<line x1="${X(THETA)}" x2="${X(THETA)}" y1="8" y2="62" stroke="var(--viz-ink)" stroke-width="2" />`,
      `<text x="${X(THETA) + 5}" y="16" font-size="11" fill="var(--viz-ink-2)">θ</text>`,
    );
    if (lastSample) {
      for (const v of lastSample) {
        parts.push(`<circle cx="${X(v)}" cy="40" r="4" fill="var(--viz-muted)" opacity="0.65" />`);
      }
      const s = summarize(Float64Array.from(lastSample), false);
      const marks: [EstimatorId, string][] = [
        ['umvue', 'var(--viz-s3)'],
        ['xmax', 'var(--viz-s2)'],
        ['mme', 'var(--viz-s1)'],
      ];
      for (const [id, color] of marks) {
        const x = Math.min(X(ESTIMATORS[id].compute(s)), W - 6);
        parts.push(`<path d="M${x},30 l-5,-9 h10 z" fill="${color}" stroke="var(--viz-surface)" stroke-width="1.5" />`);
      }
    } else {
      parts.push(`<text x="${W / 2}" y="20" text-anchor="middle" font-size="12" fill="var(--viz-muted)">[한 발 쏘기]를 누르면 표본이 나타납니다</text>`);
    }
    strip.setAttribute('viewBox', `0 0 ${W} ${H + 8}`);
    strip.innerHTML = parts.join('');
  }

  function shoot(k: number) {
    cancelAnimationFrame(anim);
    if (k <= 10) {
      for (let i = 0; i < k; i++) shootOnce();
      render(true);
      return;
    }
    let left = k;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = () => {
      const batch = reduce ? left : Math.min(left, 6);
      for (let i = 0; i < batch; i++) shootOnce();
      left -= batch;
      render(true);
      if (left > 0 && est[IDS[0]].length / 2 < MAX_SHOTS) anim = requestAnimationFrame(step);
    };
    step();
  }

  root.querySelectorAll<HTMLButtonElement>('[data-shoot]').forEach((b) =>
    b.addEventListener('click', () => {
      if (est[IDS[0]].length / 2 >= MAX_SHOTS) return;
      shoot(+b.dataset.shoot!);
    }),
  );
  root.querySelector('[data-reset]')!.addEventListener('click', () => {
    cancelAnimationFrame(anim);
    rng = new Rng(Math.floor(Math.random() * 1e9));
    IDS.forEach((id) => (est[id] = []));
    lastSample = null;
    render(false);
  });
  document.addEventListener('themechange', () => render(false));
  let t = 0;
  new ResizeObserver(() => {
    clearTimeout(t);
    t = window.setTimeout(() => render(false), 120);
  }).observe(root);
  render(false);
}
