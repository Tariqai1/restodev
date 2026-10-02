import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminUser } from "@/lib/auth/super-admin";
import { resolveStaffContext } from "@/lib/auth/staff-context";
import {
  getBroadcast,
  getStaffPermissions,
  getActiveWaiterCalls,
  getRestaurantTheme,
  getRestaurantFeatures,
  getOrderPrepTime,
  getRestaurantUpsellConfig,
  getActivePendingApprovals,
  getOrderDispatch,
  DEFAULT_RESTAURANT_FEATURES,
  type RestaurantFeatures,
  type WaiterCallRequest,
  type PendingOrderApprovalBatch,
} from "@/lib/platform/state";

function extractDashboardWaiterCalls(restoId?: string, rawGstin?: string): WaiterCallRequest[] {
  let dbCalls: WaiterCallRequest[] = [];
  if (rawGstin?.startsWith("{")) {
    try {
      const meta = JSON.parse(rawGstin);
      if (Array.isArray(meta.waiter_calls)) {
        const now = Date.now();
        dbCalls = meta.waiter_calls.filter(
          (c: WaiterCallRequest) =>
            c.status === "active" && now - new Date(c.createdAt).getTime() < 2 * 60 * 60 * 1000
        );
      }
    } catch {}
  }
  const memCalls = getActiveWaiterCalls(restoId);
  const callMap = new Map<string, WaiterCallRequest>();
  for (const c of memCalls) callMap.set(c.id, c);
  for (const c of dbCalls) callMap.set(c.id, c);
  return Array.from(callMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function derivePendingApprovals(
  restoId: string,
  orders: any[],
  memApprovals: PendingOrderApprovalBatch[]
): PendingOrderApprovalBatch[] {
  const batchOrderIds = new Set(memApprovals.map((b) => b.orderId));
  const combined = [...memApprovals];

  for (const ord of orders || []) {
    if (batchOrderIds.has(ord.id)) continue;
    const rawItems = (ord.order_items as unknown as Array<{
      id: string;
      qty: number;
      unit_price: number;
      item_status: string;
      customer_name?: string | null;
    }>) || [];
    const pendingItems = rawItems.filter((i) => i.item_status === "pending");
    if (pendingItems.length > 0) {
      const tableInfo = ord.restaurant_tables as unknown as { table_number: string } | null;
      const totalAmt = pendingItems.reduce(
        (sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.qty) || 1),
        0
      );
      const totalQty = pendingItems.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
      combined.push({
        id: `batch_${ord.id}`,
        orderId: ord.id,
        restaurantId: restoId,
        tableId: ord.table_id,
        tableNumber: tableInfo?.table_number || "T--",
        customerName: pendingItems[0]?.customer_name || null,
        itemIds: pendingItems.map((i) => i.id),
        totalAmount: Math.round(totalAmt),
        totalItems: totalQty,
        status: "awaiting_approval",
        createdAt: ord.opened_at,
      });
    }
  }
  return combined;
}

function parseOnlineDetails(tbl?: string, notes?: string | null) {
  const isOnline =
    Boolean(tbl?.startsWith("DEL-")) ||
    Boolean(tbl?.startsWith("PU-")) ||
    Boolean(notes?.includes("[🛵 Delivery")) ||
    Boolean(notes?.includes("[🛍️ Pickup"));
  const type = tbl?.startsWith("PU-") || notes?.includes("[🛍️ Pickup") ? "pickup" : "delivery";

  let customerName = "";
  let customerPhone = "";
  let deliveryAddress = "";
  let customerCoords: { lat: number; lng: number } | null = null;

  if (notes) {
    const match = notes.match(/\[(?:🛵 Delivery|🛍️ Pickup):\s*([^(\]]+)(?:\(([^)]+)\))?(?:\s*-\s*([^\]]+))?\]/);
    if (match) {
      customerName = match[1]?.trim() || "";
      customerPhone = match[2]?.trim() || "";
      deliveryAddress = match[3]?.trim() || "";
    }

    const gpsMatch = notes.match(/\[📍 GPS:\s*([0-9.-]+),\s*([0-9.-]+)\]/);
    if (gpsMatch) {
      customerCoords = {
        lat: parseFloat(gpsMatch[1]),
        lng: parseFloat(gpsMatch[2]),
      };
      deliveryAddress = deliveryAddress.replace(/\s*\[📍 GPS:[^\]]+\]/, "").trim();
    }
  }

  return { isOnline, type, customerName, customerPhone, deliveryAddress, customerCoords };
}

