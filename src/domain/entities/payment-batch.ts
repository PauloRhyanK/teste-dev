import type { PaymentLine } from './payment-line.js';

export interface PaymentBatch {
  lines: PaymentLine[];
}
