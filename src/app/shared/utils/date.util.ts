/** Parsea YYYY-MM-DD como fecha local (sin desfase UTC). */
export function parseIsoDateLocal(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Convierte Date a YYYY-MM-DD en hora local. */
export function toIsoDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Convierte YYYY-MM-DD a DD/MM/YYYY (para UI/export). */
export function formatIsoToDdMmYyyy(iso: string): string {
  const date = parseIsoDateLocal(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Convierte ISO timestamp (created_at) a DD/MM/YYYY en hora Argentina. */
export function formatTimestampToDdMmYyyy(
  iso: string,
  timeZone = 'America/Argentina/Buenos_Aires',
): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}
