import type { SimConfig, SimResult } from './simulate';
import type { WorkerResponse } from './worker';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (r: SimResult[]) => void; onProgress?: (f: number) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = pending.get(msg.id);
      if (!p) return;
      if (msg.type === 'progress') p.onProgress?.(msg.fraction);
      else {
        pending.delete(msg.id);
        p.resolve(msg.results);
      }
    };
  }
  return worker;
}

/** Web Worker에서 시뮬레이션을 실행한다 (SIM-6). */
export function runInWorker(
  configs: SimConfig[],
  onProgress?: (fraction: number) => void,
): Promise<SimResult[]> {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, { resolve, onProgress });
    getWorker().postMessage({ id, configs });
  });
}
