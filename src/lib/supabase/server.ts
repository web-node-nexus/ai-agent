import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function isProductionBuild() {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  );
}

function requirePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Vercel/CI build must not crash when env is only set for Runtime.
    // Real requests still need real keys (middleware redirects if missing).
    if (isProductionBuild()) {
      return {
        url: "https://placeholder.supabase.co",
        key: "public-anon-key-placeholder-for-build",
      };
    }
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return { url, key };
}

export async function createClient() {
  const { url, key } = requirePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — middleware will refresh sessions.
        }
      },
    },
  });
}

/** Service role — server only. Never import in client components. */
export function createServiceClient() {
  const { url } = requirePublicEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    if (isProductionBuild()) {
      return createSupabaseClient(
        url,
        "service-role-key-placeholder-for-build",
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
    }
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — required for wallet/chat/admin server routes"
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
