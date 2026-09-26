// Temporary passwords are read out or typed by hand, so skip look-alike
// characters (0/O, 1/l/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
export const TEMP_PASSWORD_LENGTH = 10;

/** Cryptographically random temporary password (no modulo bias). */
export function generateTempPassword(length = TEMP_PASSWORD_LENGTH): string {
  // Largest multiple of the alphabet size that fits in a byte.
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b < limit && out.length < length) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

export const TEMP_PASSWORD_ALPHABET = ALPHABET;
