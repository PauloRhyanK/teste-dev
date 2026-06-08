import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadStarkBankConfig } from './starkbank.config.js';

const ORIGINAL_ENV = process.env;

describe('loadStarkBankConfig', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('throws when STARKBANK_PROJECT_ID is missing', () => {
    process.env.STARKBANK_ENVIRONMENT = 'sandbox';
    process.env.STARKBANK_PRIVATE_KEY_PATH = 'keys/privateKey.pem';
    delete process.env.STARKBANK_PROJECT_ID;

    expect(() => loadStarkBankConfig()).toThrow(
      'Missing required environment variable: STARKBANK_PROJECT_ID',
    );
  });

  it('loads config from environment and private key file', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'starkbank-config-'));
    const privateKeyPath = join(tempDir, 'privateKey.pem');
    const privateKey = '-----BEGIN EC PRIVATE KEY-----\ntest-key\n-----END EC PRIVATE KEY-----';

    await writeFile(privateKeyPath, privateKey);

    process.env.STARKBANK_ENVIRONMENT = 'sandbox';
    process.env.STARKBANK_PROJECT_ID = '5656565656565656';
    process.env.STARKBANK_PRIVATE_KEY_PATH = privateKeyPath;

    const config = loadStarkBankConfig();

    expect(config).toEqual({
      environment: 'sandbox',
      projectId: '5656565656565656',
      privateKey,
    });
  });
});
