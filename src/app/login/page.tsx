"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/app";
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = safeNext(searchParams.get("next"));

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function sendOtp() {
    if (phone.length !== 10) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/auth/phone/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not send OTP");
        return;
      }
      setStep("otp");
      setOtp("");
      toast.success("OTP sent to your phone");
    } catch {
      toast.error("Network error");
    } finally {
      setSending(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 4) {
      toast.error("Enter the OTP");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not verify OTP");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        type: "email",
        token_hash: data.token_hash,
      });
      if (error) {
        toast.error(error.message || "Login session failed");
        return;
      }

      toast.success("Logged in");
      const dest = data.onboarding_complete
        ? nextParam === "/onboarding"
          ? "/app"
          : nextParam
        : "/onboarding";
      router.replace(dest);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-mesh px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <p className="font-display text-4xl tracking-tight sm:text-5xl">
              Tara<span className="text-gradient">World</span>
            </p>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in with your mobile number. First chat includes{" "}
            <span className="text-gold">3 minutes free</span>.
          </p>
        </div>

        <Card className="glass border-white/12 shadow-2xl shadow-rose-950/40">
          <CardHeader className="space-y-2 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/30 to-violet-600/30 ring-1 ring-white/15">
                <Sparkles className="h-4 w-4 text-rose-200" />
              </span>
              <div>
                <CardTitle className="font-display text-xl">
                  Phone login
                </CardTitle>
                <CardDescription>
                  OTP only — no Google or email.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === "phone" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile number</Label>
                  <div className="flex gap-2">
                    <span className="flex h-11 items-center rounded-2xl border border-white/15 bg-white/5 px-3 text-sm text-muted-foreground">
                      +91
                    </span>
                    <Input
                      id="phone"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      className="flex-1"
                      autoFocus
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  disabled={sending || phone.length !== 10}
                  onClick={sendOtp}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  Send OTP
                </Button>
              </div>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Enter the OTP sent to{" "}
                  <span className="text-foreground">+91 {phone}</span>
                </p>
                <div className="space-y-2">
                  <Label htmlFor="otp">OTP</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                    className="tracking-[0.3em]"
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={verifying || otp.length < 4}
                >
                  {verifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  Verify & login
                </Button>
                <div className="flex justify-between text-xs">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground hover:underline"
                    onClick={() => {
                      setStep("phone");
                      setOtp("");
                    }}
                    disabled={verifying}
                  >
                    Change number
                  </button>
                  <button
                    type="button"
                    className="text-rose-300 hover:underline"
                    onClick={sendOtp}
                    disabled={sending || verifying}
                  >
                    Resend OTP
                  </button>
                </div>
              </form>
            )}

            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              18+ only. Free 3 minutes start on your first chat message.{" "}
              <Link href="/terms" className="text-rose-300 hover:underline">
                Terms
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground hover:underline">
            ← Back to home
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-mesh">
          <Loader2 className="h-6 w-6 animate-spin text-rose-300" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
