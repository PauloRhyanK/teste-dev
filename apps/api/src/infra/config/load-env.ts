import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { config } from 'dotenv';

function findEnvFile(startDir: string): string | undefined {
  let current = startDir;

  while (true) {
    const candidate = resolve(current, '.env');

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);

    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

const envPath = findEnvFile(process.cwd());

config(envPath ? { path: envPath } : undefined);

export const envRootDir = envPath ? dirname(envPath) : process.cwd();
