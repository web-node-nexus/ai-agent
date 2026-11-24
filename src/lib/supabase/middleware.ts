import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  const isApp = path.startsWith("/app");
  const isAdmin = path.startsWith("/admin");
  const isOnboarding = path.startsWith("/onboarding");
  const isAuth = path.startsWith("/login") || path.startsWith("/auth");
  const isProtected = isApp || isAdmin || isOnboarding;

  // Never crash public navigation if env is missing — login/home must stay clickable.
  if (!url || !key) {
    console.error(
      "[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Restart `npm run dev` after editing .env.local."
    );
    if (isProtected) {
      const login = request.nextUrl.clone();
      login.pathname = "/login";
      login.searchParams.set("next", path);
      login.searchParams.set("error", "config");
      return NextResponse.redirect(login);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (isApp || isAdmin || isOnboarding)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "onboarding_completed_at, phone_verified_at, is_banned, role, age_confirmed_at"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_banned) {
      const banned = request.nextUrl.clone();
      banned.pathname = "/banned";
      return NextResponse.redirect(banned);
    }

    if (
      !isOnboarding &&
      !isAuth &&
      path !== "/banned" &&
      profile &&
      !profile.onboarding_completed_at
    ) {
      const onboarding = request.nextUrl.clone();
      onboarding.pathname = "/onboarding";
      return NextResponse.redirect(onboarding);
    }

    if (isOnboarding && profile?.onboarding_completed_at) {
      const app = request.nextUrl.clone();
      app.pathname = "/app";
      return NextResponse.redirect(app);
    }

    if (isAdmin && profile?.role !== "admin") {
      const app = request.nextUrl.clone();
      app.pathname = "/app";
      return NextResponse.redirect(app);
    }
  }

  if (user && isAuth && !path.startsWith("/auth/callback")) {
    // Fresh logins go to onboarding if incomplete; middleware on /app will redirect.
    const dest = request.nextUrl.clone();
    dest.pathname = "/app";
    return NextResponse.redirect(dest);
  }

  return supabaseResponse;
}
