import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { readNight } from '../src/digest/read.js';

const runs = join(process.cwd(), 'runs');

describe('readNight', () => {
  it('reads 2026-10-28 into one row per job, with 1 bad line counted', () => {
    const d = readNight(runs, '2026-10-28');
    expect(d).not.toBeNull();
    expect(d!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(d!.badLines).toBe(1);
  });

  it('counts runs and retries per job', () => {
    const d = readNight(runs, '2026-10-28')!;
    const fixtures = d.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fixtures.runs).toBe(4);
    expect(fixtures.retries).toBe(3);
    expect(fixtures.lastStatus).toBe('ok');
    expect(fixtures.lastError).toBeNull();
    expect(fixtures.owner).toBe('rook');
  });

  it('keeps the last error and the failing status', () => {
    const d = readNight(runs, '2026-10-28')!;
    const notes = d.rows.find((r) => r.job === 'notes/backup')!;
    expect(notes.lastStatus).toBe('fail');
    expect(notes.lastError).toBe('quota exceeded');
    expect(notes.owner).toBe('lane-07');
  });

  it('keeps a row with a null owner and shows it as null', () => {
    const d = readNight(runs, '2026-10-28')!;
    const render = d.rows.find((r) => r.job === 'digest/render')!;
    expect(render.owner).toBeNull();
    expect(render.runs).toBe(1);
  });

  it('returns null for a night with no file', () => {
    expect(readNight(runs, '2026-01-01')).toBeNull();
  });

  it('returns null for a malformed night name (no path tricks)', () => {
    expect(readNight(runs, '../runs/2026-10-28')).toBeNull();
  });

  it('renders an empty file as zero rows, not an error', () => {
    const dir = mkdtempSync(join(tmpdir(), 'digest-'));
    writeFileSync(join(dir, '2026-10-30.jsonl'), '');
    expect(readNight(dir, '2026-10-30')).toEqual({ night: '2026-10-30', rows: [], badLines: 0 });
  });

  it('counts a non-JSON line and a line with a bad status as bad, never throws', () => {
    const dir = mkdtempSync(join(tmpdir(), 'digest-'));
    writeFileSync(
      join(dir, '2026-10-31.jsonl'),
      [
        '{"at":"2026-10-31T01:00:00+01:00","job":"a","status":"ok","owner":null}',
        'not json',
        '{"at":"2026-10-31T02:00:00+01:00","job":"a","status":"weird","owner":null}',
        '',
      ].join('\n'),
    );
    const d = readNight(dir, '2026-10-31')!;
    expect(d.badLines).toBe(2);
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0].runs).toBe(1);
  });
});
