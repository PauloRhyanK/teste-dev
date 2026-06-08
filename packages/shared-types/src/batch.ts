export type ProcessingStepId = 1 | 2 | 3 | 4;

export type BatchJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type BatchLogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface CreateBatchResponse {
  batchId: string;
  fileName: string;
  fileSizeBytes: number;
  status: 'queued';
}

export interface BatchStepChangedEvent {
  type: 'step.changed';
  batchId: string;
  step: ProcessingStepId;
  stepTitle: string;
  timestamp: string;
}

export interface BatchLogEvent {
  type: 'log';
  batchId: string;
  level: BatchLogLevel;
  message: string;
  timestamp: string;
  sourceLineId?: string;
  transferId?: string;
}

export interface BatchProcessingSummary {
  totalInputRows: number;
  consolidatedPayments: number;
  paid: number;
  notPaid: number;
  pendingManualReview: number;
}

export interface BatchCompletedEvent {
  type: 'batch.completed';
  batchId: string;
  step: 4;
  timestamp: string;
  summary: BatchProcessingSummary;
  downloadUrl: string;
}

export interface BatchFailedEvent {
  type: 'batch.failed';
  batchId: string;
  timestamp: string;
  error: string;
  failedAtStep?: ProcessingStepId;
}

export type BatchProcessingEvent =
  | BatchStepChangedEvent
  | BatchLogEvent
  | BatchCompletedEvent
  | BatchFailedEvent;

export interface BatchLogEntry {
  id: string;
  level: BatchLogLevel;
  message: string;
  timestamp: string;
}

export interface BatchJobSnapshot {
  batchId: string;
  status: BatchJobStatus;
  currentStep: ProcessingStepId | 0;
  fileName: string;
  createdAt: string;
  completedAt?: string;
  summary?: BatchProcessingSummary;
  logs: BatchLogEntry[];
}

export interface ApiErrorResponse {
  error: string;
  code?: 'INVALID_FILE_TYPE' | 'MISSING_WORKSHEET' | 'BATCH_NOT_FOUND' | 'BATCH_NOT_READY';
}
