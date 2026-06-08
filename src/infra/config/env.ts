import 'dotenv/config';

export interface EnvConfig {
  port: number;
}

export function loadEnv(): EnvConfig {
  const port = Number(process.env.PORT ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT ?? 'undefined'}`);
  }

  return { port };
}
