import { normalizeIndianPhone } from "@/lib/otp-store";

export type TwoFactorResult = {
  ok: boolean;
  status?: string;
  details?: string;
  error?: string;
};

function baseUrl() {
  const raw = process.env.TWOFACTOR_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://2factor.in/API/V1";
}

function apiKey() {
  return process.env.TWOFACTOR_API_KEY?.trim() || "";
}

function template() {
  return process.env.TWOFACTOR_SMS_TEMPLATE?.trim() || "OTP1";
}

/** 10-digit Indian mobile (no +91). */
export function toTenDigit(phoneE164: string): string | null {
  const normalized = normalizeIndianPhone(phoneE164);
  if (!normalized) return null;
  return normalized.replace(/^\+91/, "");
}

/** 91XXXXXXXXXX for VERIFY3. */
export function to91(phoneE164: string): string | null {
  const ten = toTenDigit(phoneE164);
  return ten ? `91${ten}` : null;
}

async function getJson(url: string): Promise<TwoFactorResult> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      Status?: string;
      Details?: string;
    };
    const status = data.Status ?? "";
    const details = data.Details ?? "";
    const ok = status.toLowerCase() === "success";
    if (!ok) {
      return {
        ok: false,
        status,
        details,
        error: details || status || "2Factor request failed",
      };
    }
    return { ok: true, status, details };
  } catch (err) {
    console.error("[2factor]", err);
    return { ok: false, error: "SMS gateway unreachable" };
  }
}

/**
 * Send OTP via 2Factor AUTOGEN.
 * GET /{API_KEY}/SMS/{10digit}/AUTOGEN/{TEMPLATE}
 */
export async function twoFactorSendOtp(phoneE164: string): Promise<TwoFactorResult> {
  const key = apiKey();
  if (!key) {
    return { ok: false, error: "TWOFACTOR_API_KEY is not configured" };
  }
  const ten = toTenDigit(phoneE164);
  if (!ten) return { ok: false, error: "Invalid phone number" };

  const url = `${baseUrl()}/${key}/SMS/${ten}/AUTOGEN/${encodeURIComponent(template())}`;
  return getJson(url);
}

/**
 * Verify OTP via 2Factor VERIFY3.
 * GET /{API_KEY}/SMS/VERIFY3/{91XXXXXXXXXX}/{otp}
 */
export async function twoFactorVerifyOtp(
  phoneE164: string,
  code: string
): Promise<TwoFactorResult> {
  const key = apiKey();
  if (!key) {
    return { ok: false, error: "TWOFACTOR_API_KEY is not configured" };
  }
  const phone91 = to91(phoneE164);
  if (!phone91) return { ok: false, error: "Invalid phone number" };
  if (!/^\d{4,8}$/.test(code)) {
    return { ok: false, error: "Invalid OTP" };
  }

  const url = `${baseUrl()}/${key}/SMS/VERIFY3/${phone91}/${code}`;
  return getJson(url);
}

export function phoneToAuthEmail(phoneE164: string) {
  const ten = toTenDigit(phoneE164);
  if (!ten) throw new Error("Invalid phone");
  return `${ten}@phone.taraworld.local`;
}
