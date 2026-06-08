import { buildServer } from '../../infra/server.js';
import { BatchJobStore } from '../../infra/batch-job.store.js';
import type { ProcessPaymentBatchUseCase } from '../../use-cases/process-payment-batch.use-case.js';

describe('GET /health', () => {
  it('returns status ok', async () => {
    const app = await buildServer({
      jobStore: new BatchJobStore(),
      processPaymentBatchUseCase: {
        execute: jest.fn(),
      } as unknown as ProcessPaymentBatchUseCase,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });
});
