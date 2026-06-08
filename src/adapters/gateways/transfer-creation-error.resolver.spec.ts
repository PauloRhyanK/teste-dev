import { resolveTransferCreationMotivo } from './transfer-creation-error.resolver.js';

describe('resolveTransferCreationMotivo', () => {
  it('maps Stark Bank input errors to semantic motivo', () => {
    const error = {
      status: 400,
      errors: [{ code: 'insufficientBalance', message: 'Not enough balance', status: 400 }],
    };

    expect(resolveTransferCreationMotivo(error)).toBe(
      'Erro StarkBank: Saldo insuficiente na conta primária',
    );
  });

  it('maps communication errors to system motivo', () => {
    expect(resolveTransferCreationMotivo({ code: 'ETIMEDOUT', message: 'timeout' })).toBe(
      'Erro de Sistema: Falha de comunicação. Verificar manualmente.',
    );
  });
});
