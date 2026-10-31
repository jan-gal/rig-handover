export type JobStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl.
export type LogLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error?: string;
};

// One row per job in a night.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

// Implemented in read.ts:
//   readNight(runsDir: string, night: string): NightDigest | null
// Reads runs/<night>.jsonl into one row per job, sorted by job.
// Returns null when the night has no file (or the night is not YYYY-MM-DD).
