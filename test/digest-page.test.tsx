import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp({ adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir: 'runs' });

describe('GET /digest/:night', () => {
  it('renders a known night', async () => {
    const res = await app.request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('digest · 2026-10-28');
    expect((html.match(/<tr/g) ?? []).length).toBe(6);
  });

  it('404s for a night with no log', async () => {
    const res = await app.request('/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for 2026-01-01');
  });
});
