import { Hono } from 'hono';
import { readNight } from './digest/reader.js';
import { DigestPage, NoDigest } from './views/digest.js';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
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

  return app;
}
