import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import { getRestaurantUpsellConfig, setRestaurantUpsellConfig, DEFAULT_UPSELL_CONFIG } from "@/lib/platform/state";
import type { SmartUpsellConfig } from "@/lib/types/offers";

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

    if (resto?.gstin?.startsWith("{")) {
      try {
        const meta = JSON.parse(resto.gstin);
        if (meta.upsellConfig) {
          return NextResponse.json({ ok: true, upsellConfig: { ...DEFAULT_UPSELL_CONFIG, ...meta.upsellConfig } });
        }
      } catch {}
    }

    const upsellConfig = getRestaurantUpsellConfig(staffContext.restaurantId);
    return NextResponse.json({ ok: true, upsellConfig });
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

    // Role check: Only Owner, Manager, or Admin can configure
    const allowedRoles = ["owner", "manager", "admin"];
    if (staffContext.role && !allowedRoles.includes(staffContext.role.toLowerCase())) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized. Manager or Owner role required to configure upsell." },
        { status: 403 }
      );
    }

    const currentConfig = getRestaurantUpsellConfig(staffContext.restaurantId);

    // Super Admin Delegation Check: Has Super Admin permitted owner configuration?
    if (currentConfig.ownerCanManageUpsell === false) {
      return NextResponse.json(
        {
          ok: false,
          message: "Smart Upsell settings are locked and centrally enforced by Platform Super Admin.",
        },
        { status: 403 }
      );
    }

    const body = (await req.json()) as Partial<SmartUpsellConfig>;
    
    // Prevent the owner from overriding the super admin delegation flag
    delete body.ownerCanManageUpsell;

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

    const existingUpsell = (meta.upsellConfig as Partial<SmartUpsellConfig>) || {};
    const updatedUpsell: SmartUpsellConfig = {
      ...DEFAULT_UPSELL_CONFIG,
      ...existingUpsell,
      ...body,
    };
    meta.upsellConfig = updatedUpsell;

    await admin
      .from("restaurants")
      .update({ gstin: JSON.stringify(meta) })
      .eq("id", staffContext.restaurantId);

    const updated = setRestaurantUpsellConfig(staffContext.restaurantId, body);
    return NextResponse.json({
      ok: true,
      message: "Smart Upsell settings updated successfully",
      upsellConfig: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
