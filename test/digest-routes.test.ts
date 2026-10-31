import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';

// Temp runs dir: runs/ in the repo is read-only and holds real nights.
function setup(files: Record<string, string>) {
  const runsDir = mkdtempSync(join(tmpdir(), 'digest-routes-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(runsDir, name), body);
  const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
  return createApp(config);
}

const line = (at: string, job: string, status: string, owner: string | null = 'rook', error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

describe('digest routes', () => {
  it('GET /digest/:night renders 200 with one row per job, sorted by job', async () => {
    const app = setup({
      '2026-10-28.jsonl': [
        line('2026-10-28T01:00:00+01:00', 'lane/sync', 'ok'),
        line('2026-10-28T02:00:00+01:00', 'fixtures/refresh', 'ok'),
      ].join('\n') + '\n',
    });
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.indexOf('fixtures/refresh')).toBeLessThan(html.indexOf('lane/sync'));
  });

  it('GET /digest/:night marks retries of 3 or more and any fail', async () => {
    const app = setup({
      '2026-10-28.jsonl': [
        line('2026-10-28T01:00:00+01:00', 'a', 'retry'),
        line('2026-10-28T01:01:00+01:00', 'a', 'retry'),
        line('2026-10-28T01:02:00+01:00', 'a', 'retry'),
        line('2026-10-28T02:00:00+01:00', 'b', 'fail', 'lane-07', 'quota exceeded'),
        line('2026-10-28T03:00:00+01:00', 'c', 'retry'),
      ].join('\n') + '\n',
    });
    const html = await (await app.request('/digest/2026-10-28')).text();
    expect(html.match(/class="warn"/g)).toHaveLength(2);
  });

  it('GET /digest/:night returns 404 for a night with no file', async () => {
    const app = setup({});
    const res = await app.request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('GET /digest/:night renders "nothing ran" for an empty file', async () => {
    const app = setup({ '2026-10-30.jsonl': '' });
    const res = await app.request('/digest/2026-10-30');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('GET /digest/:night renders a night with a bad line and says how many were skipped', async () => {
    const app = setup({
      '2026-10-31.jsonl': [line('2026-10-31T01:00:00+01:00', 'a', 'ok'), 'not json'].join('\n') + '\n',
    });
    const res = await app.request('/digest/2026-10-31');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('1 bad line(s) skipped');
  });

  it('GET /api/digest/:night returns the same jobs in the same order as the page', async () => {
    const app = setup({
      '2026-10-28.jsonl': [
        line('2026-10-28T01:00:00+01:00', 'lane/sync', 'ok'),
        line('2026-10-28T02:00:00+01:00', 'fixtures/refresh', 'ok'),
        line('2026-10-28T03:00:00+01:00', 'notes/backup', 'fail', 'lane-07'),
        'not json',
      ].join('\n') + '\n',
    });
    const html = await (await app.request('/digest/2026-10-28')).text();
    const json = await (await app.request('/api/digest/2026-10-28')).json();
    const pageJobs = ['fixtures/refresh', 'lane/sync', 'notes/backup'].filter((j) => html.includes(j));
    expect(json.rows.map((r: { job: string }) => r.job)).toEqual(pageJobs);
    expect(json.badLines).toBe(1);
  });

  it('GET /api/digest/:night returns 404 JSON for a night with no file', async () => {
    const app = setup({});
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for this night' });
  });
});
