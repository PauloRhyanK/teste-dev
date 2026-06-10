import type { TransferCreationResult, TransferVerificationResult } from '@quansa/shared-types';

import type { StarkBankGateway } from '../adapters/gateways/stark-bank.gateway.js';
import {
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MOTIVO,
  POLL_TIMEOUT_MS,
} from '../domain/constants/polling.config.js';
import { mapSystemCommunicationError } from '../domain/services/payment-error.mapper.js';
import {
  isFinalTransferStatus,
  mapTransferStatusToPaymentStatus,
} from '../domain/services/transfer-status.mapper.js';

interface PollTransferStatusOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function toVerificationResult(
  transfer: TransferCreationResult,
  overrides: Partial<TransferVerificationResult> = {},
): TransferVerificationResult {
  return {
    sourceLineIds: [...transfer.sourceLineIds],
    transferId: transfer.transferId,
    externalId: transfer.externalId,
    amount: transfer.amount,
    paymentStatus: transfer.paymentStatus,
    motivo: transfer.motivo,
    starkStatus: transfer.transferStatus,
    ...overrides,
  };
}

function shouldPollTransfer(transfer: TransferCreationResult): boolean {
  return transfer.paymentStatus === 'PROCESSANDO' && Boolean(transfer.transferId);
}

export class PollTransferStatusUseCase {
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(
    private readonly gateway: StarkBankGateway,
    options: PollTransferStatusOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
    this.timeoutMs = options.timeoutMs ?? POLL_TIMEOUT_MS;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
  }

  async execute(transfers: TransferCreationResult[]): Promise<TransferVerificationResult[]> {
    const resolved = await Promise.all(
      transfers.map(async (transfer, index) => ({
        index,
        result: shouldPollTransfer(transfer)
          ? await this.pollSingleTransfer(transfer)
          : toVerificationResult(transfer),
      })),
    );

    const results = new Map(resolved.map(({ index, result }) => [index, result]));
    return transfers.map((_, index) => results.get(index)!);
  }

  private async pollSingleTransfer(
    transfer: TransferCreationResult,
  ): Promise<TransferVerificationResult> {
    const transferId = transfer.transferId!;
    const startedAt = this.now();
    let hadCommunicationError = false;

    while (true) {
      const elapsed = this.now() - startedAt;

      if (elapsed >= this.timeoutMs) {
        return toVerificationResult(transfer, {
          paymentStatus: 'PENDENTE - VERIFICAÇÃO MANUAL',
          motivo: hadCommunicationError ? mapSystemCommunicationError() : POLL_TIMEOUT_MOTIVO,
        });
      }

      try {
        const snapshot = await this.gateway.getTransfer(transferId);

        if (isFinalTransferStatus(snapshot.status)) {
          const paymentStatus = mapTransferStatusToPaymentStatus(snapshot.status);

          if (paymentStatus === 'PAGO') {
            return toVerificationResult(transfer, {
              paymentStatus: 'PAGO',
              starkStatus: snapshot.status,
              motivo: undefined,
            });
          }

          const motivo = await this.gateway.getTransferFailureReason(transferId);

          return toVerificationResult(transfer, {
            paymentStatus: 'NÃO PAGO',
            starkStatus: snapshot.status,
            motivo,
          });
        }
      } catch {
        hadCommunicationError = true;
      }

      await this.sleep(this.pollIntervalMs);
    }
  }
}