function formatOnlineTicket(ord: any) {
  const tbl = Array.isArray(ord.restaurant_tables)
    ? ord.restaurant_tables[0]?.table_number
    : ord.restaurant_tables?.table_number;
  const rawItems = (ord.order_items as any[]) || [];
  const notes = rawItems[0]?.notes || "";
  const details = parseOnlineDetails(tbl, notes);
  const billsArr = Array.isArray(ord.bills) ? ord.bills : ord.bills ? [ord.bills] : [];
  const bill = billsArr[0] || null;

  const subtotal = rawItems.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.qty) || 1), 0);
  const totalAmount = bill ? Number(bill.total) || subtotal : Math.round(subtotal * 1.05);

  const allServed = rawItems.length > 0 && rawItems.every((it) => it.item_status === "served");
  const anyPreparing = rawItems.some((it) => it.item_status === "preparing");
  const defaultStage = allServed ? "ready" : anyPreparing ? "preparing" : "received";
  const dispatch = getOrderDispatch(ord.id);
  const stage = dispatch?.stage === "dispatched" ? "dispatched" : defaultStage;

  return {
    id: ord.id,
    orderNumber: tbl || `ONL-${ord.id.slice(0, 4).toUpperCase()}`,
    type: details.type as "delivery" | "pickup",
    customerName: details.customerName || "Online Guest",
    customerPhone: details.customerPhone,
    deliveryAddress: details.deliveryAddress,
    customerCoords: details.customerCoords,
    status: ord.status, // "open" | "closed" | "cancelled"
    stage: stage as "received" | "preparing" | "ready" | "dispatched",
    openedAt: ord.opened_at,
    closedAt: ord.closed_at,
    totalAmount,
    paymentMode: bill?.payment_mode || "cash",
    paymentStatus: bill?.payment_status || (ord.status === "closed" ? "paid" : "unpaid"),
    dispatch: dispatch || null,
    items: rawItems.map((it) => ({
      name: it.menu_items?.name || "Dish",
      qty: it.qty,
      price: Number(it.unit_price) || Number(it.menu_items?.price) || 0,
      isVeg: Boolean(it.menu_items?.is_veg),
      status: it.item_status,
    })),
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const staffContext = await resolveStaffContext(user);

  if (!user && !staffContext) {
    return NextResponse.json(
      { ok: false, authenticated: false, message: "Staff authentication required" },
      { status: 401 }
    );
  }

  const isSuper = user ? await isSuperAdminUser(user) : Boolean(staffContext?.isSuperAdmin);
  const cookieStore = await cookies();
  const impersonateCookie = cookieStore.get("od_impersonate_resto")?.value;
  let impersonating: { id: string; name: string; ownerEmail: string } | null = null;

  if (impersonateCookie && isSuper) {
    try {
      impersonating = JSON.parse(impersonateCookie);
    } catch {
      // ignore
    }
  }

  const admin = createAdminClient();
  const broadcast = getBroadcast();

  // If impersonating a specific restaurant as Super Admin, scope queries to that restaurant ID
  if (impersonating) {
    const targetRestoId = impersonating.id;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      restaurantRes,
      staffRes,
      tablesRes,
      ordersRes,
      billsRes,
      bestsellersRes,
      closedOnlineOrdersRes,
    ] = await Promise.all([
      admin.from("restaurants").select("id, name, subscription_plan, subscription_status, gstin").eq("id", targetRestoId).single(),
      admin.from("staff_users").select("id, name, role").eq("restaurant_id", targetRestoId).eq("role", "owner").maybeSingle(),
      admin.from("restaurant_tables").select("id, table_number, status, qr_token").eq("restaurant_id", targetRestoId).order("table_number"),
      admin.from("orders").select(`
        id,
        table_id,
        status,
        opened_at,
        table_session_id,
        restaurant_tables (id, table_number),
        order_items (
          id,
          qty,
          unit_price,
          notes,
          item_status,
          menu_items (id, name, is_veg, price)
        )
      `).eq("restaurant_id", targetRestoId).eq("status", "open").order("opened_at", { ascending: true }),
      admin.from("bills").select("id, total, payment_status, paid_at, order:orders(restaurant_id)").gte("paid_at", todayStart.toISOString()),
      admin.from("menu_items").select("id, name, price, is_veg, is_bestseller").eq("restaurant_id", targetRestoId).eq("is_available", true).order("is_bestseller", { ascending: false }).limit(6),
      admin.from("orders").select(`
        id,
        table_id,
        status,
        opened_at,
        closed_at,
        table_session_id,
        restaurant_tables (id, table_number),
        order_items (
          id,
          qty,
          unit_price,
          notes,
          item_status,
          menu_items (id, name, is_veg, price)
        ),
        bills (id, total, payment_mode, payment_status, paid_at)
      `).eq("restaurant_id", targetRestoId).eq("status", "closed").gte("closed_at", todayStart.toISOString()).order("closed_at", { ascending: false }).limit(25),
    ]);

    const targetBills = (billsRes.data || []).filter((b) => {
      const ord = b.order as unknown as { restaurant_id: string } | null;
      return ord?.restaurant_id === targetRestoId;
    });

    const isPhysicalTable = (num?: string | null) => {
      if (!num) return false;
      const n = num.trim().toUpperCase();
      return !n.startsWith("DEL-") && !n.startsWith("PU-") && !n.includes("ONLINE");
    };

    const rawTables = tablesRes.data || [];
    const tables = rawTables.filter((t) => isPhysicalTable(t.table_number));
    const openOrders = ordersRes.data || [];
    const paidBills = targetBills.filter((b) => b.payment_status === "paid");
    const todayRevenue = paidBills.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
    const needsAttentionCount = tables.filter((t) => t.status === "pending" || t.status === "payment_pending").length;
    const dispatchedOrdersCount = paidBills.length + openOrders.length;
    const avgOrderValue = dispatchedOrdersCount > 0 ? Math.round(todayRevenue / dispatchedOrdersCount) : 0;

    const kitchenTickets = openOrders.map((ord, idx) => {
      type OrderItemJoin = {
        id: string;
        qty: number;
        notes: string | null;
        item_status: string;
        menu_items: { name: string; is_veg: boolean } | null;
      };
      const rawItems = (ord.order_items as unknown as OrderItemJoin[]) || [];
      const tableInfo = ord.restaurant_tables as unknown as { table_number: string } | null;

      return {
        id: ord.id,
        ticketNumber: `ORD-${(idx + 1).toString().padStart(4, "0")}`,
        tableNumber: tableInfo?.table_number || "T--",
        openedAt: ord.opened_at,
        status: (rawItems.some((i) => i.item_status === "preparing")
          ? "COOKING"
          : rawItems.every((i) => i.item_status === "served")
          ? "SERVED"
          : "NEW TICKET") as "NEW TICKET" | "COOKING" | "PREPARING" | "SERVED",
        items: rawItems.map((item) => ({
          id: item.id,
          name: item.menu_items?.name || "Dish",
          qty: item.qty,
          category: item.menu_items?.is_veg ? "VEG" : "NON-VEG",
          notes: item.notes || undefined,
        })),
      };
    });

    // ─────────────────────────────────────────────────────────────
    // ONLINE ORDERS SEGREGATION (Delivery & Takeaway Separated from Dining Floor)
    // ─────────────────────────────────────────────────────────────

    const activeOnlineOrders = openOrders
      .filter((o: any) => parseOnlineDetails(o.restaurant_tables?.table_number, o.order_items?.[0]?.notes).isOnline)
      .map(formatOnlineTicket);

    const completedOnlineOrders = (closedOnlineOrdersRes?.data || [])
      .filter((o: any) => parseOnlineDetails(o.restaurant_tables?.table_number, o.order_items?.[0]?.notes).isOnline)
      .map(formatOnlineTicket);

    return NextResponse.json({
      ok: true,
      authenticated: true,
      isSuperAdmin: true,
      isImpersonating: true,
      impersonating,
      broadcast: broadcast?.active ? broadcast : null,
      restaurant: restaurantRes.data || { id: impersonating.id, name: impersonating.name },
      user: {
        id: staffRes.data?.id || "ghost-owner",
        name: staffRes.data?.name || `${impersonating.name} (Ghost Mode)`,
        role: "owner",
        isGhostMode: true,
      },
      tables,
      openOrders: openOrders.map((o) => ({ ...o, prepEstimate: getOrderPrepTime(o.id) })),
      onlineOrders: {
        active: activeOnlineOrders,
        completed: completedOnlineOrders,
      },
      metrics: {
        todayRevenue: Math.round(todayRevenue),
        dispatchedOrders: dispatchedOrdersCount,
        avgOrderValue,
        needsAttentionCount,
      },
      bestsellers: bestsellersRes.data || [],
      kitchenTickets,
      waiterCalls: extractDashboardWaiterCalls(targetRestoId, restaurantRes.data?.gstin),
      pendingApprovals: derivePendingApprovals(
        targetRestoId,
        openOrders,
        getActivePendingApprovals(targetRestoId)
      ),
      theme: (() => {
        const raw = restaurantRes.data?.gstin || "";
        if (raw.startsWith("{")) {
          try {
            const m = JSON.parse(raw);
            if (m.theme) return m.theme;
          } catch {}
        }
        return getRestaurantTheme(targetRestoId);
      })(),
      features: (() => {
        let dbFeatures: Partial<RestaurantFeatures> | null = null;
        const raw = restaurantRes.data?.gstin || "";
        if (raw.startsWith("{")) {
          try {
            const m = JSON.parse(raw);
            if (m.features) dbFeatures = m.features;
          } catch {}
        }
        return dbFeatures
          ? { ...DEFAULT_RESTAURANT_FEATURES, ...getRestaurantFeatures(targetRestoId), ...dbFeatures }
          : getRestaurantFeatures(targetRestoId);
      })(),
      upsellConfig: (() => {
        const raw = restaurantRes.data?.gstin || "";
        if (raw.startsWith("{")) {
          try {
            const m = JSON.parse(raw);
            if (m.upsellConfig) return m.upsellConfig;
          } catch {}
        }
        return getRestaurantUpsellConfig(targetRestoId);
      })(),
    });
  }

  // Normal flow
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const targetRestoId = staffContext?.restaurantId;

  const [
    restaurantResult,
    staffResult,
    tablesResult,
    ordersResult,
    billsResult,
    bestsellersResult,
  ] = await Promise.all([
    targetRestoId
      ? admin
          .from("restaurants")
          .select("id, name, subscription_plan, subscription_status, gstin")
          .eq("id", targetRestoId)
          .maybeSingle()
      : supabase
          .from("restaurants")
          .select("id, name, subscription_plan, subscription_status, gstin")
          .maybeSingle(),
    user?.id
      ? admin
          .from("staff_users")
          .select("id, name, role")
          .eq("auth_user_id", user.id)
          .maybeSingle()
      : staffContext?.staffId
      ? admin
          .from("staff_users")
          .select("id, name, role")
          .eq("id", staffContext.staffId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    targetRestoId
      ? admin
          .from("restaurant_tables")
          .select("id, table_number, status, qr_token")
          .eq("restaurant_id", targetRestoId)
          .order("table_number")
      : supabase
          .from("restaurant_tables")
          .select("id, table_number, status, qr_token")
          .order("table_number"),
    targetRestoId
      ? admin
          .from("orders")
          .select(`
            id,
            table_id,
            status,
            opened_at,
            table_session_id,
            restaurant_tables (id, table_number),
            order_items (
              id,
              qty,
              unit_price,
              notes,
              item_status,
              menu_items (id, name, is_veg, price)
            )
          `)
          .eq("restaurant_id", targetRestoId)
          .eq("status", "open")
          .order("opened_at", { ascending: true })
      : supabase
          .from("orders")
          .select(`
            id,
            table_id,
            status,
            opened_at,
            table_session_id,
            restaurant_tables (id, table_number),
            order_items (
              id,
              qty,
              unit_price,
              notes,
              item_status,
              menu_items (id, name, is_veg, price)
            )
          `)
          .eq("status", "open")
          .order("opened_at", { ascending: true }),
    targetRestoId
      ? admin
          .from("bills")
          .select("id, total, payment_status, paid_at, order:orders(restaurant_id)")
          .gte("paid_at", todayStart.toISOString())
      : supabase
          .from("bills")
          .select("id, total, payment_status, paid_at")
          .gte("paid_at", todayStart.toISOString()),
    targetRestoId
      ? admin
          .from("menu_items")
          .select("id, name, price, is_veg, is_bestseller")
          .eq("restaurant_id", targetRestoId)
          .eq("is_available", true)
          .order("is_bestseller", { ascending: false })
          .limit(6)
      : supabase
          .from("menu_items")
          .select("id, name, price, is_veg, is_bestseller")
          .eq("is_available", true)
          .order("is_bestseller", { ascending: false })
          .limit(6),
  ]);

  const firstError =
    restaurantResult.error ?? tablesResult.error ?? ordersResult.error;
  if (firstError) {
    return NextResponse.json(
      { ok: false, authenticated: true, error: "Unable to load dashboard data" },
      { status: 500 }
    );
  }

  const activeStaffRaw = cookieStore.get("od_active_staff")?.value;
  let activeStaffProfile = null;
  if (activeStaffRaw) {
    try {
      activeStaffProfile = JSON.parse(activeStaffRaw);
    } catch {
      // ignore
    }
  }

  const rawProfile =
    activeStaffProfile ||
    staffResult.data ||
    (staffContext
      ? { id: staffContext.staffId, name: staffContext.name, role: staffContext.role }
      : {
          name: user?.email?.split("@")[0] || "Staff",
          role: "staff",
        });

  const rawRole = (rawProfile.role || "staff").toLowerCase();
  const normalizedUserRole = rawRole === "staff" ? "waiter" : rawRole;

  const userProfile = {
    ...rawProfile,
    role: normalizedUserRole,
    permissions:
      rawProfile.permissions ||
      getStaffPermissions(rawProfile.id || user?.id || "staff", normalizedUserRole),
  };

  // Compute live real-time metrics
  const bills = billsResult.data || [];
  const tables = tablesResult.data || [];
  const openOrders = ordersResult.data || [];

  const paidBills = bills.filter((b) => b.payment_status === "paid");
  const todayRevenue = paidBills.reduce((sum, b) => sum + (Number(b.total) || 0), 0);

  const needsAttentionCount = tables.filter(
    (t) => t.status === "pending" || t.status === "payment_pending"
  ).length;

  const dispatchedOrdersCount = paidBills.length + openOrders.length;
  const avgOrderValue = dispatchedOrdersCount > 0 ? Math.round(todayRevenue / dispatchedOrdersCount) : 0;

  // Format real kitchen tickets
  const kitchenTickets = openOrders.map((ord, idx) => {
    type OrderItemJoin = {
      id: string;
      qty: number;
      notes: string | null;
      item_status: string;
      menu_items: { name: string; is_veg: boolean } | null;
    };
    const rawItems = (ord.order_items as unknown as OrderItemJoin[]) || [];
    const tableInfo = ord.restaurant_tables as unknown as { table_number: string } | null;

    return {
      id: ord.id,
      ticketNumber: `ORD-${(idx + 1).toString().padStart(4, "0")}`,
      tableNumber: tableInfo?.table_number || "T--",
      openedAt: ord.opened_at,
      status: (rawItems.some((i) => i.item_status === "preparing")
        ? "COOKING"
        : rawItems.every((i) => i.item_status === "served")
        ? "SERVED"
        : "NEW TICKET") as "NEW TICKET" | "COOKING" | "PREPARING" | "SERVED",
      items: rawItems.map((item) => ({
        id: item.id,
        name: item.menu_items?.name || "Dish",
        qty: item.qty,
        category: item.menu_items?.is_veg ? "VEG" : "NON-VEG",
        notes: item.notes || undefined,
      })),
    };
  });

  const normalRestoId = restaurantResult.data?.id;
  const closedOnlineOrdersRes = normalRestoId
    ? await admin
        .from("orders")
        .select(`
          id,
          table_id,
          status,
          opened_at,
          closed_at,
          restaurant_tables (id, table_number),
          order_items (
            id,
            menu_item_id,
            qty,
            unit_price,
            notes,
            item_status,
            menu_items (name, is_veg, price)
          ),
          bills (id, total, payment_mode, payment_status)
        `)
        .eq("restaurant_id", normalRestoId)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(30)
    : { data: [] };

  const activeOnlineOrders = openOrders
    .filter((o: any) => {
      const tbl = Array.isArray(o.restaurant_tables) ? o.restaurant_tables[0]?.table_number : o.restaurant_tables?.table_number;
      return parseOnlineDetails(tbl, o.order_items?.[0]?.notes).isOnline;
    })
    .map(formatOnlineTicket);

  const completedOnlineOrders = (closedOnlineOrdersRes?.data || [])
    .filter((o: any) => {
      const tbl = Array.isArray(o.restaurant_tables) ? o.restaurant_tables[0]?.table_number : o.restaurant_tables?.table_number;
      return parseOnlineDetails(tbl, o.order_items?.[0]?.notes).isOnline;
    })
    .map(formatOnlineTicket);

  return NextResponse.json({
    ok: true,
    authenticated: true,
    isSuperAdmin: isSuper,
    isImpersonating: false,
    impersonating: null,
    broadcast: broadcast?.active ? broadcast : null,
    restaurant: restaurantResult.data,
    user: userProfile,
    tables: tables.filter((t) => !t.table_number.startsWith("DEL-") && !t.table_number.startsWith("PU-")),
    openOrders: openOrders
      .filter((o: any) => {
        const tbl = Array.isArray(o.restaurant_tables) ? o.restaurant_tables[0]?.table_number : o.restaurant_tables?.table_number;
        return !parseOnlineDetails(tbl, o.order_items?.[0]?.notes).isOnline;
      })
      .map((o) => ({ ...o, prepEstimate: getOrderPrepTime(o.id) })),
    onlineOrders: {
      active: activeOnlineOrders,
      completed: completedOnlineOrders,
    },
    metrics: {
      todayRevenue: Math.round(todayRevenue),
      dispatchedOrders: dispatchedOrdersCount,
      avgOrderValue,
      needsAttentionCount,
    },
    bestsellers: bestsellersResult.data || [],
    kitchenTickets,
    waiterCalls: extractDashboardWaiterCalls(restaurantResult.data?.id, restaurantResult.data?.gstin),
    pendingApprovals: derivePendingApprovals(
      restaurantResult.data?.id || "",
      ordersResult.data || [],
      getActivePendingApprovals(restaurantResult.data?.id)
    ),
    theme: (() => {
      const raw = restaurantResult.data?.gstin || "";
      if (raw.startsWith("{")) {
        try {
          const m = JSON.parse(raw);
          if (m.theme) return m.theme;
        } catch {}
      }
      return getRestaurantTheme(restaurantResult.data?.id);
    })(),
    features: (() => {
      let dbFeatures: Partial<RestaurantFeatures> | null = null;
      const rawGstin = restaurantResult.data?.gstin || "";
      if (rawGstin.startsWith("{")) {
        try {
          const meta = JSON.parse(rawGstin);
          if (meta.features) dbFeatures = meta.features;
        } catch {}
      }
      return dbFeatures
        ? { ...DEFAULT_RESTAURANT_FEATURES, ...getRestaurantFeatures(restaurantResult.data?.id), ...dbFeatures }
        : getRestaurantFeatures(restaurantResult.data?.id);
    })(),
    upsellConfig: (() => {
      const raw = restaurantResult.data?.gstin || "";
      if (raw.startsWith("{")) {
        try {
          const m = JSON.parse(raw);
          if (m.upsellConfig) return m.upsellConfig;
        } catch {}
      }
      return getRestaurantUpsellConfig(restaurantResult.data?.id);
    })(),
  });
}
