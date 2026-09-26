// Login is by mobile number + password. Supabase Auth has no SMS-free
// phone+password flow, so each mobile maps to an internal email address
// on the reserved `.invalid` domain (RFC 2606) — it can never receive mail.
export const LOGIN_EMAIL_DOMAIN = "mobile.invalid";

/**
 * Normalises an Indian mobile number to its 10 digits, or returns null if
 * it isn't one. Accepts spaces/dashes, a +91 / 91 prefix, or a leading 0.
 */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** Internal Supabase Auth email for a normalised 10-digit mobile. */
export function mobileToLoginEmail(mobile: string): string {
  if (!/^[6-9]\d{9}$/.test(mobile))
    throw new Error("mobileToLoginEmail expects a normalised mobile");
  return `91${mobile}@${LOGIN_EMAIL_DOMAIN}`;
}
