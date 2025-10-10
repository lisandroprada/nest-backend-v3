export const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export const MESES_SHORT_ES = [
  '   ene',
  '   feb',
  '   mar',
  '   abr',
  '   may',
  '   jun',
  '   jul',
  '   ago',
  '   sep',
  '   oct',
  '   nov',
  '   dic',
];

export const MESES_EN = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

export const MESES_SHORT_EN = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

export const MESES = {
  es: MESES_ES,
  en: MESES_EN,
  es_short: MESES_SHORT_ES,
  en_short: MESES_SHORT_EN,
};

export const DIAS_ES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

export const DIAS_EN = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export const DIAS_SHORT_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
export const DIAS_SHORT_EN = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const DIAS = {
  es: DIAS_ES,
  en: DIAS_EN,
  en_short: DIAS_SHORT_EN,
  es_short: DIAS_SHORT_ES,
};

/**
 * Devuelve el nombre del mes en español dado su índice.
 * @param monthIndex Índice del mes (0 = enero, 11 = diciembre)
 * @returns Nombre del mes en español
 */
export function getMonthNameEs(monthIndex: number): string {
  return MESES_ES[monthIndex];
}

/**
 * Devuelve la fecha actual formateada.
 * @param date Opcional, fecha a formatear.
 * @returns Fecha en formato `YYYY-MM-DD`
 */
export function formatDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
