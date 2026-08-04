import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { applySecurityHeaders } from "@/lib/security/headers";
import { clientIp, isIpBlocked } from "@/lib/security/guard";

const protectedPaths = ["/account", "/checkout"];
const authPaths = ["/auth/login", "/auth/register", "/auth/forgot-password"];

// Paths that never need SEO redirect lookups
const SKIP_REDIRECT = /^\/(?:_next|api|admin|favicon|robots\.txt|sitemap\.xml|.*\.\w+$)/;

// Canonical host — every other spelling (www, the old double-s / plural
// variants) is 301-redirected here so engines index a single origin.
// Unknown hosts (localhost, o2switch preview, IPs) are left untouched.
const CANONICAL_HOST = "atlantasneaker.com";
const NON_CANONICAL_HOSTS = new Set([
  "www.atlantasneaker.com",
  "atlantasneakers.com",
  "www.atlantasneakers.com",
  "atlantassneakers.com",
  "www.atlantassneakers.com",
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0a) Canonical-host redirect (www / plural / double-s → canonical).
  const host = (request.headers.get("host") || "").toLowerCase().split(":")[0];
  if (NON_CANONICAL_HOSTS.has(host)) {
    const url = request.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }

  // 0) IP blocklist enforcement (cached; enforced at the edge). Never crash on error.
  try {
    const ip = clientIp(request);
    if (ip && (await isIpBlocked(ip))) {
      return applySecurityHeaders(new NextResponse("Forbidden", { status: 403 }));
    }
  } catch { /* fail-open on lookup error, headers still applied below */ }

  // 1) SEO redirect manager (301/302/307/410) — applied before anything else
  if (!SKIP_REDIRECT.test(pathname)) {
    try {
      const anon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );
      const { data: redirect } = await anon
        .from("seo_redirects")
        .select("to_path, redirect_type")
        .eq("from_path", pathname)
        .eq("is_active", true)
        .maybeSingle();

      if (redirect) {
        anon.rpc("increment_redirect_hits", { p_from: pathname }).then(() => {}, () => {});
        if (redirect.redirect_type === 410) {
          return new NextResponse("Gone", { status: 410 });
        }
        if (redirect.to_path) {
          const url = redirect.to_path.startsWith("http")
            ? redirect.to_path
            : new URL(redirect.to_path, request.url).toString();
          return NextResponse.redirect(url, redirect.redirect_type || 301);
        }
      }
    } catch { /* never block on redirect lookup failure */ }
  }

  // 2) Auth handling only matters on protected/auth routes
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isAuthPage = authPaths.some((p) => pathname.startsWith(p));
  if (!isProtected && !isAuthPage) {
    return applySecurityHeaders(NextResponse.next());
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return applySecurityHeaders(response);
}

export const config = {
  // Broadened to let SEO redirects run on page routes, excluding assets/api/admin
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|admin).*)"],
};
