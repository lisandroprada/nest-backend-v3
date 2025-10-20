export const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function getMonthNameEs(monthNumber: number): string {
  if (monthNumber < 1 || monthNumber > 12) {
    return '';
  }
  return MESES_ES[monthNumber - 1];
}
