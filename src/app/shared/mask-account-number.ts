/**
 * Masks a bank account number for display, leaving only the last 5 characters visible
 * (e.g. `1234567890` -> `•••••67890`). Returns the input unchanged if it's 5 characters or
 * shorter, since there'd be nothing left to mask.
 */
export function maskAccountNumber(value: string): string {
  if (value.length <= 5) return value;
  return '•'.repeat(value.length - 5) + value.slice(-5);
}
