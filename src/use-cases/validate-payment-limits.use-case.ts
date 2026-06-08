import type { ConsolidatedPaymentBatch } from '../domain/entities/consolidated-payment-batch.js';
import type { ConsolidatedPaymentLine } from '../domain/entities/consolidated-payment-line.js';
import { PaymentLimitValidator } from '../domain/validators/payment-limit.validator.js';

function mergeDomainErrors(existing: string[], incoming: string): string[] {
  return [...new Set([...existing, incoming])];
}

function applyLimitValidation(line: ConsolidatedPaymentLine): ConsolidatedPaymentLine {
  const violationReason = PaymentLimitValidator.getViolationReason(line.amount);

  if (!violationReason) {
    return { ...line };
  }

  return {
    ...line,
    isValid: false,
    paymentStatus: 'NÃO PAGO',
    motivo: violationReason,
    domainErrors: mergeDomainErrors(line.domainErrors, violationReason),
  };
}

export class ValidatePaymentLimitsUseCase {
  execute(batch: ConsolidatedPaymentBatch): ConsolidatedPaymentBatch {
    return {
      lines: batch.lines.map(applyLimitValidation),
    };
  }
}
