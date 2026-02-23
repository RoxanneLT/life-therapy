import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_OPTIONS,
  ADMIN_INACTIVITY_SECONDS,
  ADMIN_ACTIVITY_COOKIE,
} from "./config";
import {
  getRegionFromHostname,
  REGION_CONFIG,
  isValidCurrency,
  LT_REGION_COOKIE,
  LT_CURRENCY_COOKIE,
} from "@/lib/region";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // ── Region & Currency Detection ──────────────────────────
  const hostname = request.headers.get("host") || "";
  const forceRegion = process.env.NEXT_PUBLIC_FORCE_REGION;
  const region =
    forceRegion === "int"
      ? "int"
      : forceRegion === "za"
        ? "za"
        : getRegionFromHostname(hostname);

  const regionConfig = REGION_CONFIG[region];

  const existingCurrency = request.cookies.get(LT_CURRENCY_COOKIE)?.value;
  const currency =
    existingCurrency && isValidCurrency(existingCurrency)
      ? existingCurrency
      : regionConfig.defaultCurrency;

  const existingRegion = request.cookies.get(LT_REGION_COOKIE)?.value;
  const needsRegionCookie = existingRegion !== region;
  const needsCurrencyCookie =
    !existingCurrency || !isValidCurrency(existingCurrency);

  // ── Supabase Auth ────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: COOKIE_OPTIONS,
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
    }
  );

  // Refresh the session — this keeps the auth token alive
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // ── Admin inactivity check ───────────────────────────────
  // The lt-admin-active cookie is ONLY refreshed on /admin routes, so
  // browsing the public site does NOT reset the admin idle timer.
  if (user && pathname.startsWith("/admin")) {
    const now = Date.now();
    const activeUntilStr = request.cookies.get(ADMIN_ACTIVITY_COOKIE)?.value;

    if (activeUntilStr && Number.parseInt(activeUntilStr, 10) < now) {
      // Cookie expired — admin was idle too long, force sign-out
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "admin_idle");
      const response = NextResponse.redirect(url);
      request.cookies
        .getAll()
        .filter((c) => c.name.startsWith("sb-"))
        .forEach((c) => response.cookies.delete(c.name));
      response.cookies.delete(ADMIN_ACTIVITY_COOKIE);
      return response;
    }

    // Set or refresh the admin activity cookie
    supabaseResponse.cookies.set(
      ADMIN_ACTIVITY_COOKIE,
      String(now + ADMIN_INACTIVITY_SECONDS * 1000),
      {
        maxAge: ADMIN_INACTIVITY_SECONDS,
        path: "/admin",
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
      }
    );
  }

  // ── Redirect old login pages to unified /login ───────────
  if (pathname === "/admin/login" || pathname === "/portal/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ── Authenticated users visiting /login → send to /portal ─
  // (Portal layout redirects admins to /admin based on DB role)
  if (
    user &&
    (pathname === "/login" ||
      pathname.startsWith("/portal/register"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/portal";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // ── Protected routes — redirect to login if unauthenticated ─
  if (
    !user &&
    (pathname.startsWith("/admin") || pathname.startsWith("/portal"))
  ) {
    // Allow public portal auth pages
    if (
      pathname.startsWith("/portal/register") ||
      pathname.startsWith("/portal/change-password")
    ) {
      // Fall through — these are public
    } else {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Role-based routing is handled by layouts (not middleware)
  // to avoid JWT/DB role disagreements causing redirect loops.
  // See: app/(admin)/admin/(dashboard)/layout.tsx
  // See: app/(portal)/portal/(dashboard)/layout.tsx

  // ── Set Region/Currency Cookies ──────────────────────────
  if (needsRegionCookie) {
    supabaseResponse.cookies.set(LT_REGION_COOKIE, region, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  if (needsCurrencyCookie) {
    supabaseResponse.cookies.set(LT_CURRENCY_COOKIE, currency, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return supabaseResponse;
}
