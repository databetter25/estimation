/**
 * 차트 그리기 (TGT-1~3, VIZ-1, VIZ-2, CON-1, CON-3).
 * 색은 모두 CSS 변수(--viz-*)에서 읽어 라이트/다크 모드를 따른다.
 */

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** 캔버스를 CSS 크기 × devicePixelRatio 로 맞추고 컨텍스트를 돌려준다. */
export function setupCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  return ctx;
}

export function fmt(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : '—';
  const a = Math.abs(x);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return x.toExponential(2).replace(/-/g, '−');
  const s = a >= 100 ? x.toFixed(1) : a >= 10 ? x.toFixed(2) : x.toFixed(digits);
  return s.replace(/-/g, '−');
}

/* ───────── Tooltip ───────── */
let tipEl: HTMLDivElement | null = null;
export function showTip(html: string, clientX: number, clientY: number) {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'viz-tip';
    tipEl.setAttribute('role', 'status');
    document.body.appendChild(tipEl);
  }
  tipEl.innerHTML = html;
  const pad = 14;
  const w = tipEl.offsetWidth;
  const h = tipEl.offsetHeight;
  let x = clientX + pad;
  let y = clientY + pad;
  if (x + w > window.innerWidth - 8) x = clientX - w - pad;
  if (y + h > window.innerHeight - 8) y = clientY - h - pad;
  tipEl.style.left = `${Math.max(8, x)}px`;
  tipEl.style.top = `${Math.max(8, y)}px`;
  tipEl.classList.add('show');
}
export function hideTip() {
  tipEl?.classList.remove('show');
}

/* ───────── 과녁 ───────── */
export interface TargetInput {
  /** θ̂ - θ (길이 B). 연속한 두 값을 한 점으로 묶는다. */
  dev: Float64Array;
  extent: number;
  bias: number;
  sd: number;
  /** 애니메이션 모드: 마지막 점 강조 */
  highlightLast?: boolean;
}

export interface TargetDrawn {
  outside: number;
  points: number;
  /** 화면 좌표 → 데이터 좌표 변환 */
  toData: (px: number, py: number) => [number, number];
  size: number;
}

