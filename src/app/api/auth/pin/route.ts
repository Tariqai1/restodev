import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getStaffPermissions } from "@/lib/platform/state";

export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const restoQuery = searchParams.get("resto")?.trim();

    let restaurant: { id: string; name: string } | null = null;

    // 1. Direct match by ?resto= query param (ID or Name)
    if (restoQuery) {
      // Check if UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restoQuery);
      if (isUuid) {
        const { data } = await admin
          .from("restaurants")
          .select("id, name")
          .eq("id", restoQuery)
          .maybeSingle();
        restaurant = data;
      }
      if (!restaurant) {
        const { data } = await admin
          .from("restaurants")
          .select("id, name")
          .ilike("name", restoQuery)
          .maybeSingle();
        restaurant = data;
      }
    }

    // 2. Check if restaurant is specified in cookies
    if (!restaurant) {
      const cookieStore = await cookies();
      const activeStaffCookie = cookieStore.get("od_active_staff")?.value;
      let targetRestaurantId: string | null = null;

      if (activeStaffCookie) {
        try {
          const parsed = JSON.parse(activeStaffCookie);
          targetRestaurantId = parsed.restaurant_id || null;
        } catch {
          // ignore
        }
      }

      if (targetRestaurantId) {
        const { data } = await admin
          .from("restaurants")
          .select("id, name")
          .eq("id", targetRestaurantId)
          .maybeSingle();
        restaurant = data;
      }
    }

    // 3. If no cookie or param, resolve the restaurant that has active staff
    if (!restaurant) {
      const { data: staffWithResto } = await admin
        .from("staff_users")
        .select("restaurant_id, restaurants(id, name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (staffWithResto?.restaurants) {
        restaurant = Array.isArray(staffWithResto.restaurants)
          ? (staffWithResto.restaurants[0] as unknown as { id: string; name: string })
          : (staffWithResto.restaurants as unknown as { id: string; name: string });
      } else if (staffWithResto?.restaurant_id) {
        const { data: rData } = await admin
          .from("restaurants")
          .select("id, name")
          .eq("id", staffWithResto.restaurant_id)
          .maybeSingle();
        restaurant = rData;
      }
    }

    // 4. Fallback to most recently created restaurant
    if (!restaurant) {
      const { data } = await admin
        .from("restaurants")
        .select("id, name")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      restaurant = data;
    }

    if (!restaurant) {
      return NextResponse.json({ ok: false, staff: [], restaurantName: "Order Desk" });
    }

    // Fetch active staff roster for this restaurant
    const { data: staff, error } = await admin
      .from("staff_users")
      .select("id, name, role")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name || "Order Desk",
      staff: (staff || []).map((s) => {
        const perms = getStaffPermissions(s.id, s.role);
        return {
          ...s,
          role: perms.assignedRole || (s.role === "staff" ? "waiter" : s.role),
        };
      }),
    });
  } catch (error) {
    console.error("Staff roster fetch error:", error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to load staff" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown-ip";

    // Rate Limiting: Max 5 attempts per IP per 5 minutes
    const rateLimitKey = `pin-auth:${ip}`;
    const rateCheck = checkRateLimit(rateLimitKey, 5, 5 * 60 * 1000);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { message: "Too many incorrect attempts. Terminal locked for 5 minutes." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const staffId = body.staffId?.trim();
    const pin = body.pin?.trim();
    const explicitRestoId = body.restaurantId?.trim();

    if (!pin || pin.length !== 4) {
      return NextResponse.json({ message: "4-digit PIN is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    let matchedStaff: {
      id: string;
      name: string;
      role: string;
      restaurant_id: string;
      pin_hash: string;
    } | null = null;

    // 1. If a specific staffId was provided, check them first
    if (staffId) {
      const { data: staffMember } = await admin
        .from("staff_users")
        .select("id, name, role, restaurant_id, pin_hash, is_active")
        .eq("id", staffId)
        .maybeSingle();

      if (staffMember && staffMember.is_active && staffMember.pin_hash) {
        const isMatch = await bcrypt.compare(pin, staffMember.pin_hash).catch(() => false);
        if (isMatch) {
          matchedStaff = staffMember;
        }
      }
    }

    // 2. Fallback: match PIN against all active staff in the restaurant (or across all active staff)
    if (!matchedStaff) {
      let targetRestoId: string | null = explicitRestoId || null;
      if (!targetRestoId) {
        const cookieStore = await cookies();
        const activeStaffCookie = cookieStore.get("od_active_staff")?.value;
        if (activeStaffCookie) {
          try {
            const parsed = JSON.parse(activeStaffCookie);
            targetRestoId = parsed.restaurant_id || null;
          } catch {
            // ignore
          }
        }
      }

      // First check within the target restaurant if known
      if (targetRestoId) {
        const { data: restoStaff } = await admin
          .from("staff_users")
          .select("id, name, role, restaurant_id, pin_hash")
          .eq("restaurant_id", targetRestoId)
          .eq("is_active", true);

        if (restoStaff && restoStaff.length > 0) {
          for (const s of restoStaff) {
            if (s.pin_hash) {
              const ok = await bcrypt.compare(pin, s.pin_hash).catch(() => false);
              if (ok) {
                matchedStaff = s;
                break;
              }
            }
          }
        }
      }

      // If still not matched, check ALL active staff across the platform
      if (!matchedStaff) {
        const { data: allActiveStaff } = await admin
          .from("staff_users")
          .select("id, name, role, restaurant_id, pin_hash")
          .eq("is_active", true);

        if (allActiveStaff && allActiveStaff.length > 0) {
          for (const s of allActiveStaff) {
            if (s.pin_hash) {
              const ok = await bcrypt.compare(pin, s.pin_hash).catch(() => false);
              if (ok) {
                matchedStaff = s;
                break;
              }
            }
          }
        }
      }
    }

    if (!matchedStaff) {
      return NextResponse.json({ message: "Incorrect PIN. Please try again." }, { status: 401 });
    }

    // Retrieve restaurant owner email to establish Supabase session
    const { data: restaurant } = await admin
      .from("restaurants")
      .select("owner_email")
      .eq("id", matchedStaff.restaurant_id)
      .single();

    if (!restaurant?.owner_email) {
      return NextResponse.json({ message: "Restaurant account configuration error" }, { status: 500 });
    }

    // Generate authenticated Supabase session using magiclink OTP
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: restaurant.owner_email,
    });

    if (linkError || !linkData.properties?.hashed_token) {
      return NextResponse.json({ message: "Session generation failed" }, { status: 500 });
    }

    const supabase = await createClient();
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "email",
    });

    if (otpError) {
      console.error("Supabase OTP verify error:", otpError);
      return NextResponse.json({ message: "Failed to establish terminal session" }, { status: 500 });
    }

    const rawRole = (matchedStaff.role === "staff" ? "waiter" : matchedStaff.role || "").toLowerCase();
    const permissions = getStaffPermissions(matchedStaff.id, rawRole);
    const effectiveRole = (permissions.assignedRole || rawRole).toLowerCase();
    const redirectPath =
      effectiveRole === "kitchen" || effectiveRole === "chef" || effectiveRole === "cook"
        ? "/kitchen"
        : effectiveRole === "waiter" || effectiveRole === "captain" || effectiveRole === "server"
        ? "/waiter"
        : effectiveRole === "rider" || effectiveRole === "delivery" || effectiveRole === "driver"
        ? "/delivery"
        : "/admin";

    // Save active staff identity in cookie with secure attributes
    const cookieStore = await cookies();
    cookieStore.set(
      "od_active_staff",
      JSON.stringify({
        id: matchedStaff.id,
        name: matchedStaff.name,
        role: effectiveRole,
        restaurant_id: matchedStaff.restaurant_id,
        permissions,
      }),
      {
        path: "/",
        maxAge: 60 * 60 * 24, // 24 hours
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      }
    );

    return NextResponse.json({
      ok: true,
      message: `Welcome, ${matchedStaff.name}!`,
      redirect: redirectPath,
      staff: {
        id: matchedStaff.id,
        name: matchedStaff.name,
        role: effectiveRole,
        permissions,
      },
    });
  } catch (error) {
    console.error("PIN authentication error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Authentication error" },
      { status: 500 }
    );
  }
}
