import { buildServer } from '../../infra/server.js';
import type { BatchDeps } from '../../infra/batch-deps.js';
import { BatchJobStore } from '../../infra/batch-job.store.js';
import type { ProcessPaymentBatchUseCase } from '../../use-cases/process-payment-batch.use-case.js';

function createTestDeps(): BatchDeps {
  const jobStore = new BatchJobStore();

  const processPaymentBatchUseCase = {
    execute: jest.fn().mockResolvedValue(Buffer.from('xlsx')),
  } as unknown as ProcessPaymentBatchUseCase;

  return { jobStore, processPaymentBatchUseCase };
}

describe('batch routes', () => {
  it('rejects upload without file', async () => {
    const deps = createTestDeps();
    const app = await buildServer(deps);
    const boundary = '----emptyboundary';
    const payload = `--${boundary}--\r\n`;

    const response = await app.inject({
      method: 'POST',
      url: '/batches',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'INVALID_FILE_TYPE' });

    await app.close();
  });

  it('accepts xlsx upload and returns batch id', async () => {
    const deps = createTestDeps();
    const app = await buildServer(deps);

    const boundary = '----formboundary';
    const payload =
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="file"; filename="lote.xlsx"\r\n' +
      'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n' +
      'fake-xlsx-content\r\n' +
      `--${boundary}--\r\n`;

    const response = await app.inject({
      method: 'POST',
      url: '/batches',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      fileName: 'lote.xlsx',
      status: 'queued',
    });
    expect(response.json().batchId).toBeDefined();

    await app.close();
  });

  it('returns 404 for unknown batch snapshot', async () => {
    const deps = createTestDeps();
    const app = await buildServer(deps);

    const response = await app.inject({
      method: 'GET',
      url: '/batches/unknown-id',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'BATCH_NOT_FOUND' });

    await app.close();
  });

  it('returns SSE content type for events endpoint', async () => {
    const deps = createTestDeps();
    const batchId = deps.jobStore.create('lote.xlsx', Buffer.from('source'));
    deps.jobStore.setStatus(batchId, 'completed');
    deps.jobStore.setResultBuffer(batchId, Buffer.from('xlsx'));
    const app = await buildServer(deps);

    const response = await app.inject({
      method: 'GET',
      url: `/batches/${batchId}/events`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');

    await app.close();
  });
});
