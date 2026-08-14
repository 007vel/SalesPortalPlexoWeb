/**
 * Formats an ISO date string (`yyyy-MM-dd`, optionally with a time/offset suffix) as `MM-DD-YYYY`
 * for display. Parses the leading `yyyy-MM-dd` directly rather than via `Date` so it's immune to
 * timezone shifting. Returns the input unchanged if it doesn't start with an ISO date.
 */
export function formatDateMDY(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${month}-${day}-${year}`;
}
