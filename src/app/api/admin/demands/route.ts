import { NextRequest, NextResponse } from "next/server";
import {
  getCustomerDemands,
  updateCustomerDemandStatus,
  deleteCustomerDemand,
} from "@/lib/platform/state";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId")?.trim();

    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: "Restaurant ID required" }, { status: 400 });
    }

    const demands = getCustomerDemands(restaurantId);
    return NextResponse.json({ ok: true, demands });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { restaurantId, demandId, status } = body;

    if (!restaurantId || !demandId || !status) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const updated = updateCustomerDemandStatus(restaurantId, demandId, status);
    return NextResponse.json({ ok: true, demands: updated });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId")?.trim();
    const demandId = searchParams.get("demandId")?.trim();

    if (!restaurantId || !demandId) {
      return NextResponse.json({ ok: false, error: "Missing required parameters" }, { status: 400 });
    }

    const updated = deleteCustomerDemand(restaurantId, demandId);
    return NextResponse.json({ ok: true, demands: updated });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
