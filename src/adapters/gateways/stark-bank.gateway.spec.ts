import starkbank from 'starkbank';

import type { StarkBankConfig } from '../../infra/config/starkbank.config.js';
import { StarkBankGateway } from './stark-bank.gateway.js';

jest.mock('starkbank', () => {
  const Project = jest.fn().mockImplementation((params: unknown) => params);

  return {
    __esModule: true,
    default: {
      Project,
      user: null,
      balance: {
        get: jest.fn(),
      },
    },
  };
});

const mockedStarkbank = starkbank as jest.Mocked<typeof starkbank>;
const mockedProject = starkbank.Project as jest.MockedClass<typeof starkbank.Project>;
const mockedBalanceGet = starkbank.balance.get as jest.Mock;

const testConfig: StarkBankConfig = {
  environment: 'sandbox',
  projectId: '5656565656565656',
  privateKey: '-----BEGIN EC PRIVATE KEY-----\ntest-key\n-----END EC PRIVATE KEY-----',
};

describe('StarkBankGateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStarkbank.user = null;
  });

  it('initializes starkbank Project with sandbox credentials', () => {
    new StarkBankGateway(testConfig);

    expect(mockedProject).toHaveBeenCalledWith({
      environment: 'sandbox',
      id: '5656565656565656',
      privateKey: testConfig.privateKey,
    });
    expect(mockedStarkbank.user).toEqual({
      environment: 'sandbox',
      id: '5656565656565656',
      privateKey: testConfig.privateKey,
    });
  });

  it('returns balance from starkbank SDK', async () => {
    mockedBalanceGet.mockResolvedValue({
      amount: 150000,
      currency: 'BRL',
    });

    const gateway = new StarkBankGateway(testConfig);
    const balance = await gateway.checkBalance();

    expect(mockedBalanceGet).toHaveBeenCalled();
    expect(balance).toEqual({
      amount: 150000,
      currency: 'BRL',
    });
  });

  it('propagates API errors from balance.get', async () => {
    mockedBalanceGet.mockRejectedValue(new Error('Authentication failed'));

    const gateway = new StarkBankGateway(testConfig);

    await expect(gateway.checkBalance()).rejects.toThrow('Authentication failed');
  });
});
