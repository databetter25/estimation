import { LABS, type LabDef, N_MAX } from '../../data/labs';
import { ESTIMATOR_META } from '../../data/estimators';
import { runInWorker } from '../engine/client';
import { computeMetrics, classifyGroup, groupExtent, type Metrics } from '../engine/stats';
import { theory, crlb } from '../engine/theory';
import type { EstimatorId } from '../engine/estimators';
import type { SimResult } from '../engine/simulate';
import { drawTarget, drawHistogram, fmt, showTip, hideTip, type TargetDrawn, type HistDrawn } from './charts';
import { TYPE_LABEL } from './typeLabels';

interface LastRun {
  res: SimResult;
  truth: number;
  metrics: Record<string, Metrics>;
  extent: number;
}

export function initLab(root: HTMLElement) {
  const def: LabDef = LABS[root.dataset.lab as keyof typeof LABS];
  const form = root.querySelector<HTMLFormElement>('.lab-controls')!;
  const statusEl = root.querySelector<HTMLElement>('[data-status]')!;
  const progress = root.querySelector<HTMLElement>('[data-progress]')!;
  const runBtn = root.querySelector<HTMLButtonElement>('[data-run]')!;
  const nInput = form.elements.namedItem('n') as HTMLInputElement;
  const nRange = form.elements.namedItem('n_range') as HTMLInputElement;
  const BSel = form.elements.namedItem('B') as HTMLSelectElement;
  const seedInput = form.elements.namedItem('seed') as HTMLInputElement;
  const distBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-dist]')];
  const distHint = root.querySelector<HTMLElement>('[data-dist-hint]');
  let distKey = def.distOptions?.[0].key;
  let runToken = 0;
  let last: LastRun | null = null;
  const drawn = new Map<string, { target: TargetDrawn; hist: HistDrawn }>();

  /* ── URL → 컨트롤 (LAB-5) ── */
  const qs = new URLSearchParams(location.search);
  const setNum = (input: HTMLInputElement, v: string | null) => {
    if (v !== null && v !== '' && Number.isFinite(+v)) input.value = String(+v);
  };
  setNum(nInput, qs.get('n'));
  setNum(seedInput, qs.get('seed'));
  if (qs.get('B') && [...BSel.options].some((o) => o.value === qs.get('B'))) BSel.value = qs.get('B')!;
  for (const p of def.params) setNum(form.elements.namedItem(`p_${p.key}`) as HTMLInputElement, qs.get(p.key));
  if (qs.get('dist') && def.distOptions?.some((d) => d.key === qs.get('dist'))) distKey = qs.get('dist')!;
  const showParam = qs.get('show');
  if (showParam) {
    const set = new Set(showParam.split(','));
    form.querySelectorAll<HTMLInputElement>('input[name="show"]').forEach((cb) => (cb.checked = set.has(cb.value)));
  }
  nRange.value = String(Math.min(+nInput.value, +nRange.max));
  syncDistButtons();

  /* ── 이벤트 ── */
  nRange.addEventListener('input', () => {
    nInput.value = nRange.value;
  });
  nRange.addEventListener('change', () => run());
  nInput.addEventListener('input', () => {
    nRange.value = String(Math.min(+nInput.value || def.nMin, +nRange.max));
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    run();
  });
  root.querySelector('[data-reseed]')!.addEventListener('click', () => {
    seedInput.value = String(Math.floor(Math.random() * 1e9));
    run();
  });
  BSel.addEventListener('change', () => run());
  distBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      distKey = btn.dataset.dist!;
      syncDistButtons();
      run();
    }),
  );
  form.querySelectorAll<HTMLInputElement>('input[name="show"]').forEach((cb) =>
    cb.addEventListener('change', () => {
      applyVisibility();
      updateUrl();
      if (last) render(last);
    }),
  );
  root.querySelector('[data-share]')!.addEventListener('click', async () => {
    updateUrl();
    const msg = root.querySelector<HTMLElement>('[data-share-msg]')!;
    try {
      await navigator.clipboard.writeText(location.href);
      msg.textContent = '링크를 복사했습니다. 같은 링크를 열면 같은 결과가 나옵니다.';
    } catch {
      msg.textContent = location.href;
    }
  });

  // 질문 블록(LAB-4)과 프리셋 버튼이 실험 설정을 바꿀 수 있게
  root.ownerDocument.addEventListener('lab:apply', ((e: CustomEvent) => {
    const p = e.detail as Record<string, string | number>;
    if (p.n !== undefined) nInput.value = String(p.n);
    if (p.B !== undefined) BSel.value = String(p.B);
    if (p.seed !== undefined) seedInput.value = String(p.seed);
    if (p.dist !== undefined) {
      distKey = String(p.dist);
      syncDistButtons();
    }
    for (const prm of def.params) {
      if (p[prm.key] !== undefined) (form.elements.namedItem(`p_${prm.key}`) as HTMLInputElement).value = String(p[prm.key]);
    }
    nRange.value = String(Math.min(+nInput.value, +nRange.max));
    run();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }) as EventListener);

  // 크기 변화·테마 변화 시 다시 그리기
  let resizeTimer = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => last && render(last), 120);
  });
  ro.observe(root.querySelector('[data-cards]')!);
  document.addEventListener('themechange', () => last && render(last));

  attachHover();
  applyVisibility();
  run();

  /* ── 함수들 ── */
  function syncDistButtons() {
    distBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dist === distKey)));
    const opt = def.distOptions?.find((d) => d.key === distKey);
    if (distHint && opt) distHint.textContent = opt.hint;
  }

  function readParams(): Record<string, number> | null {
    const out: Record<string, number> = {};
    let ok = true;
    for (const p of def.params) {
      const el = form.elements.namedItem(`p_${p.key}`) as HTMLInputElement;
      const v = +el.value;
      const valid = el.value !== '' && Number.isFinite(v) && v >= p.min && v <= p.max;
      el.setAttribute('aria-invalid', String(!valid));
      if (!valid) ok = false;
      out[p.key] = v;
    }
    const n = Math.round(+nInput.value);
    const nValid = Number.isFinite(n) && n >= def.nMin && n <= N_MAX;
    nInput.setAttribute('aria-invalid', String(!nValid));
    const seed = Math.round(+seedInput.value);
    const seedValid = Number.isFinite(seed) && seed >= 0 && seed <= 4294967295;
    seedInput.setAttribute('aria-invalid', String(!seedValid));
    if (!ok || !nValid || !seedValid) {
      statusEl.textContent = `입력값을 확인하세요. n은 ${def.nMin}~${N_MAX} 사이, 시드는 0 이상의 정수입니다.`;
      return null;
    }
    out.n = n;
    out.seed = seed;
    out.B = +BSel.value;
    return out;
  }

  function shownIds(): EstimatorId[] {
    return [...form.querySelectorAll<HTMLInputElement>('input[name="show"]')]
      .filter((cb) => cb.checked)
      .map((cb) => cb.value as EstimatorId);
  }

  function applyVisibility() {
    const shown = new Set(shownIds());
    root.querySelectorAll<HTMLElement>('[data-est]').forEach((el) => {
      el.hidden = !shown.has(el.dataset.est as EstimatorId);
    });
  }

  function updateUrl() {
    const p = readParams();
    if (!p) return;
    const u = new URLSearchParams();
    u.set('n', String(p.n));
    u.set('B', String(p.B));
    u.set('seed', String(p.seed));
    for (const prm of def.params) u.set(prm.key, String(p[prm.key]));
    if (distKey && def.distOptions) u.set('dist', distKey);
    const shown = shownIds();
    if (shown.length !== def.estimators.length) u.set('show', shown.join(','));
    history.replaceState(null, '', `${location.pathname}?${u.toString()}`);
  }

  async function run() {
    const p = readParams();
    if (!p) return;
    const token = ++runToken;
    const dist = def.dist(p, distKey);
    const truth = def.truth(p, distKey);
    runBtn.disabled = true;
    root.setAttribute('aria-busy', 'true');
    statusEl.textContent = '시뮬레이션 실행 중…';
    progress.style.width = '0%';
    const t0 = performance.now();
    const [res] = await runInWorker(
      [{ dist, n: p.n, B: p.B, seed: p.seed, estimators: def.estimators }],
      (f) => token === runToken && (progress.style.width = `${Math.round(f * 100)}%`),
    );
    if (token !== runToken) return; // 더 새로운 실행이 있음
    const ms = performance.now() - t0;
    progress.style.width = '100%';
    runBtn.disabled = false;
    root.removeAttribute('aria-busy');

    const metrics: Record<string, Metrics> = {};
    for (const id of def.estimators) metrics[id] = computeMetrics(res[id], truth);
    const extent = groupExtent(Object.values(metrics));
    last = { res, truth, metrics, extent };
    render(last);
    fillTable(last, dist, p.n);
    updateUrl();
    statusEl.textContent = `n = ${p.n} · B = ${p.B.toLocaleString('ko-KR')}회 · 시드 ${p.seed} · 동심원 간격 ${fmt(extent / 4, 2)} · ${Math.round(ms)}ms`;
    root.dispatchEvent(new CustomEvent('lab:done', { detail: { n: p.n, metrics }, bubbles: true }));
    setTimeout(() => (progress.style.width = '0%'), 600);
  }

  function render({ res, truth, metrics, extent }: LastRun) {
    const cls = classifyGroup(metrics);
    const shown = shownIds();
    drawn.clear();
    for (const id of def.estimators) {
      const card = root.querySelector<HTMLElement>(`.est-card[data-est="${id}"]`)!;
      const m = metrics[id];
      const c = cls[id];
      setBadge(card.querySelector('[data-type]')!, undefinedMoment(id) ? 'none' : c.type);
      if (!shown.includes(id)) continue;
      const dev = new Float64Array(res[id].length);
      for (let i = 0; i < dev.length; i++) dev[i] = res[id][i] - truth;
      const target = drawTarget(card.querySelector<HTMLCanvasElement>('canvas.target')!, {
        dev,
        extent,
        bias: m.bias,
        sd: m.sd,
      });
      const hist = drawHistogram(card.querySelector<HTMLCanvasElement>('canvas.hist')!, {
        values: res[id],
        truth,
        extent,
        mean: m.mean,
      });
      drawn.set(id, { target, hist });
      const out = card.querySelector<HTMLElement>('[data-outside]')!;
      out.hidden = target.outside === 0;
      out.textContent = `범위 밖 ${target.outside.toLocaleString('ko-KR')}점`;
      card.querySelector('[data-k="bias"]')!.textContent = fmt(m.bias);
      card.querySelector('[data-k="variance"]')!.textContent = fmt(m.variance);
      card.querySelector('[data-k="mse"]')!.textContent = fmt(m.mse);
    }
    renderMseBars(metrics, shown);
  }

  /** 코시 분포에서 X̄는 기댓값이 없다 → 편향·분산 판정 대상이 아님 */
  function undefinedMoment(id: EstimatorId): boolean {
    return id === 'xbar' && def.dist({}, distKey).kind === 'cauchy';
  }

  function setBadge(el: Element, type: string) {
    const t = TYPE_LABEL[type];
    el.className = `badge ${t.cls}`;
    el.textContent = t.text;
    el.setAttribute('title', t.long);
  }

  function renderMseBars(metrics: Record<string, Metrics>, shown: EstimatorId[]) {
    const vals = shown.map((id) => metrics[id].mse).filter(Number.isFinite).sort((a, b) => b - a);
    let scale = vals[0] ?? 1;
    // 하나만 압도적으로 크면(코시의 X̄ 등) 나머지가 보이도록 축을 자른다
    if (vals.length > 1 && vals[0] > 10 * vals[1]) scale = vals[1] * 1.6;
    if (vals.length === 0) scale = 1;
    for (const id of def.estimators) {
      const row = root.querySelector<HTMLElement>(`.mse-row[data-est="${id}"]`)!;
      const m = metrics[id];
      const segV = row.querySelector<HTMLElement>('.mse-seg.var')!;
      const segB = row.querySelector<HTMLElement>('.mse-seg.bias')!;
      const cap = row.querySelector<HTMLElement>('.mse-cap')!;
      const total = Number.isFinite(m.mse) ? m.mse : Infinity;
      const capped = total > scale;
      const k = capped ? scale / total : 1;
      const b2 = m.bias * m.bias;
      const wV = (Math.min(m.variance * k, scale) / scale) * 92;
      const wB = Number.isFinite(b2) ? ((b2 * k) / scale) * 92 : 0;
      segV.style.width = `${wV}%`;
      segB.style.width = `${wB}%`;
      segB.style.display = wB < 0.4 ? 'none' : '';
      segV.classList.toggle('solo', wB < 0.4);
      cap.hidden = !capped;
      row.querySelector('[data-k="mse"]')!.textContent = fmt(m.mse);
      const track = row.querySelector<HTMLElement>('.mse-track')!;
      track.onpointermove = (ev) =>
        showTip(
          `<b>${ESTIMATOR_META[id].plain}</b> ${ESTIMATOR_META[id].name}<br>분산 ${fmt(m.variance)}<br>편향² ${fmt(b2)}<br>MSE ${fmt(m.mse)} (분산 비중 ${Math.round((m.variance / m.mse) * 100)}%)`,
          ev.clientX,
          ev.clientY,
        );
      track.onpointerleave = hideTip;
    }
  }

  function fillTable({ metrics, truth }: LastRun, dist: ReturnType<LabDef['dist']>, n: number) {
    const cls = classifyGroup(metrics);
    const ref = metrics[def.reference];
    for (const id of def.estimators) {
      const row = root.querySelector<HTMLElement>(`tr[data-est="${id}"]`)!;
      const m = metrics[id];
      const th = theory(id, dist, n, truth);
      const set = (k: string, v: string) => (row.querySelector(`[data-k="${k}"]`)!.innerHTML = v);
      const t = TYPE_LABEL[undefinedMoment(id) ? 'none' : cls[id].type];
      set('type', `<span class="badge ${t.cls}">${t.text}</span>`);
      set('mean', fmt(m.mean));
      set('bias', fmt(m.bias));
      set('variance', fmt(m.variance));
      set('mse', `${fmt(m.mse)} <span style="color:var(--c-text-tertiary)">± ${fmt(m.seMse, 3)}</span>`);
      set('theory', undefinedMoment(id) ? '존재하지 않음' : th ? `${th.approx ? '≈ ' : ''}${fmt(th.mse)}` : '—');
      const re = ref.variance / m.variance;
      set('releff', id === def.reference ? '1 (기준)' : fmt(re, 2));
    }
    const crlbEl = root.querySelector<HTMLElement>('[data-crlb]')!;
    const bound = crlb(def.crlbParam, dist, n);
    if (bound !== null) {
      crlbEl.textContent = `크래머-라오 하한(Cramér-Rao Lower Bound, CRLB): 불편추정량의 분산은 ${fmt(bound)} 아래로 내려갈 수 없습니다.`;
    } else if (dist.kind === 'uniform') {
      crlbEl.textContent =
        '크래머-라오 하한(CRLB)은 여기에 적용되지 않습니다. U(0, θ)는 지지집합이 θ에 따라 달라져 정칙조건이 깨지기 때문입니다. 그래서 UMVUE의 분산이 O(1/n²)로 1/n 하한보다 빠르게 줄어들 수 있습니다.';
    } else {
      crlbEl.textContent = '정규분포가 아닌 모집단에서는 정규분포 기준의 CRLB를 비교 기준으로 쓸 수 없어 생략합니다.';
    }
  }

  function attachHover() {
    for (const id of def.estimators) {
      const card = root.querySelector<HTMLElement>(`.est-card[data-est="${id}"]`)!;
      const tc = card.querySelector<HTMLCanvasElement>('canvas.target')!;
      const hc = card.querySelector<HTMLCanvasElement>('canvas.hist')!;
      tc.addEventListener('pointermove', (ev) => {
        const d = drawn.get(id);
        if (!d || !last) return;
        const rect = tc.getBoundingClientRect();
        const [dx, dy] = d.target.toData(ev.clientX - rect.left, ev.clientY - rect.top);
        const r = Math.sqrt(dx * dx + dy * dy);
        const m = last.metrics[id];
        showTip(
          `<b>${ESTIMATOR_META[id].plain}</b><br>커서 위치: 참값에서 ${fmt(r, 2)} 떨어짐<br>탄착군 중심: (${fmt(m.bias)}, ${fmt(m.bias)})<br>표준편차: ${fmt(m.sd)}`,
          ev.clientX,
          ev.clientY,
        );
      });
      tc.addEventListener('pointerleave', hideTip);
      hc.addEventListener('pointermove', (ev) => {
        const d = drawn.get(id);
        if (!d || !last) return;
        const rect = hc.getBoundingClientRect();
        const x = ev.clientX - rect.left - d.hist.pad.l;
        const i = Math.floor((x / d.hist.plotW) * d.hist.counts.length);
        if (i < 0 || i >= d.hist.counts.length) return hideTip();
        const a = d.hist.lo + i * d.hist.binW;
        const B = last.res[id].length;
        showTip(
          `[${fmt(a, 2)}, ${fmt(a + d.hist.binW, 2)})<br>${d.hist.counts[i]}회 (${((d.hist.counts[i] / B) * 100).toFixed(1)}%)`,
          ev.clientX,
          ev.clientY,
        );
      });
      hc.addEventListener('pointerleave', hideTip);
    }
  }
}
