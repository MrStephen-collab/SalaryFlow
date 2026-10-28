import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes that don't require auth
  const publicRoutes = ["/", "/auth/login", "/auth/register", "/auth/callback"];
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith("/auth/")
  );

  // Protected routes that require auth
  const protectedPrefixes = ["/dashboard", "/employee", "/super-admin", "/onboarding"];
  const isProtectedRoute = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isPublicRoute && user && pathname !== "/") {
    // Route by role after login
    const { data: isEmployee } = await supabase.rpc("user_has_role", {
      required_role: "EMPLOYEE",
    });
    const url = request.nextUrl.clone();
    url.pathname = isEmployee ? "/employee" : "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: isEmployee } = await supabase.rpc("user_has_role", {
      required_role: "EMPLOYEE",
    });

    // Block EMPLOYEE users from admin/super-admin areas
    if (
      isEmployee &&
      (pathname.startsWith("/dashboard") || pathname.startsWith("/super-admin"))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/employee";
      return NextResponse.redirect(url);
    }

    // Block non-EMPLOYEE users from the employee portal
    if (!isEmployee && pathname.startsWith("/employee")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
