import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { absoluteUrl } from "@/lib/utils";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  title: {
    default: "TaraWorld — Make new friends online",
    template: "%s · TaraWorld",
  },
  description:
    "Meet new friends for warm chat and voice calls. Soft, respectful, 18+. Try 3 minutes free.",
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "TaraWorld",
    title: "TaraWorld — Make new friends online",
    description:
      "A softer place to talk, laugh, and feel heard. Built for new friendships in India.",
    images: [
      {
        url: "/marketing/friends-cafe.jpg",
        width: 1200,
        height: 675,
        alt: "TaraWorld — new friends",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TaraWorld — Make new friends",
    description: "Warm chat, soft vibes, voice calls. 18+ and PG-13.",
    images: ["/marketing/friends-cafe.jpg"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${fraunces.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
