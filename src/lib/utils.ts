import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function splitGstInclusive(totalPaise: number, gstRateBps: number) {
  // Prices are GST-inclusive. base = total / (1 + rate), gst = total - base
  const rate = gstRateBps / 10000;
  const basePaise = Math.round(totalPaise / (1 + rate));
  const gstPaise = totalPaise - basePaise;
  return { basePaise, gstPaise, totalPaise };
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function isAtLeast18(dob: string | Date): boolean {
  const d = typeof dob === "string" ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age >= 18;
}

/** Latest DOB allowed for 18+ (YYYY-MM-DD). Under-18 dates cannot be selected. */
export function maxDobFor18Plus(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export function matchCharacterGender(
  userGender: "male" | "female" | "other" | null | undefined,
  characterGender: "male" | "female"
): boolean {
  if (!userGender || userGender === "other") return true;
  if (userGender === "female") return characterGender === "male";
  if (userGender === "male") return characterGender === "female";
  return true;
}

export function absoluteUrl(path = "/") {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
