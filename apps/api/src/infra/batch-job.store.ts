import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

import type {
  BatchJobSnapshot,
  BatchJobStatus,
  BatchLogEntry,
  BatchLogLevel,
  BatchProcessingEvent,
  BatchProcessingSummary,
  ProcessingStepId,
} from '@quansa/shared-types';

interface BatchJobRecord {
  batchId: string;
  fileName: string;
  sourceBuffer: Buffer;
  resultBuffer?: Buffer;
  status: BatchJobStatus;
  currentStep: ProcessingStepId | 0;
  createdAt: string;
  completedAt?: string;
  summary?: BatchProcessingSummary;
  logs: BatchLogEntry[];
  emitter: EventEmitter;
}

export class BatchJobStore {
  private readonly jobs = new Map<string, BatchJobRecord>();

  create(fileName: string, sourceBuffer: Buffer): string {
    const batchId = randomUUID();
    const createdAt = new Date().toISOString();

    this.jobs.set(batchId, {
      batchId,
      fileName,
      sourceBuffer,
      status: 'queued',
      currentStep: 0,
      createdAt,
      logs: [],
      emitter: new EventEmitter(),
    });

    return batchId;
  }

  get(batchId: string): BatchJobRecord | undefined {
    return this.jobs.get(batchId);
  }

  setStatus(batchId: string, status: BatchJobStatus): void {
    const job = this.jobs.get(batchId);

    if (!job) {
      return;
    }

    job.status = status;

    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date().toISOString();
    }
  }

  setStep(batchId: string, step: ProcessingStepId): void {
    const job = this.jobs.get(batchId);

    if (job) {
      job.currentStep = step;
    }
  }

  appendLog(batchId: string, level: BatchLogLevel, message: string, timestamp: string): BatchLogEntry {
    const job = this.jobs.get(batchId);

    if (!job) {
      throw new Error(`Batch job not found: ${batchId}`);
    }

    const entry: BatchLogEntry = {
      id: randomUUID(),
      level,
      message,
      timestamp,
    };

    job.logs.push(entry);
    return entry;
  }

  setResultBuffer(batchId: string, buffer: Buffer): void {
    const job = this.jobs.get(batchId);

    if (job) {
      job.resultBuffer = buffer;
    }
  }

  setSummary(batchId: string, summary: BatchProcessingSummary): void {
    const job = this.jobs.get(batchId);

    if (job) {
      job.summary = summary;
    }
  }

  publish(batchId: string, event: BatchProcessingEvent): void {
    const job = this.jobs.get(batchId);

    if (!job) {
      return;
    }

    if (event.type === 'step.changed') {
      job.currentStep = event.step;
    }

    if (event.type === 'log') {
      job.logs.push({
        id: randomUUID(),
        level: event.level,
        message: event.message,
        timestamp: event.timestamp,
      });
    }

    if (event.type === 'batch.completed') {
      job.summary = event.summary;
      job.status = 'completed';
      job.completedAt = event.timestamp;
      job.currentStep = 4;
    }

    if (event.type === 'batch.failed') {
      job.status = 'failed';
      job.completedAt = event.timestamp;
      job.logs.push({
        id: randomUUID(),
        level: 'ERROR',
        message: event.error,
        timestamp: event.timestamp,
      });
    }

    job.emitter.emit('event', event);
  }

  subscribe(batchId: string, listener: (event: BatchProcessingEvent) => void): () => void {
    const job = this.jobs.get(batchId);

    if (!job) {
      throw new Error(`Batch job not found: ${batchId}`);
    }

    job.emitter.on('event', listener);

    return () => {
      job.emitter.off('event', listener);
    };
  }

  toSnapshot(batchId: string): BatchJobSnapshot | undefined {
    const job = this.jobs.get(batchId);

    if (!job) {
      return undefined;
    }

    return {
      batchId: job.batchId,
      status: job.status,
      currentStep: job.currentStep,
      fileName: job.fileName,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      summary: job.summary,
      logs: [...job.logs],
    };
  }
}
