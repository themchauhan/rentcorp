// Deep links that open the user's own WhatsApp / SMS app with the message
// pre-filled. Numbers are stored as 10 Indian digits; links use +91.

export type Platform = "ios" | "android";

function international(mobile: string): string {
  if (!/^[6-9]\d{9}$/.test(mobile)) throw new Error("Expected a 10-digit Indian mobile");
  return `91${mobile}`;
}

/** https://wa.me/<country code + digits>?text=<message> */
export function whatsappLink(mobile: string, text: string): string {
  return `https://wa.me/${international(mobile)}?text=${encodeURIComponent(text)}`;
}

/** iOS wants `sms:<n>&body=`, Android `sms:<n>?body=`. */
export function smsLink(mobile: string, text: string, platform: Platform): string {
  const sep = platform === "ios" ? "&" : "?";
  return `sms:+${international(mobile)}${sep}body=${encodeURIComponent(text)}`;
}

export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  // iPadOS reports itself as a Mac.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  return "android";
}
