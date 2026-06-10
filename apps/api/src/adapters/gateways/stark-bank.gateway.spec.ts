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
      transfer: {
        get: jest.fn(),
        query: jest.fn(),
        create: jest.fn(),
        log: {
          query: jest.fn(),
        },
      },
      Transfer: jest.fn().mockImplementation((params: unknown) => params),
    },
  };
});

const mockedStarkbank = starkbank as jest.Mocked<typeof starkbank>;
const mockedProject = starkbank.Project as jest.MockedClass<typeof starkbank.Project>;
const mockedBalanceGet = starkbank.balance.get as jest.Mock;
const mockedTransferGet = starkbank.transfer.get as jest.Mock;
const mockedTransferQuery = starkbank.transfer.query as jest.Mock;
const mockedTransferCreate = starkbank.transfer.create as jest.Mock;
const mockedTransferLogQuery = starkbank.transfer.log.query as jest.Mock;

const testConfig: StarkBankConfig = {
  environment: 'sandbox',
  projectId: '5656565656565656',
  privateKey: '-----BEGIN EC PRIVATE KEY-----\ntest-key\n-----END EC PRIVATE KEY-----',
};

const testBatchId = 'batch-abc';

function mockTransferLogQuery(
  entries: Array<{ errors: string[]; created: string }>,
): jest.Mock {
  return jest.fn(async () => {
    async function* generator() {
      for (const entry of entries) {
        yield entry;
      }
    }

    return generator();
  });
}

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

  it('gets a single transfer by id', async () => {
    mockedTransferGet.mockResolvedValue({
      id: 'transfer-1',
      status: 'processing',
      externalId: 'external-1',
    });

    const gateway = new StarkBankGateway(testConfig);
    const transfer = await gateway.getTransfer('transfer-1');

    expect(mockedTransferGet).toHaveBeenCalledWith('transfer-1');
    expect(transfer).toEqual({
      id: 'transfer-1',
      status: 'processing',
      externalId: 'external-1',
    });
  });

  it('gets transfers in batch by ids', async () => {
    mockedTransferGet
      .mockResolvedValueOnce({
        id: 'transfer-1',
        status: 'success',
        externalId: 'external-1',
      })
      .mockResolvedValueOnce({
        id: 'transfer-2',
        status: 'processing',
        externalId: 'external-2',
      });

    const gateway = new StarkBankGateway(testConfig);
    const transfers = await gateway.getTransfersByIds(['transfer-1', 'transfer-2']);

    expect(mockedTransferGet).toHaveBeenNthCalledWith(1, 'transfer-1');
    expect(mockedTransferGet).toHaveBeenNthCalledWith(2, 'transfer-2');
    expect(transfers).toHaveLength(2);
  });

  it('skips missing transfers when getting by ids', async () => {
    mockedTransferGet
      .mockResolvedValueOnce({
        id: 'transfer-1',
        status: 'success',
        externalId: 'external-1',
      })
      .mockRejectedValueOnce(new Error('not found'));

    const gateway = new StarkBankGateway(testConfig);
    const transfers = await gateway.getTransfersByIds(['transfer-1', 'transfer-missing']);

    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.id).toBe('transfer-1');
  });

  it('returns failure reason from transfer logs', async () => {
    mockedTransferLogQuery.mockImplementation(
      mockTransferLogQuery([
        {
          errors: ['Conta inválida'],
          created: '2024-01-15 10:00:00.000',
        },
        {
          errors: ['Saldo insuficiente'],
          created: '2024-01-15 09:00:00.000',
        },
      ]),
    );

    const gateway = new StarkBankGateway(testConfig);
    const reason = await gateway.getTransferFailureReason('transfer-1');

    expect(mockedTransferLogQuery).toHaveBeenCalledWith({
      transferIds: ['transfer-1'],
    });
    expect(reason).toBe('Erro StarkBank: Conta de destino inválida');
  });

  it('returns fallback motivo when transfer log query fails', async () => {
    mockedTransferLogQuery.mockImplementation(async () => {
      throw new Error('Network failure');
    });

    const gateway = new StarkBankGateway(testConfig);
    const reason = await gateway.getTransferFailureReason('transfer-1');

    expect(reason).toBe('Erro StarkBank: Transferência rejeitada pelo banco destino');
  });

  it('creates transfers and returns PAGO when status is already success', async () => {
    mockedTransferCreate.mockResolvedValue([
      { id: 'transfer-1', status: 'success', externalId: 'batch-abc-1' },
    ]);

    const gateway = new StarkBankGateway(testConfig);
    const results = await gateway.createTransfers(
      [
      {
        sourceLineIds: ['1'],
        orderDate: '2024-01-15',
        beneficiary: 'Maria Souza',
        taxId: '12345678901',
        bank: '20018183',
        branch: '0001',
        account: '12345-6',
        accountType: 'Corrente',
        amount: 1250,
        domainErrors: [],
        isValid: true,
      },
    ],
      testBatchId,
    );

    expect(results).toEqual([
      {
        sourceLineIds: ['1'],
        transferId: 'transfer-1',
        transferStatus: 'success',
        externalId: 'batch-abc-1',
        amount: 1250,
        paymentStatus: 'PAGO',
      },
    ]);
  });

  it('creates transfers and returns processing results', async () => {
    mockedTransferCreate.mockResolvedValue([
      { id: 'transfer-1', status: 'processing', externalId: 'batch-abc-1' },
    ]);

    const gateway = new StarkBankGateway(testConfig);
    const results = await gateway.createTransfers(
      [
      {
        sourceLineIds: ['1'],
        orderDate: '2024-01-15',
        beneficiary: 'Maria Souza',
        taxId: '12345678901',
        bank: '20018183',
        branch: '0001',
        account: '12345-6',
        accountType: 'Corrente',
        amount: 1250,
        domainErrors: [],
        isValid: true,
      },
    ],
      testBatchId,
    );

    expect(mockedTransferCreate).toHaveBeenCalled();
    expect(results).toEqual([
      {
        sourceLineIds: ['1'],
        transferId: 'transfer-1',
        transferStatus: 'processing',
        externalId: 'batch-abc-1',
        amount: 1250,
        paymentStatus: 'PROCESSANDO',
      },
    ]);
  });

  it('isolates a failing transfer without affecting valid ones', async () => {
    mockedTransferCreate
      .mockRejectedValueOnce({
        errors: [{ code: 'invalidAccountNumber', message: 'Conta inválida' }],
      })
      .mockResolvedValueOnce([{ id: 'transfer-2', status: 'processing', externalId: 'pix-2' }]);

    const gateway = new StarkBankGateway(testConfig);
    const results = await gateway.createTransfers(
      [
      {
        sourceLineIds: ['1'],
        orderDate: '2024-01-15',
        beneficiary: 'Conta ruim',
        taxId: '12345678901',
        bank: '20018183',
        branch: '0001',
        account: '0-0',
        accountType: 'Corrente',
        amount: 500,
        domainErrors: [],
        isValid: true,
      },
      {
        sourceLineIds: ['2'],
        orderDate: '2024-01-15',
        beneficiary: 'Conta boa',
        taxId: '98765432100',
        bank: '20018183',
        branch: '0001',
        account: '2-2',
        accountType: 'Corrente',
        amount: 700,
        domainErrors: [],
        isValid: true,
      },
    ],
      testBatchId,
    );

    expect(results[0]?.paymentStatus).toBe('NÃO PAGO');
    expect(results[1]?.paymentStatus).toBe('PROCESSANDO');
  });

  it('maps transfer creation errors to NÃO PAGO results', async () => {
    mockedTransferCreate.mockRejectedValue({
      errors: [{ code: 'insufficientBalance', message: 'Saldo insuficiente' }],
    });

    const gateway = new StarkBankGateway(testConfig);
    const results = await gateway.createTransfers(
      [
      {
        sourceLineIds: ['2'],
        orderDate: '2024-01-15',
        beneficiary: 'João Silva',
        taxId: '98765432100',
        bank: '20018183',
        branch: '0001',
        account: '98765-4',
        accountType: 'Corrente',
        amount: 500,
        domainErrors: [],
        isValid: true,
      },
    ],
      testBatchId,
    );

    expect(results[0]?.paymentStatus).toBe('NÃO PAGO');
    expect(results[0]?.motivo).toContain('Saldo insuficiente');
  });

  it('returns mapped fallback when transfer logs have no errors', async () => {
    mockedTransferLogQuery.mockImplementation(
      mockTransferLogQuery([
        {
          errors: [],
          created: '2024-01-15 10:00:00.000',
        },
      ]),
    );

    const gateway = new StarkBankGateway(testConfig);
    const reason = await gateway.getTransferFailureReason('transfer-1');

    expect(reason).toBe('Erro StarkBank: Transferência rejeitada pelo banco destino');
  });
});
