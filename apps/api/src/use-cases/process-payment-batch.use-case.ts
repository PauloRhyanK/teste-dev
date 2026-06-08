import type { BatchProcessingEvent, BatchProcessingSummary } from '@quansa/shared-types';

import { SpreadsheetAdapter } from '../adapters/spreadsheet/spreadsheet.adapter.js';
import { mapToPaymentProcessingOutputRows } from '../adapters/spreadsheet/payment-processing.mapper.js';
import type { PaymentBatchRowDto } from '../adapters/spreadsheet/payment-batch-row.dto.js';
import { mapFromDomainErrors } from '../domain/services/payment-error.mapper.js';
import { ConsolidatePaymentBatchUseCase } from './consolidate-payment-batch.use-case.js';
import { CreateTransfersUseCase } from './create-transfers.use-case.js';
import { mapPaymentBatchFromDtos } from './map-payment-batch.js';
import { PollTransferStatusUseCase } from './poll-transfer-status.use-case.js';
import { ResolveLocalPaymentErrorsUseCase } from './resolve-local-payment-errors.use-case.js';
import { ValidatePaymentLimitsUseCase } from './validate-payment-limits.use-case.js';

const STEP_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Lendo e Validando Planilha',
  2: 'Consolidando Pagamentos',
  3: 'Enviando PIX via Stark Bank',
  4: 'Finalizado',
};

export type BatchEventEmitter = (event: BatchProcessingEvent) => void;

