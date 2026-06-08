import type { ConsolidatedPaymentBatch } from '../domain/entities/consolidated-payment-batch.js';
import type { ConsolidatedPaymentLine } from '../domain/entities/consolidated-payment-line.js';
import { mapFromDomainErrors } from '../domain/services/payment-error.mapper.js';

function resolveInvalidLine(line: ConsolidatedPaymentLine): ConsolidatedPaymentLine {
  if (line.isValid || line.paymentStatus) {
    return { ...line };
  }

  return {
    ...line,
    paymentStatus: 'NÃO PAGO',
    motivo: mapFromDomainErrors(line.domainErrors),
  };
}

export class ResolveLocalPaymentErrorsUseCase {
  execute(batch: ConsolidatedPaymentBatch): ConsolidatedPaymentBatch {
    return {
      lines: batch.lines.map(resolveInvalidLine),
    };
  }
}
