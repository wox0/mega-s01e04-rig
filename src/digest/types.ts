// Plan morning-digest § 1. The contract every part of § 2 builds against: the reader fills it,
// the page, the JSON and the board only read it.

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One parsed line of `runs/<night>.jsonl`. */
export type RunLine = {
  at: string; // ISO 8601 with the log's own offset; never converted to UTC
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/** One row per job for a night. */
export type DigestRow = {
  job: string;
  owner: string | null; // owner on the job's last line; null renders as `—`
  runs: number; // lines for this job, any status
  retries: number; // lines with status `retry`
  lastStatus: RunStatus; // status on the job's last line
  lastError: string | null; // most recent non-empty `error` for this job, or null
  firstAt: string; // `at` of the job's first line, as written in the log
  lastAt: string; // `at` of the job's last line, as written in the log
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job (code-point order); page and JSON use this order as is
  counts: Record<RunStatus, number>; // parsed lines per status, for the board
  badLines: number; // non-blank lines that didn't parse or didn't match RunLine
};

/**
 * Reads `<runsDir>/<night>.jsonl`.
 * - `night` must be YYYY-MM-DD; anything else returns null (no path tricks).
 * - No file: null (the routes answer 404).
 * - Empty file: rows [] (the page says "nothing ran").
 * - Blank lines are skipped; any other line that doesn't parse is counted in `badLines`, never thrown.
 * Implemented in `src/digest/reader.ts` as `export const readNight: ReadNight`.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
