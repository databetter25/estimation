/// <reference lib="webworker" />
import { simulate, type SimConfig } from './simulate';

export type WorkerRequest = { id: number; configs: SimConfig[] };
export type WorkerResponse =
  | { id: number; type: 'progress'; fraction: number }
  | { id: number; type: 'done'; results: Record<string, Float64Array>[] };

/** 여러 설정을 순서대로 실행한다 (일치성 실험처럼 n을 바꿔 가며 돌릴 때). */
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, configs } = e.data;
  const total = configs.reduce((s, c) => s + c.B * c.n, 0);
  let doneWork = 0;
  let lastPost = 0;
  const results = configs.map((cfg) => {
    const r = simulate(cfg, (done) => {
      const frac = (doneWork + done * cfg.n) / total;
      if (frac - lastPost > 0.02) {
        lastPost = frac;
        (self as unknown as Worker).postMessage({ id, type: 'progress', fraction: frac } satisfies WorkerResponse);
      }
    });
    doneWork += cfg.B * cfg.n;
    return r;
  });
  const transfer = results.flatMap((r) => Object.values(r).map((a) => a.buffer));
  (self as unknown as Worker).postMessage({ id, type: 'done', results } satisfies WorkerResponse, transfer);
};
