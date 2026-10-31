import type { DigestRow, NightDigest } from '../digest/types.js';

// A row is marked when a job retried 3 or more times, or failed at least once.
export function isMarked(row: DigestRow): boolean {
  return row.retries >= 3 || row.fails > 0;
}

function flag(row: DigestRow): string {
  const flags: string[] = [];
  if (row.fails > 0) flags.push('fail');
  if (row.retries >= 3) flags.push('retries ≥ 3');
  return flags.join(', ');
}

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last</th>
              <th>last error</th>
              <th>first</th>
              <th>last at</th>
              <th>flag</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => (
              <tr class={isMarked(row) ? 'warn' : undefined}>
                <td>{row.job}</td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError ?? ''}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
                <td>{flag(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {digest.badLines > 0 && <p class="mute">{digest.badLines} bad line(s) skipped</p>}
    </>
  );
}
