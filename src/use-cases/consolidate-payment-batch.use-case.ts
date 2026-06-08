import type { ConsolidatedPaymentBatch } from '../domain/entities/consolidated-payment-batch.js';
import type { ConsolidatedPaymentLine } from '../domain/entities/consolidated-payment-line.js';
import type { PaymentBatch } from '../domain/entities/payment-batch.js';
import type { PaymentLine } from '../domain/entities/payment-line.js';
import { buildConsolidationKey } from '../domain/services/consolidation-key.js';

function mergeDomainErrors(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming])];
}

function createConsolidatedLine(line: PaymentLine): ConsolidatedPaymentLine {
  return {
    sourceLineIds: [line.id],
    orderDate: line.orderDate,
    beneficiary: line.beneficiary,
    taxId: line.taxId,
    bank: line.bank,
    branch: line.branch,
    account: line.account,
    accountType: line.accountType,
    amount: line.amount,
    domainErrors: [...line.domainErrors],
    isValid: line.isValid,
  };
}

function mergeIntoConsolidatedLine(
  consolidated: ConsolidatedPaymentLine,
  line: PaymentLine,
): ConsolidatedPaymentLine {
  return {
    ...consolidated,
    sourceLineIds: [...consolidated.sourceLineIds, line.id],
    amount: consolidated.amount + line.amount,
    domainErrors: mergeDomainErrors(consolidated.domainErrors, line.domainErrors),
    isValid: consolidated.isValid && line.isValid,
  };
}

export class ConsolidatePaymentBatchUseCase {
  execute(batch: PaymentBatch): ConsolidatedPaymentBatch {
    const groups = new Map<string, ConsolidatedPaymentLine>();
    const keyOrder: string[] = [];

    for (const line of batch.lines) {
      const key = buildConsolidationKey(line);
      const existing = groups.get(key);

      if (existing) {
        groups.set(key, mergeIntoConsolidatedLine(existing, line));
        continue;
      }

      keyOrder.push(key);
      groups.set(key, createConsolidatedLine(line));
    }

    return {
      lines: keyOrder.map((key) => groups.get(key)!),
    };
  }
}
