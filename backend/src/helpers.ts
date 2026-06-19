export function parseDeadline(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value)) return new Date(value);
  return new Date(value.length === 16 ? `${value}:00Z` : `${value}Z`);
}

export function toMysqlDatetime(value: string | Date): string {
  return parseDeadline(value).toISOString().slice(0, 19).replace('T', ' ');
}

export function jstNowAsDatetime(): string {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}