function formatBrl(amount: number): string {
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildSummary(
  totalInputRows: number,
  consolidatedCount: number,
  verifications: { paymentStatus: string }[],
): BatchProcessingSummary {
  let paid = 0;
  let notPaid = 0;
  let pendingManualReview = 0;

  for (const verification of verifications) {
    if (verification.paymentStatus === 'PAGO') {
      paid += 1;
    } else if (verification.paymentStatus === 'PENDENTE - VERIFICAÇÃO MANUAL') {
      pendingManualReview += 1;
    } else {
      notPaid += 1;
    }
  }

  return {
    totalInputRows,
    consolidatedPayments: consolidatedCount,
    paid,
    notPaid,
    pendingManualReview,
  };
}

export class ProcessPaymentBatchUseCase {
  private readonly spreadsheetAdapter = new SpreadsheetAdapter();
  private readonly consolidateUseCase = new ConsolidatePaymentBatchUseCase();
  private readonly resolveLocalErrorsUseCase = new ResolveLocalPaymentErrorsUseCase();
  private readonly validateLimitsUseCase = new ValidatePaymentLimitsUseCase();

  constructor(
    private readonly createTransfersUseCase: CreateTransfersUseCase,
    private readonly pollTransferStatusUseCase: PollTransferStatusUseCase,
  ) {}

  async execute(
    batchId: string,
    sourceBuffer: Buffer,
    emit: BatchEventEmitter,
  ): Promise<Buffer> {
    const emitStep = (step: 1 | 2 | 3 | 4) => {
      emit({
        type: 'step.changed',
        batchId,
        step,
        stepTitle: STEP_TITLES[step],
        timestamp: nowIso(),
      });
    };

    const emitLog = (
      level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR',
      message: string,
      extra?: { sourceLineId?: string; transferId?: string },
    ) => {
      emit({
        type: 'log',
        batchId,
        level,
        message,
        timestamp: nowIso(),
        ...extra,
      });
    };

    emitStep(1);
    emitLog('INFO', 'Abrindo planilha enviada...');

    const dtos = await this.spreadsheetAdapter.parsePaymentBatch(sourceBuffer);
    emitLog('INFO', `Lendo linha 1 — cabeçalho detectado.`);

    dtos.forEach((dto: PaymentBatchRowDto, index: number) => {
      const lineNumber = index + 2;
      emitLog(
        'INFO',
        `Lendo linha ${lineNumber} — ${dto.beneficiary} • ${formatBrl(dto.amount)}`,
        { sourceLineId: dto.id },
      );
    });

    const paymentBatch = mapPaymentBatchFromDtos(dtos);

    paymentBatch.lines.forEach((line) => {
      if (line.isValid) {
        emitLog('SUCCESS', `Linha ${line.id} validada com sucesso.`, { sourceLineId: line.id });
        return;
      }

      emitLog('WARNING', `Linha ${line.id}: ${mapFromDomainErrors(line.domainErrors)}, ignorando.`, {
        sourceLineId: line.id,
      });
    });

    emitStep(2);
    emitLog('INFO', `Consolidando ${paymentBatch.lines.length} pagamentos por chave PIX...`);

    const consolidated = this.consolidateUseCase.execute(paymentBatch);
    const mergedGroups = consolidated.lines.filter((line) => line.sourceLineIds.length > 1).length;

    if (mergedGroups > 0) {
      emitLog('INFO', `Agrupados ${mergedGroups} pagamentos duplicados por beneficiário/dia.`);
    }

    emitLog(
      'SUCCESS',
      `Lote consolidado: ${consolidated.lines.length} transações prontas.`,
    );

    const withLocalErrors = this.resolveLocalErrorsUseCase.execute(consolidated);
    const withLimits = this.validateLimitsUseCase.execute(withLocalErrors);

    withLimits.lines.forEach((line) => {
      if (line.paymentStatus === 'NÃO PAGO' && line.motivo) {
        emitLog('WARNING', `${line.beneficiary}: ${line.motivo}`, {
          sourceLineId: line.sourceLineIds[0],
        });
      }
    });

    emitStep(3);
    emitLog('INFO', 'Autenticando com Stark Bank...');

    const creationResults = await this.createTransfersUseCase.execute(batchId, withLimits);

    emitLog('SUCCESS', 'Sessão autenticada.');

    const eligibleCount = creationResults.filter(
      (result) => result.paymentStatus === 'PROCESSANDO',
    ).length;

    if (eligibleCount > 0) {
      emitLog('INFO', `Enviando ${eligibleCount} transferências...`);
    }

    creationResults.forEach((result) => {
      const line = withLimits.lines.find(
        (payment) => payment.sourceLineIds.join(',') === result.sourceLineIds.join(','),
      );

      if (!line) {
        return;
      }

      if (result.paymentStatus === 'PROCESSANDO') {
        emitLog(
          'SUCCESS',
          `PIX enviado — ${line.beneficiary} • ${formatBrl(line.amount)}`,
          { sourceLineId: line.sourceLineIds[0], transferId: result.transferId },
        );
        return;
      }

      if (result.paymentStatus === 'NÃO PAGO' && result.motivo && line.isValid) {
        emitLog('ERROR', `Falha — ${line.beneficiary}: ${result.motivo}`, {
          sourceLineId: line.sourceLineIds[0],
        });
      }
    });

    const verifications = await this.pollTransferStatusUseCase.execute(creationResults);

    verifications.forEach((verification, index) => {
      const line = withLimits.lines[index];

      if (!line || verification.paymentStatus === 'PROCESSANDO') {
        return;
      }

      if (verification.paymentStatus === 'PAGO') {
        return;
      }

      if (verification.paymentStatus === 'PENDENTE - VERIFICAÇÃO MANUAL') {
        emitLog('WARNING', `${line.beneficiary}: ${verification.motivo ?? 'Verificação pendente.'}`, {
          sourceLineId: line.sourceLineIds[0],
          transferId: verification.transferId,
        });
        return;
      }

      if (verification.motivo) {
        emitLog('ERROR', `Falha — ${line.beneficiary}: ${verification.motivo}`, {
          sourceLineId: line.sourceLineIds[0],
          transferId: verification.transferId,
        });
      }
    });

    const paidCount = verifications.filter((v) => v.paymentStatus === 'PAGO').length;

    if (paidCount > 0) {
      emitLog('SUCCESS', `${paidCount} pagamentos liquidados com sucesso.`);
    }

    const outputRows = mapToPaymentProcessingOutputRows(withLimits.lines, verifications);
    const resultBuffer = await this.spreadsheetAdapter.writeProcessamentoPagamentos(
      sourceBuffer,
      outputRows,
    );

    emitStep(4);
    emitLog('SUCCESS', 'Processamento concluído. Relatório gerado.');

    const summary = buildSummary(dtos.length, consolidated.lines.length, verifications);

    emit({
      type: 'batch.completed',
      batchId,
      step: 4,
      timestamp: nowIso(),
      summary,
      downloadUrl: `/batches/${batchId}/download`,
    });

    return resultBuffer;
  }
}
