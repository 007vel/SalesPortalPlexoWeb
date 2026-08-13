/** Matches a complete `xxx-xxx-xxxx` phone number — the only shape the backend accepts besides empty. */
export const PHONE_PATTERN = /^\d{3}-\d{3}-\d{4}$/;

/** Reformats raw input as `xxx-xxx-xxxx`, dropping non-digits and capping at 10 digits. */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length > 6) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length > 3) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return digits;
}
