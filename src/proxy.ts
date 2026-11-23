import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSuperAdminEmails } from "@/lib/auth/super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

async function isAuthorizedSuperAdmin(user: { id: string; email?: string | null } | null) {
  if (!user) return false;
  const email = user.email?.trim().toLowerCase();
  if (email && getSuperAdminEmails().includes(email)) return true;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("super_admins")
      .select("id")
      .or(`email.eq.${email || ""},auth_user_id.eq.${user.id}`)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;

  // FAST PATH: Never intercept Next.js internal paths (HMR, chunks, telemetry) or WebSocket upgrades
  if (
    pathname.startsWith("/_next") ||
    pathname.includes("/hmr") ||
    request.headers.get("upgrade")?.toLowerCase() === "websocket"
  ) {
    return response;
  }

  const isLoginPage = pathname === "/login";
  const isSuperAdminLoginPage = pathname === "/super-admin/login";
  const isSetupPage = pathname === "/setup";
  const isEnterPage = pathname === "/enter";
  const isCustomerTableRoute = pathname.startsWith("/table/");
  const isCustomerOnlineRoute = pathname.startsWith("/r/");
  const isPublicApi =
    pathname === "/api/health" ||
    pathname === "/api/setup" ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/ai/");
  const isApiRoute = pathname.startsWith("/api/");
  const isSuperAdminRoute = pathname.startsWith("/super-admin");
  const isSuperAdminDashboard = isSuperAdminRoute && !isSuperAdminLoginPage;

  // Check if any Supabase authentication cookies exist
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.includes("auth-token") || c.name.startsWith("sb-"));

  // FAST PATH: If route is purely public (guest APIs, table QR, online store, setup), bypass auth call entirely
  if (isPublicApi || isSetupPage || isEnterPage || isCustomerTableRoute || isCustomerOnlineRoute) {
    return response;
  }

  // FAST PATH: If visiting login pages without any session cookie, allow immediately
  if ((isLoginPage || isSuperAdminLoginPage) && !hasAuthCookie) {
    return response;
  }

  // FAST PATH: If route is protected but user has no auth cookie at all, reject/redirect immediately without blocking
  if (!hasAuthCookie) {
    if (isApiRoute) {
      return NextResponse.json(
        { ok: false, authenticated: false, message: "Staff authentication required" },
        { status: 401 }
      );
    }
    if (isSuperAdminRoute) {
      return NextResponse.redirect(new URL("/super-admin/login", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // User has auth cookie: instantiate Supabase client safely
  let user: { id: string; email?: string | null } | null = null;
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const userRes = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null }; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("Auth timeout")), 3500)
      ),
    ]);
    user = userRes.data.user;
  } catch {
    user = null;
  }

  const isSuperAdmin = await isAuthorizedSuperAdmin(user);

  if (!user) {
    if (isLoginPage || isSuperAdminLoginPage) {
      return response;
    }

    if (isApiRoute) {
      return NextResponse.json(
        { ok: false, authenticated: false, message: "Staff authentication required" },
        { status: 401 }
      );
    }

    if (isSuperAdminRoute) {
      return NextResponse.redirect(new URL("/super-admin/login", request.url));
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If already authenticated as Super Admin and visiting super admin login, redirect to deck
  if (user && isSuperAdminLoginPage) {
    if (isSuperAdmin) {
      return NextResponse.redirect(new URL("/super-admin", request.url));
    }
  }

  // Prevent non-super-admins from accessing the Super Admin command deck directly
  if (user && isSuperAdminDashboard) {
    if (!isSuperAdmin) {
      return NextResponse.redirect(new URL("/super-admin/login", request.url));
    }
  }

  // Parse active staff role
  const activeStaffCookie = request.cookies.get("od_active_staff")?.value;
  let activeRole = "";
  if (activeStaffCookie) {
    try {
      const parsed = JSON.parse(activeStaffCookie);
      const rawRole = (parsed.role || "").toLowerCase();
      activeRole = rawRole === "staff" ? "waiter" : rawRole;
    } catch {
      // ignore
    }
  }

  // 1. Kitchen Role Strict Isolation: Kitchen staff can ONLY access /kitchen
  if (activeRole === "kitchen") {
    const isKitchenPage = request.nextUrl.pathname === "/kitchen";
    if (!isKitchenPage && !isApiRoute && !isLoginPage) {
      return NextResponse.redirect(new URL("/kitchen", request.url));
    }
  }

  // 2. Waiter Role Strict Isolation: Waiters can ONLY access /waiter (never full POS /admin)
  if (activeRole === "waiter") {
    const isWaiterPage = request.nextUrl.pathname === "/waiter";
    if (!isWaiterPage && !isApiRoute && !isLoginPage && !isCustomerTableRoute && !isCustomerOnlineRoute) {
      return NextResponse.redirect(new URL("/waiter", request.url));
    }
  }

  // 3. Staff Management Role Guard: Only Owner and Manager can access /staff
  if (request.nextUrl.pathname.startsWith("/staff")) {
    if (!isSuperAdmin && activeRole && activeRole !== "owner" && activeRole !== "manager" && activeRole !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|css|js)$).*)",
  ],
};