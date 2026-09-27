import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import {
  getRestaurantFeatures,
  setRestaurantFeatures,
  RestaurantFeatures,
  DEFAULT_RESTAURANT_FEATURES,
} from "@/lib/platform/state";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Authentication required" }, { status: 401 });
    }

    const staffContext = await resolveStaffContext(user);
    if (!staffContext) {
      return NextResponse.json({ ok: false, message: "Staff record not found" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: resto } = await admin
      .from("restaurants")
      .select("gstin")
      .eq("id", staffContext.restaurantId)
      .maybeSingle();

    let dbFeatures: Partial<RestaurantFeatures> | null = null;
    if (resto?.gstin?.startsWith("{")) {
      try {
        const meta = JSON.parse(resto.gstin);
        if (meta.features) dbFeatures = meta.features;
      } catch {}
    }

    const features = dbFeatures
      ? { ...DEFAULT_RESTAURANT_FEATURES, ...dbFeatures }
      : getRestaurantFeatures(staffContext.restaurantId);

    return NextResponse.json({ ok: true, features });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Authentication required" }, { status: 401 });
    }

    const staffContext = await resolveStaffContext(user);
    if (!staffContext) {
      return NextResponse.json({ ok: false, message: "Staff record not found" }, { status: 403 });
    }

    const allowedRoles = ["owner", "manager", "admin"];
    if (staffContext.role && !allowedRoles.includes(staffContext.role.toLowerCase())) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized. Manager or Owner role required to configure features." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const partialFeatures = body as Partial<RestaurantFeatures>;

    const admin = createAdminClient();
    const { data: currentResto } = await admin
      .from("restaurants")
      .select("gstin")
      .eq("id", staffContext.restaurantId)
      .maybeSingle();

    let meta: Record<string, unknown> = {};
    const rawGstin = currentResto?.gstin || "";
    if (rawGstin.startsWith("{") && rawGstin.endsWith("}")) {
      try {
        meta = JSON.parse(rawGstin);
      } catch {}
    } else if (rawGstin) {
      meta.gstin_number = rawGstin;
    }

    const existingFeatures = (meta.features as Partial<RestaurantFeatures>) || {};
    const updated: RestaurantFeatures = {
      ...DEFAULT_RESTAURANT_FEATURES,
      ...existingFeatures,
      ...partialFeatures,
    };

    meta.features = updated;

    await admin
      .from("restaurants")
      .update({ gstin: JSON.stringify(meta) })
      .eq("id", staffContext.restaurantId);

    // Also update in-memory fallback
    setRestaurantFeatures(staffContext.restaurantId, updated);

    return NextResponse.json({ ok: true, features: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
