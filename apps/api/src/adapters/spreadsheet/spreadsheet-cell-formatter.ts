import type ExcelJS from 'exceljs';

export function setCellAsText(cell: ExcelJS.Cell, value: string): void {
  cell.value = value;
  cell.numFmt = '@';
}

export function setCellAsCurrency(cell: ExcelJS.Cell, value: number): void {
  cell.value = value;
  cell.numFmt = '#,##0.00';
}