export function drawTarget(canvas: HTMLCanvasElement, inp: TargetInput): TargetDrawn {
  const size = Math.max(160, canvas.clientWidth || canvas.parentElement!.clientWidth);
  const ctx = setupCanvas(canvas, size, size);
  const c = size / 2;
  const R = c - 6;
  const s = R / inp.extent; // px per unit

  const ring = cssVar('--viz-ring');
  const ring2 = cssVar('--viz-ring-2');
  const grid = cssVar('--viz-grid');
  const ink = cssVar('--viz-ink');
  const ink2 = cssVar('--viz-ink-2');
  const s1 = cssVar('--viz-s1');
  const surface = cssVar('--viz-surface');

  // 동심원 (4개, 고정 단위 = extent/4)
  for (let k = 4; k >= 1; k--) {
    ctx.beginPath();
    ctx.arc(c, c, (R * k) / 4, 0, Math.PI * 2);
    ctx.fillStyle = k % 2 === 0 ? ring2 : ring;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = grid;
    ctx.stroke();
  }
  // 십자선
  ctx.beginPath();
  ctx.moveTo(c - R, c);
  ctx.lineTo(c + R, c);
  ctx.moveTo(c, c - R);
  ctx.lineTo(c, c + R);
  ctx.strokeStyle = grid;
  ctx.stroke();

  // 탄착점
  const dev = inp.dev;
  const P = Math.floor(dev.length / 2);
  let outside = 0;
  const r = P > 3000 ? 1.4 : P > 800 ? 1.8 : 2.6;
  ctx.fillStyle = s1;
  ctx.globalAlpha = P > 3000 ? 0.35 : P > 800 ? 0.5 : 0.7;
  for (let k = 0; k < P; k++) {
    const dx = dev[2 * k];
    const dy = dev[2 * k + 1];
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx * dx + dy * dy > inp.extent * inp.extent) {
      outside++;
      continue;
    }
    ctx.beginPath();
    ctx.arc(c + dx * s, c - dy * s, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (inp.highlightLast && P > 0) {
    const dx = dev[2 * P - 2];
    const dy = dev[2 * P - 1];
    if (dx * dx + dy * dy <= inp.extent * inp.extent) {
      ctx.beginPath();
      ctx.arc(c + dx * s, c - dy * s, 6, 0, Math.PI * 2);
      ctx.fillStyle = s1;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = surface;
      ctx.stroke();
    }
  }

  // 참값(정중앙) 표시
  ctx.beginPath();
  ctx.arc(c, c, 3, 0, Math.PI * 2);
  ctx.fillStyle = ink2;
  ctx.fill();

  if (P >= 2 && Number.isFinite(inp.bias) && Number.isFinite(inp.sd)) {
    const mx = c + inp.bias * s;
    const my = c - inp.bias * s;
    // 1-SD 원 (두 좌표의 표준편차가 같으므로 원)
    const rs = inp.sd * s;
    if (rs < R * 1.5) {
      ctx.beginPath();
      ctx.arc(mx, my, rs, 0, Math.PI * 2);
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ink;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 탄착군 중심
    if (Math.abs(inp.bias) <= inp.extent) {
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = surface;
      ctx.stroke();
    }
  }

  return {
    outside,
    points: P,
    size,
    toData: (px, py) => [(px - c) / s, (c - py) / s],
  };
}

/* ───────── 히스토그램 ───────── */
export interface HistInput {
  values: Float64Array;
  truth: number;
  extent: number;
  mean: number;
  bins?: number;
  height?: number;
}
export interface HistDrawn {
  counts: number[];
  lo: number;
  width: number;
  binW: number;
  pad: { l: number; r: number; t: number; b: number };
  plotW: number;
}

export function drawHistogram(canvas: HTMLCanvasElement, inp: HistInput): HistDrawn {
  const W = Math.max(160, canvas.clientWidth || canvas.parentElement!.clientWidth);
  const H = inp.height ?? 96;
  const ctx = setupCanvas(canvas, W, H);
  const pad = { l: 6, r: 6, t: 8, b: 20 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const bins = inp.bins ?? 41;
  const lo = inp.truth - inp.extent;
  const binW = (2 * inp.extent) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of inp.values) {
    const i = Math.floor((v - lo) / binW);
    if (i >= 0 && i < bins) counts[i]++;
  }
  const max = Math.max(1, ...counts);
  const x = (v: number) => pad.l + ((v - lo) / (2 * inp.extent)) * plotW;
  const bw = plotW / bins;

  ctx.fillStyle = cssVar('--viz-s1');
  for (let i = 0; i < bins; i++) {
    if (!counts[i]) continue;
    const h = (counts[i] / max) * plotH;
    const x0 = pad.l + i * bw + 1;
    const w = Math.max(1, bw - 2);
    roundTopRect(ctx, x0, pad.t + plotH - h, w, h, Math.min(2, w / 2));
  }
  // 기준선
  ctx.fillStyle = cssVar('--viz-axis');
  ctx.fillRect(pad.l, pad.t + plotH, plotW, 1);

  // 참값 선 (실선) / 평균 선 (점선)
  ctx.lineWidth = 2;
  ctx.strokeStyle = cssVar('--viz-ink');
  line(ctx, x(inp.truth), pad.t - 4, x(inp.truth), pad.t + plotH);
  if (Number.isFinite(inp.mean) && Math.abs(inp.mean - inp.truth) <= inp.extent) {
    ctx.strokeStyle = cssVar('--viz-s2');
    ctx.setLineDash([4, 3]);
    line(ctx, x(inp.mean), pad.t - 4, x(inp.mean), pad.t + plotH);
    ctx.setLineDash([]);
  }

  // 축 눈금
  ctx.fillStyle = cssVar('--viz-muted');
  ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
  ctx.textBaseline = 'top';
  const ticks = [lo, inp.truth, inp.truth + inp.extent];
  ticks.forEach((t, i) => {
    ctx.textAlign = i === 0 ? 'left' : i === 2 ? 'right' : 'center';
    ctx.fillText(fmt(t, 2), x(t), pad.t + plotH + 5);
  });

  return { counts, lo, width: W, binW, pad, plotW };
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function roundTopRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

/* ───────── SVG 선 그래프 (밀도곡선, 로그-로그) ───────── */
export interface Series {
  label: string;
  color: string;
  points: [number, number][];
  dashed?: boolean;
  /** 점 표시 (시뮬레이션 값) */
  markers?: boolean;
}

export interface LineChartOpts {
  width: number;
  height: number;
  xDomain: [number, number];
  yDomain: [number, number];
  logX?: boolean;
  logY?: boolean;
  xTicks: number[];
  yTicks: number[];
  xLabel: string;
  yLabel: string;
  vline?: { x: number; label: string };
  tickFmt?: (v: number) => string;
}

const NS = 'http://www.w3.org/2000/svg';

export function lineChart(svg: SVGSVGElement, series: Series[], o: LineChartOpts) {
  const pad = { l: 52, r: 14, t: 14, b: 42 };
  const W = o.width;
  const H = o.height;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.replaceChildren();
  const tx = (v: number) => (o.logX ? Math.log10(v) : v);
  const ty = (v: number) => (o.logY ? Math.log10(v) : v);
  const [x0, x1] = o.xDomain.map(tx);
  const [y0, y1] = o.yDomain.map(ty);
  const X = (v: number) => pad.l + ((tx(v) - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const Y = (v: number) => H - pad.b - ((ty(v) - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const f = o.tickFmt ?? ((v: number) => fmt(v, 2));

  const el = (tag: string, attrs: Record<string, string | number>, parent: Element = svg) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    parent.appendChild(e);
    return e;
  };

  // 그리드 + 눈금
  for (const t of o.yTicks) {
    el('line', { x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t), stroke: 'var(--viz-grid)', 'stroke-width': 1 });
    const lab = el('text', { x: pad.l - 8, y: Y(t) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--viz-muted)' });
    lab.textContent = f(t);
  }
  for (const t of o.xTicks) {
    const lab = el('text', { x: X(t), y: H - pad.b + 18, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--viz-muted)' });
    lab.textContent = f(t);
  }
  el('line', { x1: pad.l, x2: W - pad.r, y1: H - pad.b, y2: H - pad.b, stroke: 'var(--viz-axis)', 'stroke-width': 1 });
  const xl = el('text', { x: (pad.l + W - pad.r) / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--viz-ink-2)' });
  xl.textContent = o.xLabel;
  const yl = el('text', {
    x: 12,
    y: (pad.t + H - pad.b) / 2,
    'text-anchor': 'middle',
    'font-size': 12,
    fill: 'var(--viz-ink-2)',
    transform: `rotate(-90 12 ${(pad.t + H - pad.b) / 2})`,
  });
  yl.textContent = o.yLabel;

  if (o.vline) {
    el('line', {
      x1: X(o.vline.x),
      x2: X(o.vline.x),
      y1: pad.t,
      y2: H - pad.b,
      stroke: 'var(--viz-ink)',
      'stroke-width': 1.5,
      'stroke-dasharray': '4 3',
    });
    const t = el('text', { x: X(o.vline.x) + 6, y: pad.t + 10, 'font-size': 11, fill: 'var(--viz-ink-2)' });
    t.textContent = o.vline.label;
  }

  const clip = `clip-${Math.random().toString(36).slice(2)}`;
  const defs = el('defs', {});
  const cp = el('clipPath', { id: clip }, defs);
  el('rect', { x: pad.l, y: pad.t - 2, width: W - pad.l - pad.r, height: H - pad.t - pad.b + 4 }, cp);
  const g = el('g', { 'clip-path': `url(#${clip})` });

  const hits: { x: number; y: number; s: Series; p: [number, number] }[] = [];
  for (const s of series) {
    const d = s.points
      .filter(([, y]) => Number.isFinite(y) && (!o.logY || y > 0))
      .map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`)
      .join('');
    if (!s.markers || s.dashed) {
      el('path', {
        d,
        fill: 'none',
        stroke: s.color,
        'stroke-width': 2,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
        ...(s.dashed ? { 'stroke-dasharray': '6 4', opacity: 0.8 } : {}),
      }, g);
    }
    if (s.markers) {
      for (const p of s.points) {
        if (!Number.isFinite(p[1]) || (o.logY && p[1] <= 0)) continue;
        el('circle', {
          cx: X(p[0]),
          cy: Y(p[1]),
          r: 4.5,
          fill: s.color,
          stroke: 'var(--viz-surface)',
          'stroke-width': 2,
        }, g);
        hits.push({ x: X(p[0]), y: Y(p[1]), s, p });
      }
    }
  }

  // 호버: 가장 가까운 점
  if (hits.length) {
    svg.onpointermove = (ev) => {
      const rect = svg.getBoundingClientRect();
      const sx = ((ev.clientX - rect.left) / rect.width) * W;
      const sy = ((ev.clientY - rect.top) / rect.height) * H;
      let best = hits[0];
      let bd = Infinity;
      for (const h of hits) {
        const dd = (h.x - sx) ** 2 + (h.y - sy) ** 2;
        if (dd < bd) {
          bd = dd;
          best = h;
        }
      }
      if (bd > 30 * 30) return hideTip();
      showTip(
        `<b>${best.s.label}</b><br>${o.xLabel}: ${f(best.p[0])}<br>${o.yLabel}: ${fmt(best.p[1])}`,
        ev.clientX,
        ev.clientY,
      );
    };
    svg.onpointerleave = hideTip;
  }
}
