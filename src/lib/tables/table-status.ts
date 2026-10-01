import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Safely transition a restaurant table's status obeying the Postgres trigger
 * check_table_status_transition() state machine rules:
 *
 * Allowed transitions:
 *   ('empty','pending')
 *   ('pending','preparing'), ('pending','served'), ('pending','payment_pending')
 *   ('preparing','served'), ('preparing','payment_pending')
 *   ('served','payment_pending')
 *   ('payment_pending','empty')
 *   Same status -> Same status (no-op)
 */

export type TableStatus = "empty" | "pending" | "preparing" | "served" | "payment_pending";

export async function safeSetTableStatus(
  admin: SupabaseClient,
  tableId: string,
  targetStatus: TableStatus,
  restaurantId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let query = admin.from("restaurant_tables").select("id, status").eq("id", tableId);
    if (restaurantId) query = query.eq("restaurant_id", restaurantId);
    const { data: tbl, error: fetchErr } = await query.maybeSingle();

    if (fetchErr) return { success: false, error: fetchErr.message };
    if (!tbl) return { success: false, error: "Table not found" };

    const current = tbl.status as TableStatus;
    if (current === targetStatus) return { success: true };

    if (targetStatus === "empty") {
      // Must transition to payment_pending first if not already there
      if (current !== "payment_pending") {
        const { error: e1 } = await admin
          .from("restaurant_tables")
          .update({ status: "payment_pending" })
          .eq("id", tableId);
        if (e1) return { success: false, error: e1.message };
      }
      const { error: e2 } = await admin
        .from("restaurant_tables")
        .update({ status: "empty" })
        .eq("id", tableId);
      if (e2) return { success: false, error: e2.message };
      return { success: true };
    }

    if (targetStatus === "served") {
      let state = current;
      if (state === "payment_pending") {
        const { error: e0 } = await admin
          .from("restaurant_tables")
          .update({ status: "empty" })
          .eq("id", tableId);
        if (e0) return { success: false, error: e0.message };
        state = "empty";
      }
      if (state === "empty") {
        const { error: e1 } = await admin
          .from("restaurant_tables")
          .update({ status: "pending" })
          .eq("id", tableId);
        if (e1) return { success: false, error: e1.message };
      }
      const { error: e2 } = await admin
        .from("restaurant_tables")
        .update({ status: "served" })
        .eq("id", tableId);
      if (e2) return { success: false, error: e2.message };
      return { success: true };
    }

    if (targetStatus === "pending") {
      if (current === "empty") {
        const { error: e } = await admin
          .from("restaurant_tables")
          .update({ status: "pending" })
          .eq("id", tableId);
        if (e) return { success: false, error: e.message };
        return { success: true };
      }
      // If table is served/preparing, cycle through payment_pending -> empty -> pending
      if (current !== "payment_pending") {
        await admin.from("restaurant_tables").update({ status: "payment_pending" }).eq("id", tableId);
      }
      await admin.from("restaurant_tables").update({ status: "empty" }).eq("id", tableId);
      const { error: e } = await admin.from("restaurant_tables").update({ status: "pending" }).eq("id", tableId);
      if (e) return { success: false, error: e.message };
      return { success: true };
    }

    // Default direct transition for any other status
    const { error } = await admin
      .from("restaurant_tables")
      .update({ status: targetStatus })
      .eq("id", tableId);
    return { success: !error, error: error?.message };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update table status" };
  }
}

export async function safeFreeTableByNumber(
  admin: SupabaseClient,
  tableNumber: string,
  restaurantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: tbl, error } = await admin
      .from("restaurant_tables")
      .select("id, status")
      .eq("table_number", tableNumber)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (error || !tbl) return { success: false, error: error?.message || "Table not found" };
    return safeSetTableStatus(admin, tbl.id, "empty", restaurantId);
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to free table" };
  }
}
