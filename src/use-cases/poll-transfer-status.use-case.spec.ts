import type { TransferCreationResult } from '../adapters/gateways/transfer-creation-result.js';
import type { StarkBankGateway } from '../adapters/gateways/stark-bank.gateway.js';
import {
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MOTIVO,
  POLL_TIMEOUT_MS,
} from '../domain/constants/polling.config.js';
import { PollTransferStatusUseCase } from './poll-transfer-status.use-case.js';

function createTransfer(
  overrides: Partial<TransferCreationResult> = {},
): TransferCreationResult {
  return {
    sourceLineIds: ['1'],
    transferId: 'transfer-1',
    externalId: 'external-1',
    transferStatus: 'processing',
    paymentStatus: 'PROCESSANDO',
    amount: 100,
    ...overrides,
  };
}

describe('PollTransferStatusUseCase', () => {
  let currentTime = 0;
  let sleepCalls: number[] = [];

  const sleep = jest.fn(async (ms: number) => {
    sleepCalls.push(ms);
    currentTime += ms;
  });

  const now = jest.fn(() => currentTime);

  const gateway = {
    getTransfersByIds: jest.fn(),
    getTransferFailureReason: jest.fn(),
  } as unknown as jest.Mocked<Pick<StarkBankGateway, 'getTransfersByIds' | 'getTransferFailureReason'>>;

  const useCase = new PollTransferStatusUseCase(gateway as StarkBankGateway, {
    sleep,
    now,
    pollIntervalMs: POLL_INTERVAL_MS,
    timeoutMs: POLL_TIMEOUT_MS,
  });

  beforeEach(() => {
    currentTime = 0;
    sleepCalls = [];
    jest.clearAllMocks();
    gateway.getTransfersByIds.mockReset();
    gateway.getTransferFailureReason.mockReset();
  });

  it('marks transfer as PAGO when status becomes success on second poll', async () => {
    gateway.getTransfersByIds
      .mockResolvedValueOnce([{ id: 'transfer-1', status: 'processing', externalId: 'external-1' }])
      .mockResolvedValueOnce([{ id: 'transfer-1', status: 'success', externalId: 'external-1' }]);

    const input = [createTransfer()];
    const result = await useCase.execute(input);

    expect(result[0]?.paymentStatus).toBe('PAGO');
    expect(result[0]?.starkStatus).toBe('success');
    expect(gateway.getTransfersByIds).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(POLL_INTERVAL_MS);
  });

  it('marks failed transfers as NÃO PAGO with log reason', async () => {
    gateway.getTransfersByIds.mockResolvedValue([
      { id: 'transfer-1', status: 'failed', externalId: 'external-1' },
    ]);
    gateway.getTransferFailureReason.mockResolvedValue('Conta inválida');

    const result = await useCase.execute([createTransfer()]);

    expect(result[0]?.paymentStatus).toBe('NÃO PAGO');
    expect(result[0]?.motivo).toBe('Conta inválida');
    expect(gateway.getTransferFailureReason).toHaveBeenCalledWith('transfer-1');
  });

  it('marks canceled transfers as NÃO PAGO', async () => {
    gateway.getTransfersByIds.mockResolvedValue([
      { id: 'transfer-1', status: 'canceled', externalId: 'external-1' },
    ]);
    gateway.getTransferFailureReason.mockResolvedValue('Operação cancelada');

    const result = await useCase.execute([createTransfer()]);

    expect(result[0]?.paymentStatus).toBe('NÃO PAGO');
    expect(result[0]?.motivo).toBe('Operação cancelada');
  });

  it('marks processing transfers as PENDENTE after timeout', async () => {
    gateway.getTransfersByIds.mockResolvedValue([
      { id: 'transfer-1', status: 'processing', externalId: 'external-1' },
    ]);

    const result = await useCase.execute([createTransfer()]);

    expect(result[0]?.paymentStatus).toBe('PENDENTE - VERIFICAÇÃO MANUAL');
    expect(result[0]?.motivo).toBe(POLL_TIMEOUT_MOTIVO);
    expect(sleepCalls.length).toBeGreaterThan(0);
  });

  it('passes through transfers that are already NÃO PAGO without polling', async () => {
    const input = [
      createTransfer({
        transferId: undefined,
        paymentStatus: 'NÃO PAGO',
        motivo: 'CPF/CNPJ inválido',
      }),
    ];

    const result = await useCase.execute(input);

    expect(result[0]?.paymentStatus).toBe('NÃO PAGO');
    expect(result[0]?.motivo).toBe('CPF/CNPJ inválido');
    expect(gateway.getTransfersByIds).not.toHaveBeenCalled();
  });

  it('queries multiple transfer ids in batch', async () => {
    gateway.getTransfersByIds.mockResolvedValue([
      { id: 'transfer-1', status: 'success', externalId: 'external-1' },
      { id: 'transfer-2', status: 'success', externalId: 'external-2' },
    ]);

    const input = [
      createTransfer({ sourceLineIds: ['1'], transferId: 'transfer-1' }),
      createTransfer({ sourceLineIds: ['2'], transferId: 'transfer-2', externalId: 'external-2' }),
    ];

    const result = await useCase.execute(input);

    expect(gateway.getTransfersByIds).toHaveBeenCalledWith(['transfer-1', 'transfer-2']);
    expect(result[0]?.paymentStatus).toBe('PAGO');
    expect(result[1]?.paymentStatus).toBe('PAGO');
  });

  it('does not mutate the original transfer array or objects', async () => {
    const transfer = createTransfer();
    const input = [transfer];
    const inputRef = input;

    gateway.getTransfersByIds.mockResolvedValue([
      { id: 'transfer-1', status: 'success', externalId: 'external-1' },
    ]);

    await useCase.execute(input);

    expect(input).toBe(inputRef);
    expect(transfer.paymentStatus).toBe('PROCESSANDO');
  });
});
