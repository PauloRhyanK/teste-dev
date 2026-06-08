import type { FastifyInstance } from 'fastify';

export interface HealthResponse {
  status: 'ok';
}

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Reply: HealthResponse }>('/health', async () => {
    return { status: 'ok' };
  });
}
