"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn, isAtLeast18 } from "@/lib/utils";
import type { Gender } from "@/types/database";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Step = "name" | "gender" | "dob" | "terms" | "phone" | "done";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [dob, setDob] = useState("");
  const [terms, setTerms] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [requirePhone, setRequirePhone] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login?next=/onboarding");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, gender, dob, onboarding_completed_at, phone_verified_at")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.onboarding_completed_at) {
        router.replace("/app");
        return;
      }
      if (profile?.name) setName(profile.name);
      if (profile?.gender) setGender(profile.gender as Gender);
      if (profile?.dob) setDob(profile.dob);

      try {
        const res = await fetch("/api/access");
        if (res.ok) {
          const access = await res.json();
          setRequirePhone(Boolean(access.require_phone_verification));
        }
      } catch {
        /* use default */
      }
      setReady(true);
    })();
  }, [router]);

  async function patchOnboarding(body: Record<string, unknown>) {
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Update failed");
    return data;
  }

  function nextFromName() {
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    startTransition(async () => {
      try {
        await patchOnboarding({ name: name.trim() });
        setStep("gender");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function nextFromGender() {
    setError(null);
    if (!gender) {
      setError("Please select your gender");
      return;
    }
    startTransition(async () => {
      try {
        await patchOnboarding({ gender });
        setStep("dob");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function nextFromDob() {
    setError(null);
    if (!dob) {
      setError("Please enter your date of birth");
      return;
    }
    if (!isAtLeast18(dob)) {
      setError("You must be 18 or older to use TaraWorld.");
      return;
    }
    startTransition(async () => {
      try {
        await patchOnboarding({ dob, age_confirmed: true });
        setStep("terms");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function nextFromTerms() {
    setError(null);
    if (!terms) {
      setError("Please accept Terms & Privacy to continue");
      return;
    }
    startTransition(async () => {
      try {
        await patchOnboarding({
          terms_accepted: true,
          age_confirmed: true,
          ...(requirePhone ? {} : { complete: true }),
        });
        if (requirePhone) {
          setStep("phone");
        } else {
          setStep("done");
          router.replace("/app");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function sendPhoneOtp() {
    setError(null);
    if (!phone.trim()) {
      setError("Enter your mobile number");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phone.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to send OTP");
        setOtpSent(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send OTP");
      }
    });
  }

  function verifyPhoneOtp() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phone.trim(), code: otp.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Invalid OTP");
        await patchOnboarding({ complete: true });
        setStep("done");
        router.replace("/app");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verification failed");
      }
    });
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const under18Blocked = Boolean(dob && !isAtLeast18(dob));

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--rose-glow),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_var(--hero-glow),_transparent_50%)]"
      />

      <div className="relative z-10 w-full max-w-md">
        <p className="mb-6 text-center font-display text-3xl tracking-tight">
          TaraWorld
        </p>

        <div className="rounded-[1.75rem] border border-glass-border bg-glass p-7 shadow-2xl backdrop-blur-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.28 }}
              className="space-y-6"
            >
              {step === "name" && (
                <>
                  <Header
                    title="What should we call you?"
                    subtitle="Your companions will use this name."
                  />
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your first name"
                      autoFocus
                      disabled={pending}
                    />
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={nextFromName}
                    disabled={pending}
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Continue
                  </Button>
                </>
              )}

              {step === "gender" && (
                <>
                  <Header
                    title="How do you identify?"
                    subtitle="We match companions thoughtfully."
                  />
                  <div className="grid gap-2">
                    {GENDERS.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setGender(g.value)}
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-left text-sm transition",
                          gender === g.value
                            ? "border-accent bg-accent/15 text-foreground"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        )}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={nextFromGender}
                    disabled={pending || !gender}
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Continue
                  </Button>
                </>
              )}

              {step === "dob" && (
                <>
                  <Header
                    title="When were you born?"
                    subtitle="TaraWorld is 18+ only."
                  />
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      disabled={pending}
                      max={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  {under18Blocked ? (
                    <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                      You must be 18 or older. We cannot create an account for
                      minors.
                    </p>
                  ) : null}
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={nextFromDob}
                    disabled={pending || under18Blocked || !dob}
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Continue
                  </Button>
                </>
              )}

              {step === "terms" && (
                <>
                  <Header
                    title="Almost there"
                    subtitle="Please accept our policies."
                  />
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                    />
                    <span>
                      I am 18+, and I accept the{" "}
                      <a
                        href="/legal/terms"
                        target="_blank"
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a
                        href="/legal/privacy"
                        target="_blank"
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        Privacy Policy
                      </a>
                      .
                    </span>
                  </label>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={nextFromTerms}
                    disabled={pending || !terms}
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Accept & continue
                  </Button>
                </>
              )}

              {step === "phone" && (
                <>
                  <Header
                    title="Verify your phone"
                    subtitle="One trial per number. Helps keep the community safe."
                  />
                  {!otpSent ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Mobile (India +91)</Label>
                        <Input
                          id="phone"
                          inputMode="tel"
                          placeholder="9876543210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          disabled={pending}
                        />
                      </div>
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={sendPhoneOtp}
                        disabled={pending}
                      >
                        {pending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Send OTP
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="otp">OTP</Label>
                        <Input
                          id="otp"
                          inputMode="numeric"
                          placeholder="6-digit code"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          disabled={pending}
                          className="tracking-[0.3em] text-center"
                        />
                      </div>
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={verifyPhoneOtp}
                        disabled={pending || otp.trim().length < 4}
                      >
                        {pending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Verify & finish
                      </Button>
                      <button
                        type="button"
                        className="w-full text-xs text-muted-foreground"
                        onClick={() => {
                          setOtpSent(false);
                          setOtp("");
                        }}
                      >
                        Change number
                      </button>
                    </>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {error ? (
            <p className="mt-4 text-center text-sm text-danger">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
