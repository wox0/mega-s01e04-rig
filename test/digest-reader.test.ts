import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28')!;

  it('has 5 jobs and 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.badLines).toBe(1);
    expect(night.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('folds a job into one row: runs, retries, last status, last error, first and last time', () => {
    const r = night.rows.find((x) => x.job === 'fixtures/refresh')!;
    expect(r).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps a failed job and its error', () => {
    const r = night.rows.find((x) => x.job === 'notes/backup')!;
    expect(r.lastStatus).toBe('fail');
    expect(r.lastError).toBe('quota exceeded');
    expect(r.owner).toBe('lane-07');
  });

  it('keeps a row whose owner is null', () => {
    const r = night.rows.find((x) => x.job === 'digest/render')!;
    expect(r.owner).toBeNull();
    expect(r.lastError).toBeNull();
  });

  it('keeps the log offset on times', () => {
    const r = night.rows.find((x) => x.job === 'lane/sync')!;
    expect(r.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(r.lastAt).toBe('2026-10-29T05:00:04+01:00');
    expect(r.runs).toBe(8);
    expect(r.retries).toBe(1);
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(dir, '2026-01-01.jsonl'), '');
  writeFileSync(
    join(dir, '2026-01-02.jsonl'),
    [
      '{"at":"2026-01-02T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
      '',
      'not json',
      '{"at":"2026-01-02T02:00:00+01:00","job":"b","status":"weird","owner":"x"}',
      '[1,2]',
      '',
    ].join('\n'),
  );

  it('returns null when the night has no file', () => {
    expect(readNight(dir, '2026-01-03')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    expect(readNight(dir, '../runs/2026-10-28')).toBeNull();
    expect(readNight('runs', '2026-10-28.jsonl')).toBeNull();
  });

  it('renders an empty file as no rows', () => {
    expect(readNight(dir, '2026-01-01')).toEqual({
      night: '2026-01-01',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('counts bad lines, skips blank ones, never throws', () => {
    const n = readNight(dir, '2026-01-02')!;
    expect(n.rows.map((r) => r.job)).toEqual(['a']);
    expect(n.badLines).toBe(3);
  });
});
