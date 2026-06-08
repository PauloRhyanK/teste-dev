import type { PaymentBatchRowDto } from '../adapters/spreadsheet/payment-batch-row.dto.js';
import type { PaymentBatch } from '../domain/entities/payment-batch.js';
import type { PaymentLine } from '../domain/entities/payment-line.js';
import { DomainErrorCode } from '../domain/errors/domain-error-codes.js';
import { DocumentValidator } from '../domain/validators/document.validator.js';

function mapPaymentLineFromDto(dto: PaymentBatchRowDto): PaymentLine {
  const domainErrors: string[] = [];

  if (!DocumentValidator.isValidTaxId(dto.taxId)) {
    domainErrors.push(DomainErrorCode.INVALID_TAX_ID);
  }

  return {
    id: dto.id,
    orderDate: dto.orderDate,
    beneficiary: dto.beneficiary,
    taxId: dto.taxId,
    bank: dto.bank,
    branch: dto.branch,
    account: dto.account,
    accountType: dto.accountType,
    amount: dto.amount,
    domainErrors,
    isValid: domainErrors.length === 0,
  };
}

export function mapPaymentBatchFromDtos(dtos: PaymentBatchRowDto[]): PaymentBatch {
  return {
    lines: dtos.map(mapPaymentLineFromDto),
  };
}
