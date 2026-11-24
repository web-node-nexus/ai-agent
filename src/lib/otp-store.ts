type OtpEntry = {
  code: string;
  phone: string;
  userId: string;
  expiresAt: number;
  attempts: number;
};

/** Dev / fallback OTP store when MSG91/2Factor session is local-only. */
const store = new Map<string, OtpEntry>();

const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/** Normalize Indian mobile numbers to E.164 (+91XXXXXXXXXX). */
export function normalizeIndianPhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "").trim();
  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  }
  digits = digits.replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10 || !/^[6-9]/.test(digits)) {
    return null;
  }
  return `+91${digits}`;
}

export function setOtp(userId: string, phone: string, code: string) {
  store.set(userId, {
    code,
    phone,
    userId,
    expiresAt: Date.now() + TTL_MS,
    attempts: 0,
  });
}

export function verifyOtp(
  userId: string,
  phone: string,
  code: string
): { ok: boolean; error?: string } {
  const entry = store.get(userId);
  if (!entry) return { ok: false, error: "OTP expired or not found" };
  if (entry.expiresAt < Date.now()) {
    store.delete(userId);
    return { ok: false, error: "OTP expired" };
  }
  if (entry.phone !== phone) {
    return { ok: false, error: "Phone mismatch" };
  }
  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    store.delete(userId);
    return { ok: false, error: "Too many attempts" };
  }
  if (entry.code !== code) {
    return { ok: false, error: "Invalid OTP" };
  }
  store.delete(userId);
  return { ok: true };
}

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
