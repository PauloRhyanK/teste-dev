import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';

import { registerBatchRoutes } from '../adapters/http/batch.route.js';
import { registerHealthRoute } from '../adapters/http/health.route.js';
import { createBatchDeps, type BatchDeps } from './batch-deps.js';

export async function buildServer(batchDeps: BatchDeps = createBatchDeps()) {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024,
    },
  });

  await registerHealthRoute(app);
  await registerBatchRoutes(app, {
    jobStore: batchDeps.jobStore,
    processPaymentBatchUseCase: batchDeps.processPaymentBatchUseCase,
  });

  return app;
}
