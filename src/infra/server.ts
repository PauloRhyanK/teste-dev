import Fastify from 'fastify';

import { registerHealthRoute } from '../adapters/http/health.route.js';

export async function buildServer() {
  const app = Fastify({
    logger: true,
  });

  await registerHealthRoute(app);

  return app;
}
