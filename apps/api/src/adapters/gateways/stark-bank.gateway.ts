import starkbank from 'starkbank';

import type { ConsolidatedPaymentLine } from '../../domain/entities/consolidated-payment-line.js';
import {
  TRANSFER_QUERY_BATCH_SIZE,
  TRANSFER_REJECTION_FALLBACK_MOTIVO,
} from '../../domain/constants/polling.config.js';
import {
  mapStarkBankLogErrors,
  mapSystemCommunicationError,
} from '../../domain/services/payment-error.mapper.js';
import {
  loadStarkBankConfig,
  type StarkBankConfig,
} from '../../infra/config/starkbank.config.js';
import type { TransferCreationResult } from './transfer-creation-result.js';
import { resolveTransferCreationMotivo } from './transfer-creation-error.resolver.js';
import {
  buildTransferExternalId,
  toStarkBankTransferParams,
} from './transfer-params.mapper.js';

export interface StarkBankBalance {
  amount: number;
  currency: string;
}

export interface StarkBankTransferSnapshot {
  id: string;
  status: string;
  externalId?: string | null;
}

function toTransferSnapshot(transfer: starkbank.Transfer): StarkBankTransferSnapshot {
  return {
    id: transfer.id,
    status: transfer.status,
    externalId: transfer.externalId,
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export class StarkBankGateway {
  private readonly config: StarkBankConfig;

  constructor(config?: StarkBankConfig) {
    this.config = config ?? loadStarkBankConfig();
    this.initializeSdk();
  }

  private initializeSdk(): void {
    const project = new starkbank.Project({
      environment: this.config.environment,
      id: this.config.projectId,
      privateKey: this.config.privateKey,
    });

    starkbank.user = project;
  }

  async checkBalance(): Promise<StarkBankBalance> {
    const balance = await starkbank.balance.get();

    return {
      amount: balance.amount,
      currency: balance.currency,
    };
  }

  async getTransfer(transferId: string): Promise<StarkBankTransferSnapshot> {
    const transfer = await starkbank.transfer.get(transferId);
    return toTransferSnapshot(transfer);
  }

  async getTransfersByIds(transferIds: string[]): Promise<StarkBankTransferSnapshot[]> {
    if (transferIds.length === 0) {
      return [];
    }

    const chunks = chunkArray(transferIds, TRANSFER_QUERY_BATCH_SIZE);
    const snapshots: StarkBankTransferSnapshot[] = [];

    for (const ids of chunks) {
      const transfers = await starkbank.transfer.query({ ids });
      snapshots.push(...transfers.map(toTransferSnapshot));
    }

    return snapshots;
  }

  async createTransfers(
    batchId: string,
    lines: ConsolidatedPaymentLine[],
  ): Promise<TransferCreationResult[]> {
    if (lines.length === 0) {
      return [];
    }

    const transferInputs = lines.map((line) => {
      const externalId = buildTransferExternalId(batchId, line);
      const params = toStarkBankTransferParams(line, externalId);
      return {
        line,
        externalId,
        transfer: new starkbank.Transfer(params),
      };
    });

    try {
      const created = await starkbank.transfer.create(
        transferInputs.map((input) => input.transfer),
      );

      return transferInputs.map((input, index) => {
        const result = created[index];

        if (!result) {
          return {
            sourceLineIds: [...input.line.sourceLineIds],
            externalId: input.externalId,
            amount: input.line.amount,
            paymentStatus: 'NÃO PAGO' as const,
            motivo: mapSystemCommunicationError(),
          };
        }

        return {
          sourceLineIds: [...input.line.sourceLineIds],
          transferId: result.id,
          transferStatus: result.status,
          externalId: result.externalId ?? input.externalId,
          amount: input.line.amount,
          paymentStatus: 'PROCESSANDO' as const,
        };
      });
    } catch (error) {
      const motivo = resolveTransferCreationMotivo(error);

      return transferInputs.map((input) => ({
        sourceLineIds: [...input.line.sourceLineIds],
        externalId: input.externalId,
        amount: input.line.amount,
        paymentStatus: 'NÃO PAGO' as const,
        motivo,
      }));
    }
  }

  async getTransferFailureReason(transferId: string): Promise<string> {
    try {
      const logs = await starkbank.transfer.log.query({
        transferIds: [transferId],
        types: ['failed'],
      });

      const latestFailedLog = logs
        .filter((log) => log.errors.length > 0)
        .sort((left, right) => right.created.localeCompare(left.created))[0];

      if (!latestFailedLog) {
        return mapStarkBankLogErrors([TRANSFER_REJECTION_FALLBACK_MOTIVO]);
      }

      return mapStarkBankLogErrors(latestFailedLog.errors);
    } catch {
      return mapSystemCommunicationError();
    }
  }
}
