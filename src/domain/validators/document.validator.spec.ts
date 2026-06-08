import { DocumentValidator } from './document.validator.js';

describe('DocumentValidator', () => {
  describe('isValidCpf', () => {
    it.each(['390.533.447-05', '52998224725', '11144477735'])(
      'returns true for valid CPF %s',
      (cpf) => {
        expect(DocumentValidator.isValidCpf(cpf)).toBe(true);
      },
    );

    it.each(['111.111.111-11', '123.456.789-00', '123'])(
      'returns false for invalid CPF %s',
      (cpf) => {
        expect(DocumentValidator.isValidCpf(cpf)).toBe(false);
      },
    );
  });

  describe('isValidCnpj', () => {
    it('returns true for a valid CNPJ', () => {
      expect(DocumentValidator.isValidCnpj('11.222.333/0001-81')).toBe(true);
    });

    it('returns false for an invalid CNPJ', () => {
      expect(DocumentValidator.isValidCnpj('11.111.111/1111-11')).toBe(false);
    });
  });

  describe('isValidTaxId', () => {
    it('validates CPF and CNPJ based on digit count', () => {
      expect(DocumentValidator.isValidTaxId('390.533.447-05')).toBe(true);
      expect(DocumentValidator.isValidTaxId('11.222.333/0001-81')).toBe(true);
      expect(DocumentValidator.isValidTaxId('111.111.111-11')).toBe(false);
      expect(DocumentValidator.isValidTaxId('00.000.000/0000-00')).toBe(false);
    });
  });
});
