import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import {
  getRolePermissions,
  saveAllRolePermissions,
  RolePermissionsConfig,
  DEFAULT_ROLE_PERMISSIONS,
} from "@/lib/platform/state";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const staffContext = user ? await resolveStaffContext(user) : null;
    const restoId = staffContext?.restaurantId || "default";

    const permissions = getRolePermissions(restoId);
    return NextResponse.json({ ok: true, permissions, defaults: DEFAULT_ROLE_PERMISSIONS });
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

    const staffContext = user ? await resolveStaffContext(user) : null;
    const allowedRoles = ["owner", "manager", "admin"];

    if (staffContext?.role && !allowedRoles.includes(staffContext.role.toLowerCase())) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized. Manager or Owner role required to configure role permissions." },
        { status: 403 }
      );
    }

    const restoId = staffContext?.restaurantId || "default";
    const body = await req.json();
    const newConfig = body.permissions as RolePermissionsConfig;

    if (!newConfig) {
      return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
    }

    const saved = saveAllRolePermissions(restoId, newConfig);
    return NextResponse.json({ ok: true, permissions: saved });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
