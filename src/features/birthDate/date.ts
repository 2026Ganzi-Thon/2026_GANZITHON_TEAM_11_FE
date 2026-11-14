export interface DateParts {
  year: number;
  month: number;
  day: number;
}
export function daysInMonth(year: number, month: number): number {
  if (month === 2)
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
function valid(parts: DateParts): boolean {
  return (
    [parts.year, parts.month, parts.day].every(Number.isInteger) &&
    parts.year >= 1 &&
    parts.year <= 9999 &&
    parts.month >= 1 &&
    parts.month <= 12 &&
    parts.day >= 1 &&
    parts.day <= daysInMonth(parts.year, parts.month)
  );
}
export function formatDate(p: DateParts): string {
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
export function parseDate(value: string): DateParts | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const [year, month, day] = value.split('-').map(Number);
  const result = { year, month, day };
  return valid(result) ? result : null;
}
export function birthDateError(
  parts: DateParts,
  today: string,
): 'invalid' | 'future' | null {
  if (!valid(parts) || !parseDate(today)) return 'invalid';
  return formatDate(parts) > today ? 'future' : null;
}
export function withDatePart(
  parts: DateParts,
  part: keyof DateParts,
  value: number,
): DateParts {
  const next = { ...parts, [part]: value };
  return {
    ...next,
    day: Math.min(next.day, daysInMonth(next.year, next.month)),
  };
}
export function kstDate(instant: Date): string {
  return new Date(instant.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
