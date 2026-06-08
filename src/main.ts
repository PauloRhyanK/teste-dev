import { loadEnv } from './infra/config/env.js';
import { buildServer } from './infra/server.js';

async function bootstrap(): Promise<void> {
  const { port } = loadEnv();
  const app = await buildServer();

  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void bootstrap();
