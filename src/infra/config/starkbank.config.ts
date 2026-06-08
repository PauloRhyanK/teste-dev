import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export interface StarkBankConfig {
  environment: 'sandbox';
  projectId: string;
  privateKey: string;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function resolvePrivateKeyPath(privateKeyPath: string): string {
  return isAbsolute(privateKeyPath) ? privateKeyPath : resolve(process.cwd(), privateKeyPath);
}

export function loadStarkBankConfig(): StarkBankConfig {
  const environment = requireEnv('STARKBANK_ENVIRONMENT');

  if (environment !== 'sandbox') {
    throw new Error(
      `Invalid STARKBANK_ENVIRONMENT value: ${environment}. Only "sandbox" is supported.`,
    );
  }

  const projectId = requireEnv('STARKBANK_PROJECT_ID');
  const privateKeyPath = resolvePrivateKeyPath(requireEnv('STARKBANK_PRIVATE_KEY_PATH'));

  let privateKey: string;

  try {
    privateKey = readFileSync(privateKeyPath, 'utf8');
  } catch {
    throw new Error(`Unable to read private key file at: ${privateKeyPath}`);
  }

  if (!privateKey.trim()) {
    throw new Error(`Private key file is empty: ${privateKeyPath}`);
  }

  return {
    environment: 'sandbox',
    projectId,
    privateKey,
  };
}
