import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp({ adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir: 'runs' });

describe('GET /api/digest/:night', () => {
  it('returns the night as JSON, rows sorted by job', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: { job: string }[] };
    expect(body.night).toBe('2026-10-28');
    expect(body.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('404s when there is no run log', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for 2026-01-01' });
  });
});
