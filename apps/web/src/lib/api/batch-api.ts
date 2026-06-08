import type { BatchProcessingEvent, CreateBatchResponse } from '@quansa/shared-types';

export async function uploadBatch(file: File): Promise<CreateBatchResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/batches', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Falha no upload (${response.status})`);
  }

  return response.json() as Promise<CreateBatchResponse>;
}

export function subscribeBatchEvents(
  batchId: string,
  onEvent: (event: BatchProcessingEvent) => void,
  onError?: (error: Error) => void,
): () => void {
  const source = new EventSource(`/batches/${batchId}/events`);

  source.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as BatchProcessingEvent;
      onEvent(event);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Evento SSE inválido'));
    }
  };

  source.onerror = () => {
    onError?.(new Error('Conexão SSE interrompida'));
    source.close();
  };

  return () => source.close();
}

export async function downloadBatch(batchId: string): Promise<Blob> {
  const response = await fetch(`/batches/${batchId}/download`);

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Falha no download (${response.status})`);
  }

  return response.blob();
}
