import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/reader.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage, NoDigest } from './views/digest.js';
import { Layout } from './views/layout.js';
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

  // Page and JSON read the same rows from the same call, so they never disagree (ADR 0001).
  app.get('/digest/:night', (c) => {
    const id = c.req.param('night');
    const night = readNight(config.runsDir, id);
    if (!night) {
      return c.html(
        <Layout title={`digest · ${id}`} lane={lane()}>
          <NoDigest night={id} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest · ${id}`} lane={lane()}>
        <DigestPage night={night} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const id = c.req.param('night');
    const night = readNight(config.runsDir, id);
    if (!night) return c.json({ error: `no run log for ${id}` }, 404);
    return c.json(night);
  });

  return app;
}
