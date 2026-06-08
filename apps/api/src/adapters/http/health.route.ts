import type { HealthResponse } from '@quansa/shared-types';
import type { FastifyInstance } from 'fastify';

export type { HealthResponse };

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: HealthResponse }>('/health', async () => {
    return { status: 'ok' };
  });
}
