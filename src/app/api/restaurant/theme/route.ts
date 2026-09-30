import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import {
  getRestaurantTheme,
  setRestaurantTheme,
  getRestaurantBranding,
  setRestaurantBranding,
  RestaurantThemeType,
  RestaurantBrandingConfig,
  DEFAULT_BRANDING_CONFIG,
} from "@/lib/platform/state";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 });
    }

    const staffContext = await resolveStaffContext(user);
    if (!staffContext) {
      return NextResponse.json({ message: "Staff record not found" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: resto } = await admin
      .from("restaurants")
      .select("gstin, name")
      .eq("id", staffContext.restaurantId)
      .maybeSingle();

    let metaTheme: RestaurantThemeType | null = null;
    let metaBranding: RestaurantBrandingConfig | null = null;

    if (resto?.gstin?.startsWith("{")) {
      try {
        const meta = JSON.parse(resto.gstin);
        if (meta.theme) metaTheme = meta.theme;
        if (meta.branding) metaBranding = meta.branding;
      } catch {}
    }

    const theme = metaTheme || getRestaurantTheme(staffContext.restaurantId);
    const branding = metaBranding || getRestaurantBranding(staffContext.restaurantId);

    return NextResponse.json({ ok: true, theme, branding, restaurantName: resto?.name || "" });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Internal error" },
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
      return NextResponse.json({ message: "Authentication required" }, { status: 401 });
    }

    const staffContext = await resolveStaffContext(user);
    if (!staffContext) {
      return NextResponse.json({ message: "Staff record not found" }, { status: 403 });
    }

    const body = await req.json();
    const { theme, branding } = body as {
      theme?: RestaurantThemeType;
      branding?: Partial<RestaurantBrandingConfig>;
    };

    const validThemes: RestaurantThemeType[] = ["amber", "crimson", "saffron", "emerald", "charcoal"];
    if (theme && !validThemes.includes(theme)) {
      return NextResponse.json({ message: "Invalid theme palette specified" }, { status: 400 });
    }

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

    let updatedTheme = (meta.theme as RestaurantThemeType) || getRestaurantTheme(staffContext.restaurantId);
    if (theme) {
      meta.theme = theme;
      updatedTheme = setRestaurantTheme(staffContext.restaurantId, theme);
    }

    let currentBranding = (meta.branding as RestaurantBrandingConfig) || getRestaurantBranding(staffContext.restaurantId);
    let updatedBranding = currentBranding;
    if (branding && typeof branding === "object") {
      updatedBranding = {
        ...DEFAULT_BRANDING_CONFIG,
        ...currentBranding,
        ...branding,
        theme: updatedTheme,
      };
      meta.branding = updatedBranding;
      setRestaurantBranding(staffContext.restaurantId, updatedBranding);
    }

    await admin
      .from("restaurants")
      .update({ gstin: JSON.stringify(meta) })
      .eq("id", staffContext.restaurantId);

    return NextResponse.json({ ok: true, theme: updatedTheme, branding: updatedBranding });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
