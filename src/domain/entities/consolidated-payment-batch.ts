import type { ConsolidatedPaymentLine } from './consolidated-payment-line.js';

export interface ConsolidatedPaymentBatch {
  lines: ConsolidatedPaymentLine[];
}
