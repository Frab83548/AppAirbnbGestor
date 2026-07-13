import { parseIsoDateLocal, toIsoDateLocal } from '../../shared/utils/date.util';

export type ReportPeriodMode = 'monthly' | 'weekly' | 'custom';

export interface ReportDateRange {
  dateFrom: string;
  dateTo: string;
}

/** Lunes a domingo de la semana que contiene la fecha (ISO). */
export function getWeekRange(reference: Date): ReportDateRange {
  const date = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { dateFrom: toIsoDateLocal(monday), dateTo: toIsoDateLocal(sunday) };
}

export function getMonthRange(month: number, year: number): ReportDateRange {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    dateFrom: `${year}-${String(month).padStart(2, '0')}-01`,
    dateTo: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function shiftWeek(reference: Date, weeks: number): Date {
  const next = new Date(reference);
  next.setDate(next.getDate() + weeks * 7);
  return next;
}

export function formatRangeLabel(dateFrom: string, dateTo: string): string {
  const from = parseIsoDateLocal(dateFrom);
  const to = parseIsoDateLocal(dateTo);
  const sameYear = from.getFullYear() === to.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();

  const fromOpts: Intl.DateTimeFormatOptions = sameMonth
    ? { day: 'numeric' }
    : { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) };
  const toOpts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };

  const fromLabel = from.toLocaleDateString('es-AR', fromOpts);
  const toLabel = to.toLocaleDateString('es-AR', toOpts);
  return `${fromLabel} – ${toLabel}`;
}

export function yearsInRange(dateFrom: string, dateTo: string): number[] {
  const fromYear = parseIsoDateLocal(dateFrom).getFullYear();
  const toYear = parseIsoDateLocal(dateTo).getFullYear();
  const years: number[] = [];
  for (let year = fromYear; year <= toYear; year++) {
    years.push(year);
  }
  return years;
}

/** True si el mes calendario (month/year) intersecta el rango [dateFrom, dateTo]. */
export function monthOverlapsRange(
  month: number,
  year: number,
  dateFrom: string,
  dateTo: string,
): boolean {
  const monthRange = getMonthRange(month, year);
  return monthRange.dateFrom <= dateTo && monthRange.dateTo >= dateFrom;
}

export function buildExportFilename(
  prefix: string,
  dateFrom: string,
  dateTo: string,
  propertyName?: string,
): string {
  const propertyPart = propertyName
    ? `_${propertyName.replace(/[^a-zA-Z0-9]+/g, '_')}`
    : '';
  return `${prefix}${propertyPart}_${dateFrom}_${dateTo}`.replace(/-/g, '');
}
