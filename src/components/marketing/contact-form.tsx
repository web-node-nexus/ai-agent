"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ContactForm() {
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setPending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not send message. Try again.");
        return;
      }
      toast.success("Message sent — we’ll get back soon.");
      form.reset();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required maxLength={80} placeholder="Your name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          maxLength={120}
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          placeholder="Kaise help kar sakte hain?"
          className="flex w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-foreground shadow-inner placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
