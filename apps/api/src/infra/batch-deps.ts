import { StarkBankGateway } from '../adapters/gateways/stark-bank.gateway.js';
import { CreateTransfersUseCase } from '../use-cases/create-transfers.use-case.js';
import { PollTransferStatusUseCase } from '../use-cases/poll-transfer-status.use-case.js';
import { ProcessPaymentBatchUseCase } from '../use-cases/process-payment-batch.use-case.js';
import { BatchJobStore } from './batch-job.store.js';

export interface BatchDeps {
  jobStore: BatchJobStore;
  processPaymentBatchUseCase: ProcessPaymentBatchUseCase;
}

function createProcessPaymentBatchUseCase(): ProcessPaymentBatchUseCase {
  const gateway = new StarkBankGateway();
  const createTransfersUseCase = new CreateTransfersUseCase(gateway);
  const pollTransferStatusUseCase = new PollTransferStatusUseCase(gateway);

  return new ProcessPaymentBatchUseCase(createTransfersUseCase, pollTransferStatusUseCase);
}

export function createBatchDeps(): BatchDeps {
  let processPaymentBatchUseCase: ProcessPaymentBatchUseCase | undefined;

  return {
    jobStore: new BatchJobStore(),
    get processPaymentBatchUseCase() {
      if (!processPaymentBatchUseCase) {
        processPaymentBatchUseCase = createProcessPaymentBatchUseCase();
      }

      return processPaymentBatchUseCase;
    },
  };
}
