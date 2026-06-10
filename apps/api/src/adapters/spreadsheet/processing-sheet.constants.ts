export const PROCESSING_SHEET_NAME = 'Processamento de Pagamentos';

export const PROCESSING_SHEET_HEADERS = [
  'Data do Pagamento',
  'Beneficiário',
  'CPF/CNPJ',
  'Banco',
  'Agência',
  'Conta',
  'Tipo',
  'Valor (R$)',
  'ID Stark Bank',
  'Status',
  'Motivo',
] as const;

export const PROCESSING_COLUMN_HEADERS = {
  paymentDate: 'data do pagamento',
  beneficiary: 'beneficiário',
  taxId: 'cpf/cnpj',
  bank: 'banco',
  branch: 'agência',
  account: 'conta',
  accountType: 'tipo',
  amount: 'valor (r$)',
  starkBankId: 'id stark bank',
  status: 'status',
  motivo: 'motivo',
} as const;

export type ProcessingColumnKey = keyof typeof PROCESSING_COLUMN_HEADERS;
