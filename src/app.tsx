import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readNight } from './digest/read.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestPage } from './views/digest.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const digest = readNight(config.runsDir, c.req.param('night'));
    if (!digest) {
      return c.html(
        <Layout title="not found" lane={lane()}>
          <h1>no run log for {c.req.param('night')}</h1>
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${digest.night}`} lane={lane()}>
        <DigestPage digest={digest} />
      </Layout>,
    );
  });

  // Same reader as the page, so the JSON and the page never disagree (ADR 0001).
  app.get('/api/digest/:night', (c) => {
    const digest = readNight(config.runsDir, c.req.param('night'));
    if (!digest) return c.json({ error: 'no run log for this night' }, 404);
    return c.json(digest);
  });

  return app;
}
