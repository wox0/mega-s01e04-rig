import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

// Normal night: three jobs. flaky retries 3 times then ok, broken fails, fine is plain ok.
writeFileSync(
  join(dir, '2026-02-01.jsonl'),
  [
    line('2026-02-01T01:00:00+01:00', 'nightly/flaky', 'retry', 'rook', 'upstream 503'),
    line('2026-02-01T01:01:00+01:00', 'nightly/flaky', 'retry', 'rook'),
    line('2026-02-01T01:02:00+01:00', 'nightly/flaky', 'retry', 'rook'),
    line('2026-02-01T01:03:00+01:00', 'nightly/flaky', 'ok', 'rook'),
    line('2026-02-01T02:00:00+01:00', 'nightly/broken', 'fail', null, 'quota exceeded'),
    line('2026-02-01T03:00:00+01:00', 'nightly/fine', 'ok', 'lane-07'),
    '',
  ].join('\n'),
);

// Empty night: file exists, no lines.
writeFileSync(join(dir, '2026-02-02.jsonl'), '');

// Bad-line night: one truncated JSON line among valid ones.
writeFileSync(
  join(dir, '2026-02-03.jsonl'),
  [
    line('2026-02-03T01:00:00+01:00', 'b/second', 'ok', 'rook'),
    '{"at":"2026-02-03T01:30:00+01:00","job":"b/brok',
    line('2026-02-03T02:00:00+01:00', 'a/first', 'ok', 'rook'),
    '',
  ].join('\n'),
);

const config = { adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir: dir };
const app = createApp(config);

type ApiNight = {
  night: string;
  rows: { job: string }[];
  counts: { ok: number; retry: number; fail: number };
  badLines: number;
};

beforeAll(() => {
  process.env.LANE_MARKER = 'TEST-MARKER';
});

// The <tr> elements of the page that mention one of the given jobs, in document order.
function jobRows(html: string, jobs: string[]): { job: string; tr: string }[] {
  const trs = html.match(/<tr[\s\S]*?<\/tr>/g) ?? [];
  const found: { job: string; tr: string }[] = [];
  for (const tr of trs) {
    const job = jobs.find((j) => tr.includes(j));
    if (job) found.push({ job, tr });
  }
  return found;
}

describe('GET /digest/:night', () => {
  it('renders the normal night as html with the lane banner', async () => {
    const res = await app.request('/digest/2026-02-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('TEST-MARKER');
  });

  it('has one row per job', async () => {
    const html = await (await app.request('/digest/2026-02-01')).text();
    const jobs = ['nightly/broken', 'nightly/fine', 'nightly/flaky'];
    expect(jobRows(html, jobs).map((r) => r.job)).toEqual(jobs);
  });

  it('marks rows with 3+ retries or a failed last status as warn', async () => {
    const html = await (await app.request('/digest/2026-02-01')).text();
    const rows = jobRows(html, ['nightly/broken', 'nightly/fine', 'nightly/flaky']);
    const warn = (job: string) => /class="[^"]*\bwarn\b/.test(rows.find((r) => r.job === job)!.tr);
    expect(warn('nightly/flaky')).toBe(true); // 3 retries, last status ok
    expect(warn('nightly/broken')).toBe(true); // last status fail
    expect(warn('nightly/fine')).toBe(false);
  });

  it('renders a null owner as a dash', async () => {
    const html = await (await app.request('/digest/2026-02-01')).text();
    const broken = jobRows(html, ['nightly/broken'])[0]!;
    expect(broken.tr).toContain('—');
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-02-09');
    expect(res.status).toBe(404);
  });

  it('says nothing ran on an empty night', async () => {
    const res = await app.request('/digest/2026-02-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still lists the valid jobs on a night with a bad line', async () => {
    const res = await app.request('/digest/2026-02-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('a/first');
    expect(html).toContain('b/second');
  });

  it('answers 404 for a malformed night', async () => {
    const res = await app.request('/digest/..%2Fx');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/digest/:night', () => {
  it('returns night, rows, counts and badLines as JSON', async () => {
    const res = await app.request('/api/digest/2026-02-01');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = (await res.json()) as ApiNight;
    expect(body.night).toBe('2026-02-01');
    expect(body.rows.map((r) => r.job)).toEqual(['nightly/broken', 'nightly/fine', 'nightly/flaky']);
    expect(body.counts).toEqual({ ok: 2, retry: 3, fail: 1 });
    expect(body.badLines).toBe(0);
  });

  it('answers 404 as JSON for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-02-09');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    await expect(res.json()).resolves.toBeDefined();
  });

  it('returns no rows for an empty night', async () => {
    const res = await app.request('/api/digest/2026-02-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiNight;
    expect(body.rows).toEqual([]);
  });

  it('counts the bad line and keeps the valid rows', async () => {
    const body = (await (await app.request('/api/digest/2026-02-03')).json()) as ApiNight;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['a/first', 'b/second']);
  });

  it('answers 404 for a malformed night', async () => {
    const res = await app.request('/api/digest/..%2Fx');
    expect(res.status).toBe(404);
  });
});

describe('page and JSON agree', () => {
  it.each(['2026-02-01', '2026-02-03'])('lists the same jobs in the same order for %s', async (night) => {
    const body = (await (await app.request(`/api/digest/${night}`)).json()) as ApiNight;
    const jobs = body.rows.map((r) => r.job);
    const html = await (await app.request(`/digest/${night}`)).text();
    expect(jobRows(html, jobs).map((r) => r.job)).toEqual(jobs);
  });
});
