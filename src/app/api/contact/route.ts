import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120),
  message: z.string().trim().min(10).max(2000),
});

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const limited = await rateLimit("contact", ip);
  if (!limited.success) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a minute." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check name, email, and message." },
      { status: 400 }
    );
  }

  const { name, email, message } = parsed.data;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("contact_messages").insert({
      name,
      email,
      message,
    });

    if (error) {
      console.error("[contact]", error.message);
      return NextResponse.json(
        { error: "Could not save your message. Try again later." },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[contact]", err);
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
