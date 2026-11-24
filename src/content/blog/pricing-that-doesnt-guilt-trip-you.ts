import type { BlogPost } from "./types";

const post: BlogPost = {
  slug: "pricing-that-doesnt-guilt-trip-you",
  title: "Pricing that doesn’t guilt-trip you",
  description:
    "Trial, ₹49/₹149 chat plans, 20 paise/min video, ₹3 images — and why AIs are banned from nagging you to pay.",
  date: "2026-11-10",
  readingMinutes: 3,
  tags: ["pricing", "trust"],
  content: `
## Paywalls belong in the UI

Nothing kills trust faster than a companion that sighs about unpaid bills. Our models are forbidden from guilt-trips, jealousy-pressure, or “I’ll leave if you don’t recharge.”

You see clear numbers instead: a short free trial, weekly/monthly chat plans, and a wallet for video (20 paise/min) and images (₹3). Packs start at ₹49. GST is inclusive on the sticker price.

## Control stays with you

Cancel renewals. Top up only when you want voice or images. Read the full breakdown on [Pricing](/pricing) and the [Refund policy](/refund-policy) if something goes wrong at checkout.
`.trim(),
};

export default post;
