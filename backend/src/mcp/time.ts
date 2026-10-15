// Tasqa stores every datetime as a JST wall-clock value serialized as if it
// were UTC (see frontend/src/lib/deadline.ts). So the DB column "10:00" means
// 10:00 JST. All MCP date handling works on that wall clock directly; there is
// no UTC conversion on the way in or out.

const JST_OFFSET_MINUTES = 9 * 60;

const DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Formats the UTC fields of `d` as a MySQL DATETIME string. */
function formatWall(d: Date): string {
  return (
    `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

/**
 * Parses an ISO 8601 date/datetime supplied by an MCP client into the JST wall
 * clock string stored in the DB ('YYYY-MM-DD HH:MM:SS').
 *
 * - With an offset (`Z`, `+09:00`, `-0500`) the instant is converted to JST.
 * - Without an offset the value is taken to already be JST.
 * - A date-only value means 00:00, or 23:59:59 when `endOfDay` is set.
 *
 * Returns null when the value is not a real calendar date/time.
 */
export function parseToJstWall(value: string, opts: { endOfDay?: boolean } = {}): string | null {
  const m = DATETIME_RE.exec(value.trim());
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dateOnly = m[4] === undefined;
  const hour = dateOnly ? (opts.endOfDay ? 23 : 0) : Number(m[4]);
  const minute = dateOnly ? (opts.endOfDay ? 59 : 0) : Number(m[5]);
  const second = dateOnly ? (opts.endOfDay ? 59 : 0) : Number(m[6] ?? 0);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  const wallMs = Date.UTC(year, month - 1, day, hour, minute, second);

  const tz = m[7];
  if (!tz || dateOnly) {
    // A date-only value has no instant to convert; treat it as a JST date.
    return formatWall(new Date(wallMs));
  }
  let offsetMinutes = 0;
  if (tz.toUpperCase() !== 'Z') {
    const sign = tz[0] === '-' ? -1 : 1;
    const digits = tz.slice(1).replace(':', '');
    const oh = Number(digits.slice(0, 2));
    const om = Number(digits.slice(2, 4));
    if (oh > 23 || om > 59) return null;
    offsetMinutes = sign * (oh * 60 + om);
  }
  const utcMs = wallMs - offsetMinutes * 60_000;
  return formatWall(new Date(utcMs + JST_OFFSET_MINUTES * 60_000));
}

/** Current time as a JST wall-clock DB string. */
export function jstWallNow(now: Date = new Date()): string {
  return formatWall(new Date(now.getTime() + JST_OFFSET_MINUTES * 60_000));
}

/** Adds whole days to a wall-clock DB string. */
export function addDaysWall(wall: string, days: number): string {
  const d = new Date(`${wall.replace(' ', 'T')}Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return formatWall(d);
}

/** Renders a DB DATETIME (Date from mysql2, or string) as ISO 8601 with +09:00. */
export function wallToIso(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(`${value.replace(' ', 'T')}Z`);
  return `${formatWall(d).replace(' ', 'T')}+09:00`;
}

/** Same as wallToIso but "YYYY-MM-DD HH:MM", for human-readable summaries. */
export function wallToDisplay(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(`${value.replace(' ', 'T')}Z`);
  return formatWall(d).slice(0, 16);
}

/** Normalizes a DB DATETIME (Date or string) to 'YYYY-MM-DD HH:MM:SS' for comparisons. */
export function wallKey(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(`${value.replace(' ', 'T')}Z`);
  return formatWall(d);
}
