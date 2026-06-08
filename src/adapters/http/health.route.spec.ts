import { buildServer } from '../../infra/server.js';

describe('GET /health', () => {
  it('returns status ok', async () => {
    const app = await buildServer();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });
});
