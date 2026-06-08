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

interface PendingTransferState {
  transfer: TransferCreationResult;
  startedAt: number;
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
    const results = new Map<number, TransferVerificationResult>();
    const pending = new Map<number, PendingTransferState>();

    transfers.forEach((transfer, index) => {
      if (shouldPollTransfer(transfer)) {
        pending.set(index, {
          transfer,
          startedAt: this.now(),
        });
        return;
      }

      results.set(index, toVerificationResult(transfer));
    });

    while (pending.size > 0) {
      const pendingEntries = [...pending.entries()];
      const pendingIds = pendingEntries
        .map(([, state]) => state.transfer.transferId)
        .filter((transferId): transferId is string => Boolean(transferId));

      let snapshots;

      try {
        snapshots = await this.gateway.getTransfersByIds(pendingIds);
      } catch {
        for (const [index, state] of pendingEntries) {
          pending.delete(index);
          results.set(index, toVerificationResult(state.transfer, {
            paymentStatus: 'PENDENTE - VERIFICAÇÃO MANUAL',
            motivo: mapSystemCommunicationError(),
          }));
        }

        continue;
      }

      const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));

      for (const [index, state] of pendingEntries) {
        const transferId = state.transfer.transferId;

        if (!transferId) {
          continue;
        }

        const snapshot = snapshotById.get(transferId);
        const currentTime = this.now();

        if (!snapshot) {
          if (currentTime - state.startedAt >= this.timeoutMs) {
            pending.delete(index);
            results.set(index, toVerificationResult(state.transfer, {
              paymentStatus: 'PENDENTE - VERIFICAÇÃO MANUAL',
              motivo: POLL_TIMEOUT_MOTIVO,
            }));
          }
          continue;
        }

        if (isFinalTransferStatus(snapshot.status)) {
          pending.delete(index);
          const paymentStatus = mapTransferStatusToPaymentStatus(snapshot.status);

          if (paymentStatus === 'PAGO') {
            results.set(index, toVerificationResult(state.transfer, {
              paymentStatus: 'PAGO',
              starkStatus: snapshot.status,
              motivo: undefined,
            }));
            continue;
          }

          const motivo = await this.gateway.getTransferFailureReason(transferId);

          results.set(index, toVerificationResult(state.transfer, {
            paymentStatus: 'NÃO PAGO',
            starkStatus: snapshot.status,
            motivo,
          }));
          continue;
        }

        if (currentTime - state.startedAt >= this.timeoutMs) {
          pending.delete(index);
          results.set(index, toVerificationResult(state.transfer, {
            paymentStatus: 'PENDENTE - VERIFICAÇÃO MANUAL',
            motivo: POLL_TIMEOUT_MOTIVO,
            starkStatus: snapshot.status,
          }));
        }
      }

      if (pending.size > 0) {
        await this.sleep(this.pollIntervalMs);
      }
    }

    return transfers.map((_, index) => results.get(index)!);
  }
}
