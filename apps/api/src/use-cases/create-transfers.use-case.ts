import type { StarkBankGateway } from '../adapters/gateways/stark-bank.gateway.js';
import type { TransferCreationResult } from '../adapters/gateways/transfer-creation-result.js';
import type { ConsolidatedPaymentBatch } from '../domain/entities/consolidated-payment-batch.js';
import type { ConsolidatedPaymentLine } from '../domain/entities/consolidated-payment-line.js';

function toSkippedResult(line: ConsolidatedPaymentLine): TransferCreationResult {
  return {
    sourceLineIds: [...line.sourceLineIds],
    amount: line.amount,
    paymentStatus: line.paymentStatus ?? 'NÃO PAGO',
    motivo: line.motivo,
  };
}

function isEligibleForTransfer(line: ConsolidatedPaymentLine): boolean {
  return line.isValid && !line.paymentStatus;
}

export class CreateTransfersUseCase {
  constructor(private readonly gateway: StarkBankGateway) {}

  async execute(
    batchId: string,
    batch: ConsolidatedPaymentBatch,
  ): Promise<TransferCreationResult[]> {
    const eligible: { index: number; line: ConsolidatedPaymentLine }[] = [];

    batch.lines.forEach((line, index) => {
      if (isEligibleForTransfer(line)) {
        eligible.push({ index, line });
      }
    });

    const created =
      eligible.length > 0
        ? await this.gateway.createTransfers(
            batchId,
            eligible.map((entry) => entry.line),
          )
        : [];

    const results: TransferCreationResult[] = batch.lines.map((line) => toSkippedResult(line));

    eligible.forEach((entry, createdIndex) => {
      const creationResult = created[createdIndex];

      if (creationResult) {
        results[entry.index] = creationResult;
      }
    });

    return results;
  }
}
