import type { CreateBatchResponse } from '@quansa/shared-types';
import type { FastifyInstance } from 'fastify';

import type { BatchJobStore } from '../../infra/batch-job.store.js';
import type { ProcessPaymentBatchUseCase } from '../../use-cases/process-payment-batch.use-case.js';

interface BatchRouteDeps {
  jobStore: BatchJobStore;
  processPaymentBatchUseCase: ProcessPaymentBatchUseCase;
}

function isXlsxFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.xlsx');
}

export async function registerBatchRoutes(app: FastifyInstance, deps: BatchRouteDeps) {
  app.post('/batches', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({
        error: 'Arquivo não enviado. Use o campo "file".',
        code: 'INVALID_FILE_TYPE',
      });
    }

    if (!isXlsxFile(data.filename)) {
      return reply.status(400).send({
        error: 'Formato inválido. Envie um arquivo .xlsx',
        code: 'INVALID_FILE_TYPE',
      });
    }

    const buffer = await data.toBuffer();
    const batchId = deps.jobStore.create(data.filename, buffer);

    const response: CreateBatchResponse = {
      batchId,
      fileName: data.filename,
      fileSizeBytes: buffer.length,
      status: 'queued',
    };

    deps.jobStore.setStatus(batchId, 'running');

    void deps.processPaymentBatchUseCase
      .execute(batchId, buffer, (event) => {
        deps.jobStore.publish(batchId, event);
      })
      .then((resultBuffer) => {
        deps.jobStore.setResultBuffer(batchId, resultBuffer);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Erro inesperado no processamento.';

        deps.jobStore.publish(batchId, {
          type: 'batch.failed',
          batchId,
          timestamp: new Date().toISOString(),
          error: message,
        });
      });

    return reply.status(202).send(response);
  });

  app.get<{ Params: { id: string } }>('/batches/:id', async (request, reply) => {
    const snapshot = deps.jobStore.toSnapshot(request.params.id);

    if (!snapshot) {
      return reply.status(404).send({
        error: 'Lote não encontrado.',
        code: 'BATCH_NOT_FOUND',
      });
    }

    return reply.send(snapshot);
  });

  app.get<{ Params: { id: string } }>('/batches/:id/events', async (request, reply) => {
    const { id } = request.params;
    const job = deps.jobStore.get(id);

    if (!job) {
      return reply.status(404).send({
        error: 'Lote não encontrado.',
        code: 'BATCH_NOT_FOUND',
      });
    }

    reply.hijack();

    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const sendEvent = (event: unknown) => {
      raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const snapshot = deps.jobStore.toSnapshot(id);

    if (snapshot) {
      for (const log of snapshot.logs) {
        sendEvent({
          type: 'log',
          batchId: id,
          level: log.level,
          message: log.message,
          timestamp: log.timestamp,
        });
      }

      if (snapshot.currentStep > 0) {
        sendEvent({
          type: 'step.changed',
          batchId: id,
          step: snapshot.currentStep,
          stepTitle: '',
          timestamp: snapshot.createdAt,
        });
      }

      if (snapshot.status === 'completed' && snapshot.summary) {
        sendEvent({
          type: 'batch.completed',
          batchId: id,
          step: 4,
          timestamp: snapshot.completedAt ?? new Date().toISOString(),
          summary: snapshot.summary,
          downloadUrl: `/batches/${id}/download`,
        });
      }

      if (snapshot.status === 'failed') {
        const lastError = snapshot.logs.filter((log) => log.level === 'ERROR').at(-1);

        if (lastError) {
          sendEvent({
            type: 'batch.failed',
            batchId: id,
            timestamp: lastError.timestamp,
            error: lastError.message,
          });
        }
      }
    }

    if (job.status === 'completed' || job.status === 'failed') {
      raw.end();
      return;
    }

    const unsubscribe = deps.jobStore.subscribe(id, sendEvent);

    const heartbeat = setInterval(() => {
      raw.write(': heartbeat\n\n');
    }, 15000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.get<{ Params: { id: string } }>('/batches/:id/download', async (request, reply) => {
    const job = deps.jobStore.get(request.params.id);

    if (!job) {
      return reply.status(404).send({
        error: 'Lote não encontrado.',
        code: 'BATCH_NOT_FOUND',
      });
    }

    if (!job.resultBuffer) {
      return reply.status(409).send({
        error: 'Relatório ainda não está pronto.',
        code: 'BATCH_NOT_READY',
      });
    }

    const downloadName = job.fileName.replace(/\.xlsx$/i, '_processada.xlsx');

    return reply
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .header('Content-Disposition', `attachment; filename="${downloadName}"`)
      .send(job.resultBuffer);
  });
}
