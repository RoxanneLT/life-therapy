import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getRegionFromHostname,
  REGION_CONFIG,
  isValidCurrency,
  LT_REGION_COOKIE,
  LT_CURRENCY_COOKIE,
} from "@/lib/region";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // ── Region & Currency Detection ──────────────────────────
  const hostname = request.headers.get("host") || "";
  const forceRegion = process.env.NEXT_PUBLIC_FORCE_REGION;
  const region =
    forceRegion === "int" ? "int" :
    forceRegion === "za" ? "za" :
    getRegionFromHostname(hostname);

  const regionConfig = REGION_CONFIG[region];

  // Read existing currency cookie or use default for region
  const existingCurrency = request.cookies.get(LT_CURRENCY_COOKIE)?.value;
  const currency =
    existingCurrency && isValidCurrency(existingCurrency)
      ? existingCurrency
      : regionConfig.defaultCurrency;

  // Set cookies if not present (or if region changed)
  const existingRegion = request.cookies.get(LT_REGION_COOKIE)?.value;
  const needsRegionCookie = existingRegion !== region;
  const needsCurrencyCookie = !existingCurrency || !isValidCurrency(existingCurrency);

  // ── Supabase Auth ────────────────────────────────────────
  // Only run Supabase auth checks on admin/portal routes
  const pathname = request.nextUrl.pathname;
  const needsAuth =
    pathname.startsWith("/admin") || pathname.startsWith("/portal");

  let user = null;
  if (needsAuth) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
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

    const { data } = await supabase.auth.getUser();
    user = data.user;

    // Protect all /admin routes except the login page
    if (
      pathname.startsWith("/admin") &&
      !pathname.startsWith("/admin/login")
    ) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/login";
        return NextResponse.redirect(url);
      }
    }

    // Redirect authenticated admin users away from admin login
    if (pathname === "/admin/login" && user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // Protect portal dashboard routes
    if (
      pathname.startsWith("/portal") &&
      !pathname.startsWith("/portal/login") &&
      !pathname.startsWith("/portal/register") &&
      !pathname.startsWith("/portal/change-password")
    ) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/portal/login";
        return NextResponse.redirect(url);
      }
    }
  }

  // ── Set Region/Currency Cookies ──────────────────────────
  if (needsRegionCookie) {
    supabaseResponse.cookies.set(LT_REGION_COOKIE, region, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
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

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
