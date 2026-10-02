"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import EditRunningOrderModal, { MenuItemRef } from "@/components/admin/modals/EditRunningOrderModal";
import UndoItemToast, { RemovedItemPayload } from "@/components/admin/ui/UndoItemToast";
import TableTransferModal from "@/components/admin/modals/TableTransferModal";
import {
  isSoundMuted,
  setSoundMuted,
  snoozeSound,
  cancelSnooze,
  getSnoozeRemainingMinutes,
  unlockAudio,
  playOrderApprovalChime,
  playWaiterCallChime,
  playEscalatedChime,
} from "@/lib/audio/chime";

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface TableRecord {
  id: string;
  table_number: string;
  status: "available" | "occupied" | "billed" | "empty";
  qr_token?: string;
}

interface OrderItemRecord {
  id: string;
  menu_item_id: string;
  qty: number;
  unit_price: number;
  notes?: string | null;
  item_status: string;
  created_at?: string;
  menu_items?: {
    id?: string;
    name: string;
    is_veg: boolean;
    price?: number;
  } | null;
}

interface OpenOrderRecord {
  id: string;
  table_id: string;
  status: string;
  opened_at: string;
  customer_name?: string | null;
  restaurant_tables?: {
    id?: string;
    table_number: string;
  } | null;
  order_items: OrderItemRecord[];
}

interface WaiterCallRecord {
  id: string;
  tableId?: string;
  tableNumber: string;
  restaurantId: string;
  type?: "waiter" | "water" | "bill" | "clean";
  customNote?: string;
  paymentMode?: string;
  status: "active" | "resolved";
  createdAt: string;
}

interface PendingApprovalBatch {
  id: string;
  orderId: string;
  tableId: string;
  tableNumber: string;
  customerName?: string | null;
  itemIds: string[];
  totalAmount: number;
  totalItems: number;
  status: "awaiting_approval" | "approved" | "rejected";
  createdAt: string;
}

interface OnlineOrderTicket {
  id: string;
  orderNumber: string;
  type: "delivery" | "pickup";
  customerName: string;
  customerPhone?: string;
  deliveryAddress?: string;
  status: string;
  stage: "received" | "preparing" | "ready" | "dispatched";
  openedAt: string;
  closedAt?: string;
  totalAmount: number;
  paymentMode: string;
  paymentStatus: string;
  customerCoords?: { lat: number; lng: number } | null;
  dispatch?: {
    riderName?: string;
    riderPhone?: string;
    dispatchedAt?: string;
    stage?: string;
  } | null;
  items: {
    name: string;
    qty: number;
    price: number;
    isVeg: boolean;
    status: string;
  }[];
}

export default function WaiterPortalPage() {
  const router = useRouter();

  // Primary Data State
  const [restaurantName, setRestaurantName] = useState("Order Desk");
  const [staffUser, setStaffUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrderRecord[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCallRecord[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalBatch[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<{
    active: OnlineOrderTicket[];
    completed: OnlineOrderTicket[];
  }>({ active: [], completed: [] });
  const [menuItems, setMenuItems] = useState<MenuItemRef[]>([]);

  // UI Control State
  const [activeTab, setActiveTab] = useState<"floor" | "online" | "approvals" | "calls">("floor");
  const [onlineFilter, setOnlineFilter] = useState<"active" | "completed">("active");
  const [isSettlingOnlineId, setIsSettlingOnlineId] = useState<string | null>(null);
  const [floorFilter, setFloorFilter] = useState<"all" | "occupied" | "calling" | "empty">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Rider Dispatch & Order Cancellation State
  const [dispatchModalOrder, setDispatchModalOrder] = useState<OnlineOrderTicket | null>(null);
  const [riderNameInput, setRiderNameInput] = useState("");
  const [riderPhoneInput, setRiderPhoneInput] = useState("");
  const [savedRiders, setSavedRiders] = useState<Array<{ id: string; name: string; phone: string }>>([
    { id: "r1", name: "Rider 1 (In-house)", phone: "" },
    { id: "r2", name: "Rider 2 (In-house)", phone: "" },
  ]);
  const [isDispatchingRider, setIsDispatchingRider] = useState(false);
  const [cancelModalOrder, setCancelModalOrder] = useState<{ id: string; orderNumber: string } | null>(null);
  const [cancelReasonText, setCancelReasonText] = useState("Item out of stock");
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);

  // Audio & Escalation State
  const [soundMutedState, setSoundMutedState] = useState(false);
  const [snoozeMins, setSnoozeMins] = useState(0);
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const prevApprovalsCountRef = useRef(0);
  const prevCallsCountRef = useRef(0);
  const pollingInFlightRef = useRef(false);

  // Edit Running Order Modal State
  const [editingOrder, setEditingOrder] = useState<{ orderId: string; tableNumber: string } | null>(null);
  const [removedItemForUndo, setRemovedItemForUndo] = useState<RemovedItemPayload | null>(null);

  // Bill Summary Modal State
  const [viewingBillOrder, setViewingBillOrder] = useState<OpenOrderRecord | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  // Shift & Join Table Modal State
  const [transferModal, setTransferModal] = useState<{
    isOpen: boolean;
    table: TableRecord | null;
    mode: "shift" | "join";
  }>({ isOpen: false, table: null, mode: "shift" });

  // Reject Approval Modal State
  const [rejectingBatch, setRejectingBatch] = useState<PendingApprovalBatch | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Approving In-Progress Indicator
  const [approvingBatchIds, setApprovingBatchIds] = useState<Record<string, boolean>>({});

  // Auto-Approve Timer Countdown (30s)
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  // ─────────────────────────────────────────────────────────────
  // FIRST TOUCH AUDIO UNLOCK (iOS / Android)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleFirstTouch = () => {
      unlockAudio();
      window.removeEventListener("touchstart", handleFirstTouch);
      window.removeEventListener("click", handleFirstTouch);
    };

    window.addEventListener("touchstart", handleFirstTouch, { passive: true });
    window.addEventListener("click", handleFirstTouch);

    return () => {
      window.removeEventListener("touchstart", handleFirstTouch);
      window.removeEventListener("click", handleFirstTouch);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // FETCH MENU ITEMS (For Quick Adds in Modal)
  // ─────────────────────────────────────────────────────────────
  const fetchMenuCatalog = useCallback(async () => {
    try {
      const res = await fetch("/api/menu");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) {
          const mapped: MenuItemRef[] = data.items.map((i: any) => ({
            id: i.id,
            name: i.name,
            category: i.category?.name || "General",
            price: Number(i.price) || 0,
            is_veg: Boolean(i.is_veg),
            is_available: Boolean(i.is_available),
            has_half_portion: Boolean(i.has_half_portion),
            half_price: i.half_price ? Number(i.half_price) : undefined,
          }));
          setMenuItems(mapped);
        }
      }
    } catch {
      // non-fatal
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // FETCH DASHBOARD DATA (Tables, Orders, Approvals, Buzzers)
  // ─────────────────────────────────────────────────────────────
  const fetchDashboardData = useCallback(
    async (isInitial = false) => {
      if (pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;

      try {
        const res = await fetch("/api/dashboard");
        if (res.status === 401 && isInitial) {
          router.push("/login");
          return;
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load floor data");

        if (data.restaurant?.name) setRestaurantName(data.restaurant.name);
        if (data.user) setStaffUser(data.user);

        const newTables: TableRecord[] = data.tables || [];
        const newOrders: OpenOrderRecord[] = data.openOrders || [];
        const newCalls: WaiterCallRecord[] = (data.waiterCalls || []).filter(
          (c: WaiterCallRecord) => c.status === "active"
        );
        const newApprovals: PendingApprovalBatch[] = (data.pendingApprovals || []).filter(
          (b: PendingApprovalBatch) => b.status === "awaiting_approval"
        );

        setTables(newTables);
        setOpenOrders(newOrders);
        setWaiterCalls(newCalls);
        setPendingApprovals(newApprovals);
        if (data.onlineOrders) {
          setOnlineOrders({
            active: data.onlineOrders.active || [],
            completed: data.onlineOrders.completed || [],
          });
        }
        setLastSyncTime(new Date());

        // Audio Triggers
        if (!isInitial) {
          // 1. New Pending Approval -> Melodic Chime
          if (newApprovals.length > prevApprovalsCountRef.current) {
            playOrderApprovalChime();
            if (typeof window !== "undefined" && navigator.vibrate) {
              navigator.vibrate([10, 50, 15]);
            }
          }
          // 2. New Table Buzzer -> Urgent Double-Beep
          if (newCalls.length > prevCallsCountRef.current) {
            playWaiterCallChime();
            if (typeof window !== "undefined" && navigator.vibrate) {
              navigator.vibrate([30, 40, 30, 40, 50]);
            }
          }
        }

        prevApprovalsCountRef.current = newApprovals.length;
        prevCallsCountRef.current = newCalls.length;
      } catch (err) {
        console.error("[Waiter Dashboard Sync Error]", err);
      } finally {
        pollingInFlightRef.current = false;
        setIsLoading(false);
      }
    },
    [router]
  );

  // Initial Boot & Recurring 4.5s Polling Loop
  useEffect(() => {
    fetchDashboardData(true);
    fetchMenuCatalog();

    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 6500);

    return () => clearInterval(interval);
  }, [fetchDashboardData, fetchMenuCatalog]);

  // Network Online/Offline Listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    setSoundMutedState(isSoundMuted());
    setSnoozeMins(getSnoozeRemainingMinutes());
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const soundCheckTimer = setInterval(() => {
      setSoundMutedState(isSoundMuted());
      setSnoozeMins(getSnoozeRemainingMinutes());
    }, 3000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(soundCheckTimer);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 1-TAP APPROVAL HANDLER
  // ─────────────────────────────────────────────────────────────
  const handleApproveBatch = async (batch: PendingApprovalBatch) => {
    if (approvingBatchIds[batch.id]) return;

    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(15);
    }

    setApprovingBatchIds((prev) => ({ ...prev, [batch.id]: true }));

    try {
      const res = await fetch("/api/orders/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batch.id,
          action: "approve",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Approval failed");
      }

      // Optimistic removal from queue
      setPendingApprovals((prev) => prev.filter((b) => b.id !== batch.id));
      // Re-sync dashboard
      fetchDashboardData(false);
    } catch (err: any) {
      alert(err.message || "Failed to approve order");
    } finally {
      setApprovingBatchIds((prev) => {
        const next = { ...prev };
        delete next[batch.id];
        return next;
      });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // REJECT APPROVAL HANDLER
  // ─────────────────────────────────────────────────────────────
  const handleConfirmReject = async () => {
    if (!rejectingBatch || isRejecting) return;

    setIsRejecting(true);
    try {
      const res = await fetch("/api/orders/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: rejectingBatch.id,
          action: "reject",
          reason: rejectReason || "Declined by floor staff",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Rejection failed");
      }

      setPendingApprovals((prev) => prev.filter((b) => b.id !== rejectingBatch.id));
      setRejectingBatch(null);
      setRejectReason("");
      fetchDashboardData(false);
    } catch (err: any) {
      alert(err.message || "Failed to decline order");
    } finally {
      setIsRejecting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 1-TAP ACKNOWLEDGE WAITER CALL BUZZER
  // ─────────────────────────────────────────────────────────────
  const handleAcknowledgeCall = async (callId: string) => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(12);
    }

    // Optimistic removal
    setWaiterCalls((prev) => prev.filter((c) => c.id !== callId));

    try {
      await fetch("/api/public/table/call-waiter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });
      fetchDashboardData(false);
    } catch {
      // non-fatal
    }
  };

  // ─────────────────────────────────────────────────────────────
  // UNDO ITEM RESTORATION (5-Second Floating Toast)
  // ─────────────────────────────────────────────────────────────
  const handleUndoRestore = async (itemToRestore: RemovedItemPayload) => {
    try {
      const res = await fetch("/api/orders/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore_item",
          orderId: itemToRestore.orderId,
          menuItemId: itemToRestore.menuItemId,
          qty: itemToRestore.qty,
          unitPrice: itemToRestore.unitPrice,
          notes: itemToRestore.notes,
        }),
      });

      if (res.ok) {
        setRemovedItemForUndo(null);
        fetchDashboardData(false);
      }
    } catch {
      // non-fatal
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SETTLE BILL & FREE TABLE (Cash or UPI)
  // ─────────────────────────────────────────────────────────────
  const handleSettleAndFreeTable = async (
    orderId: string,
    tableNumber: string,
    mode: "cash" | "upi" = "cash"
  ) => {
    setIsSettling(true);
    try {
      const res = await fetch("/api/bills/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          tableNumber,
          paymentMode: mode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to settle table");

      setViewingBillOrder(null);
      await fetchDashboardData(true);
      if (typeof window !== "undefined" && navigator.vibrate) {
        navigator.vibrate([20, 30, 20]);
      }
    } catch (err: any) {
      alert(err.message || "Failed to settle and free table");
    } finally {
      setIsSettling(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SETTLE DIRECT ONLINE ORDER (Delivery / Pickup)
  // ─────────────────────────────────────────────────────────────
  const handleSettleOnlineOrder = async (
    order: OnlineOrderTicket,
    mode: "cash" | "upi" = "cash"
  ) => {
    setIsSettlingOnlineId(order.id);
    try {
      const res = await fetch("/api/bills/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          tableNumber: order.orderNumber,
          paymentMode: mode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to settle online order");

      await fetchDashboardData(true);
      if (typeof window !== "undefined" && navigator.vibrate) {
        navigator.vibrate([20, 30, 20]);
      }
    } catch (err: any) {
      alert(err.message || "Failed to settle online order");
    } finally {
      setIsSettlingOnlineId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // DISPATCH ONLINE ORDER TO RIDER (WhatsApp Integration)
  // ─────────────────────────────────────────────────────────────
  const handleDispatchRider = async (
    order: OnlineOrderTicket,
    riderName: string,
    riderPhone: string
  ) => {
    if (!riderName.trim()) {
      alert("Please enter rider name.");
      return;
    }

    setIsDispatchingRider(true);
    try {
      // 1. Record dispatch in backend
      await fetch("/api/delivery/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dispatch_rider",
          orderId: order.id,
          riderName: riderName.trim(),
          riderPhone: riderPhone.trim(),
        }),
      });

      // 2. Build pre-formatted WhatsApp briefing
      const cleanPhone = riderPhone.replace(/[^0-9]/g, "");
      const itemsList = order.items.map((it) => `• ${it.qty}x ${it.name}`).join("\n");
      const navLink = order.customerCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${order.customerCoords.lat},${order.customerCoords.lng}`
        : order.deliveryAddress
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.deliveryAddress)}`
        : "";

      const whatsappText = `🛵 *DELIVERY DISPATCH — ${restaurantName}*\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `🧾 *Order*: ${order.orderNumber}\n` +
        `👤 *Customer*: ${order.customerName}\n` +
        `📞 *Customer Phone*: ${order.customerPhone || "N/A"}\n` +
        `📍 *Delivery Address*: ${order.deliveryAddress || "N/A"}\n` +
        (navLink ? `🗺️ *GPS Navigation*: ${navLink}\n` : "") +
        `━━━━━━━━━━━━━━━━━\n` +
        `🍲 *Food Items*:\n${itemsList}\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `💰 *Bill Total*: ₹${order.totalAmount} (${order.paymentStatus === "paid" ? "✅ Paid Online (Do Not Collect)" : "💵 Collect Cash on Delivery"})\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `_Please pick up order and deliver safely!_`;

      const waUrl = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(whatsappText)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;

      window.open(waUrl, "_blank");

      setDispatchModalOrder(null);
      await fetchDashboardData(true);
    } catch (err: any) {
      alert(err.message || "Failed to dispatch rider.");
    } finally {
      setIsDispatchingRider(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // CANCEL ORDER (Staff Action with Reason)
  // ─────────────────────────────────────────────────────────────
  const handleCancelOrder = async (orderId: string, reason: string) => {
    setIsCancellingOrder(true);
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason,
          cancelledBy: "staff",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to cancel order");

      setCancelModalOrder(null);
      await fetchDashboardData(true);
      if (typeof window !== "undefined" && navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
    } catch (err: any) {
      alert(err.message || "Failed to cancel order");
    } finally {
      setIsCancellingOrder(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PUNCH QUICK ORDER ON EMPTY TABLE
  // ─────────────────────────────────────────────────────────────
  const handlePunchQuickOrder = async (table: TableRecord) => {
    if (menuItems.length === 0) {
      alert("Loading menu, please wait a moment...");
      return;
    }

    // Pick top available item or prompt waiter
    const firstItem = menuItems.find((i) => i.is_available);
    if (!firstItem) {
      alert("No available menu items found.");
      return;
    }

    try {
      const res = await fetch("/api/orders/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: table.table_number,
          items: [{ menuItemId: firstItem.id, qty: 1 }],
          customerName: "Floor Guest",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to start order");

      // Open edit modal directly for this newly created order
      if (data.orderId) {
        setEditingOrder({
          orderId: data.orderId,
          tableNumber: table.table_number,
        });
      }
      fetchDashboardData(false);
    } catch (err: any) {
      alert(err.message || "Could not start table order");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // SOUND CONTROL ACTIONS
  // ─────────────────────────────────────────────────────────────
  const handleToggleSound = () => {
    unlockAudio();
    const nextMuted = !soundMutedState;
    setSoundMuted(nextMuted);
    setSoundMutedState(nextMuted);
    setSnoozeMins(0);
    setShowSoundMenu(false);
  };

  const handleSnooze = (minutes: number) => {
    unlockAudio();
    snoozeSound(minutes);
    setSoundMutedState(true);
    setSnoozeMins(minutes);
    setShowSoundMenu(false);
  };

  const handleUnmute = () => {
    unlockAudio();
    cancelSnooze();
    setSoundMutedState(false);
    setSnoozeMins(0);
    setShowSoundMenu(false);
  };

  // ─────────────────────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  // ─────────────────────────────────────────────────────────────
  // DERIVED DATA: TABLE MAPPINGS & FILTERS
  // ─────────────────────────────────────────────────────────────
  // Map table_id or table_number to open order
  const tableOrderMap = useMemo(() => {
    const map = new Map<string, OpenOrderRecord>();
    for (const ord of openOrders) {
      if (ord.table_id) map.set(ord.table_id, ord);
      const tblNum = ord.restaurant_tables?.table_number;
      if (tblNum) map.set(tblNum, ord);
    }
    return map;
  }, [openOrders]);

  // Set of calling table numbers
  const callingTableNumbers = useMemo(() => {
    const set = new Set<string>();
    for (const c of waiterCalls) {
      if (c.tableNumber) set.add(c.tableNumber.trim().toUpperCase());
    }
    return set;
  }, [waiterCalls]);

  const isPhysicalTable = (num?: string | null) => {
    if (!num) return false;
    const n = num.trim().toUpperCase();
    return !n.startsWith("DEL-") && !n.startsWith("PU-") && !n.includes("ONLINE");
  };

  // Filtered Tables
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (!isPhysicalTable(t.table_number)) return false;
      const ord = tableOrderMap.get(t.id) || tableOrderMap.get(t.table_number);
      const isOccupied = Boolean(ord) || t.status === "occupied";
      const isCalling = callingTableNumbers.has(t.table_number.trim().toUpperCase());

      // Filter chip check
      if (floorFilter === "occupied" && !isOccupied) return false;
      if (floorFilter === "calling" && !isCalling) return false;
      if (floorFilter === "empty" && isOccupied) return false;

      // Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = t.table_number.toLowerCase().includes(q);
        const matchesGuest = ord?.customer_name?.toLowerCase().includes(q);
        const matchesItem = ord?.order_items.some((it) =>
          it.menu_items?.name?.toLowerCase().includes(q)
        );
        return matchesNum || matchesGuest || matchesItem;
      }

      return true;
    });
  }, [tables, tableOrderMap, callingTableNumbers, floorFilter, searchQuery]);

  // Metrics
  const physicalTables = useMemo(() => tables.filter((t) => isPhysicalTable(t.table_number)), [tables]);
  const occupiedCount = physicalTables.filter(
    (t) => Boolean(tableOrderMap.get(t.id)) || t.status === "occupied"
  ).length;
  const callsCount = waiterCalls.length;
  const approvalsCount = pendingApprovals.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP NAVIGATION & IDENTITY BAR
         ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-3.5 sm:px-5 py-2.5 flex items-center justify-between shadow-md">
        {/* Left: Identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-base shadow-sm shrink-0">
            🛎️
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-extrabold text-white tracking-tight truncate leading-tight">
                {restaurantName}
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Floor
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
              <span className="truncate">
                {staffUser?.name || "Floor Captain"}
              </span>
              <span className="text-slate-600">·</span>
              <span className="flex items-center gap-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? "bg-emerald-400" : "bg-rose-400 animate-pulse"
                  }`}
                />
                <span className={isOnline ? "text-slate-400" : "text-rose-400"}>
                  {isOnline ? "Live" : "Offline"}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Sound Controls & Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Audio Chime Mute/Snooze Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                unlockAudio();
                setShowSoundMenu(!showSoundMenu);
              }}
              className={`h-9 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                soundMutedState
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
              title="Shift Audio Chimes"
            >
              <i
                className={`fa-solid ${
                  soundMutedState ? "fa-bell-slash text-amber-400" : "fa-bell text-emerald-400"
                } text-xs`}
              />
              <span className="hidden sm:inline text-[11px]">
                {soundMutedState
                  ? snoozeMins > 0
                    ? `${snoozeMins}m`
                    : "Muted"
                  : "Chimes"}
              </span>
            </button>

            {/* Dropdown */}
            {showSoundMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowSoundMenu(false)}
                />
                <div className="absolute right-0 top-11 z-40 w-52 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 text-xs">
                  <div className="px-2 py-1.5 border-b border-slate-800 mb-1 flex items-center justify-between text-slate-300 font-bold">
                    <span>Floor Audio</span>
                    <span className="text-[10px] text-slate-500">
                      {soundMutedState ? "Muted" : "Active"}
                    </span>
                  </div>

                  {soundMutedState ? (
                    <button
                      type="button"
                      onClick={handleUnmute}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-emerald-400 font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <i className="fa-solid fa-volume-high text-xs" />
                      <span>Turn Sound Back On</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleToggleSound}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-rose-400 font-semibold flex items-center gap-2 cursor-pointer"
                    >
                      <i className="fa-solid fa-bell-slash text-xs" />
                      <span>Mute Sound</span>
                    </button>
                  )}

                  <div className="pt-1.5 mt-1 border-t border-slate-800 text-[11px] text-slate-400 font-medium">
                    <span className="block px-2 py-0.5 text-[10px] uppercase font-bold text-slate-500">
                      Snooze Chimes
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSnooze(15)}
                      className="w-full text-left px-2.5 py-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
                    >
                      Snooze 15 Mins
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSnooze(30)}
                      className="w-full text-left px-2.5 py-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
                    >
                      Snooze 30 Mins
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSnooze(60)}
                      className="w-full text-left px-2.5 py-1 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
                    >
                      Snooze 1 Hour
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick Refresh */}
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              fetchDashboardData(false);
            }}
            className="w-9 h-9 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors cursor-pointer"
            title="Refresh Floor Sync"
          >
            <i className="fa-solid fa-rotate text-xs" />
          </button>

          {/* Logout / Switch Staff */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl border border-slate-750 bg-slate-800/80 hover:bg-rose-950/40 hover:border-rose-700 hover:text-rose-400 flex items-center justify-center text-slate-400 transition-colors cursor-pointer"
            title="Switch Staff / Logout"
          >
            <i className="fa-solid fa-arrow-right-from-bracket text-xs" />
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. URGENT ALERT BANNERS (Floor Calls & Order Approvals)
         ───────────────────────────────────────────────────────────── */}
      {/* 2A: Urgent Waiter Call Buzzer (Active across all tabs) */}
      {waiterCalls.length > 0 && (
        <div className="bg-rose-600 px-3.5 sm:px-6 py-2.5 border-b border-rose-500 text-white flex flex-col sm:flex-row items-center justify-between gap-2.5 shadow-lg animate-pulse">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl">🛎️</span>
            <div className="min-w-0">
              <span className="font-extrabold text-sm tracking-tight block">
                Table {waiterCalls[0].tableNumber} is Calling!
              </span>
              <span className="text-xs text-rose-100 font-medium truncate block">
                {waiterCalls[0].type
                  ? `Guest requested: ${waiterCalls[0].type.toUpperCase()}`
                  : "Guest pressed Call Waiter"}
                {waiterCalls[0].customNote ? ` · "${waiterCalls[0].customNote}"` : ""}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleAcknowledgeCall(waiterCalls[0].id)}
              className="flex-1 sm:flex-none px-4 py-1.5 rounded-xl bg-white text-rose-700 font-bold text-xs shadow hover:bg-rose-50 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <i className="fa-solid fa-check text-xs" />
              <span>Acknowledge</span>
            </button>
            {waiterCalls.length > 1 && (
              <button
                type="button"
                onClick={() => setActiveTab("calls")}
                className="px-3 py-1.5 rounded-xl bg-rose-700 text-white font-bold text-xs hover:bg-rose-800 cursor-pointer"
              >
                +{waiterCalls.length - 1} More
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2B: Pending Approval Sticky Notice (When in floor tab) */}
      {activeTab === "floor" && approvalsCount > 0 && (
        <div
          onClick={() => setActiveTab("approvals")}
          className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-amber-300 text-xs font-bold cursor-pointer hover:bg-amber-500/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>
              {approvalsCount} Guest {approvalsCount === 1 ? "Order" : "Orders"} Waiting for Approval
            </span>
          </div>
          <span className="text-[11px] underline flex items-center gap-1">
            <span>Review & Approve</span>
            <i className="fa-solid fa-arrow-right text-[10px]" />
          </span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. SEGMENTED TAB SELECTOR (Floor | Online | Approvals | Calls)
         ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border-b border-slate-800 px-2.5 sm:px-5 py-2">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 max-w-2xl mx-auto">
          {/* Tab 1: Floor Tables */}
          <button
            type="button"
            onClick={() => setActiveTab("floor")}
            className={`py-2 px-1 sm:px-2.5 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
              activeTab === "floor"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <span>🪑 Floor</span>
            <span
              className={`text-[9px] sm:text-[10px] font-mono px-1 sm:px-1.5 py-0.2 rounded-full ${
                activeTab === "floor"
                  ? "bg-slate-950/20 text-slate-950 font-bold"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              {occupiedCount}/{physicalTables.length}
            </span>
          </button>

          {/* Tab 2: Dedicated Online Orders */}
          <button
            type="button"
            onClick={() => setActiveTab("online")}
            className={`py-2 px-1 sm:px-2.5 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 transition-all cursor-pointer relative ${
              activeTab === "online"
                ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <span>🛵 Online</span>
            {onlineOrders.active.length > 0 ? (
              <span className="bg-emerald-400 text-slate-950 text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                {onlineOrders.active.length}
              </span>
            ) : (
              <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono">
                {onlineOrders.completed.length}
              </span>
            )}
          </button>

          {/* Tab 3: Approvals Queue */}
          <button
            type="button"
            onClick={() => setActiveTab("approvals")}
            className={`py-2 px-1 sm:px-2.5 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 transition-all cursor-pointer relative ${
              activeTab === "approvals"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <span>⚡ Approvals</span>
            {approvalsCount > 0 ? (
              <span className="bg-amber-400 text-slate-950 text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full animate-bounce">
                {approvalsCount}
              </span>
            ) : (
              <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono">0</span>
            )}
          </button>

          {/* Tab 4: Waiter Calls */}
          <button
            type="button"
            onClick={() => setActiveTab("calls")}
            className={`py-2 px-1 sm:px-2.5 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 transition-all cursor-pointer relative ${
              activeTab === "calls"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <span>🔔 Buzzers</span>
            {callsCount > 0 ? (
              <span className="bg-rose-500 text-white text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                {callsCount}
              </span>
            ) : (
              <span className="text-[9px] sm:text-[10px] text-slate-500 font-mono">0</span>
            )}
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. MAIN VIEW CONTENT (Based on activeTab)
         ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 p-3.5 sm:p-5 max-w-5xl mx-auto w-full">
        {/* ═══════════════════════════════════════════════════════════
            TAB A: FLOOR TABLES
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === "floor" && (
          <div className="space-y-4">
            {/* Filter Chips & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { key: "all", label: `All (${tables.length})` },
                  { key: "occupied", label: `Occupied (${occupiedCount})` },
                  { key: "calling", label: `Calling (${callsCount})` },
                  { key: "empty", label: `Empty (${tables.length - occupiedCount})` },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFloorFilter(f.key as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      floorFilter === f.key
                        ? "bg-slate-100 text-slate-950 font-black"
                        : "bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Fast Search Filter */}
              <div className="relative min-w-[220px]">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
                <input
                  type="text"
                  placeholder="Filter table or dish..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Tables Grid */}
            {isLoading ? (
              <div className="py-20 text-center text-slate-500 space-y-2">
                <i className="fa-solid fa-circle-notch fa-spin text-2xl text-amber-500" />
                <p className="text-xs font-medium">Syncing Floor Tables...</p>
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-2xl p-6">
                <p className="text-sm font-bold text-slate-400">No tables match your filter</p>
                <button
                  type="button"
                  onClick={() => {
                    setFloorFilter("all");
                    setSearchQuery("");
                  }}
                  className="mt-2 text-xs font-bold text-amber-400 underline cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredTables.map((table) => {
                  const ord = tableOrderMap.get(table.id) || tableOrderMap.get(table.table_number);
                  const isOccupied = Boolean(ord) || table.status === "occupied";
                  const isCalling = callingTableNumbers.has(table.table_number.trim().toUpperCase());

                  // Calculate order summary
                  const items = ord?.order_items || [];
                  const totalAmt = items.reduce(
                    (sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.qty) || 1),
                    0
                  );
                  const totalDishes = items.reduce(
                    (sum, it) => sum + (Number(it.qty) || 1),
                    0
                  );

                  // Elapsed dining time
                  let diningMins = 0;
                  if (ord?.opened_at) {
                    diningMins = Math.max(
                      1,
                      Math.floor((Date.now() - new Date(ord.opened_at).getTime()) / (1000 * 60))
                    );
                  }

                  return (
                    <div
                      key={table.id}
                      className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                        isCalling
                          ? "bg-rose-950/30 border-rose-500/80 shadow-lg shadow-rose-950/50 ring-2 ring-rose-500/50"
                          : isOccupied
                          ? "bg-slate-900 border-slate-750 hover:border-slate-650 shadow-md"
                          : "bg-slate-900/40 border-slate-800/80 text-slate-400"
                      }`}
                    >
                      {/* Card Header: Table Number & Status Pill */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                              Table {table.table_number}
                            </span>
                            {isCalling && (
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                            )}
                          </div>

                          {isCalling ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[10px] uppercase tracking-wider animate-pulse flex items-center gap-1">
                              <i className="fa-solid fa-bell text-[9px]" />
                              <span>Calling</span>
                            </span>
                          ) : isOccupied ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Occupied</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                              Vacant
                            </span>
                          )}
                        </div>

                        {/* Occupied State Details */}
                        {isOccupied && ord ? (
                          <div className="space-y-2 mb-3.5">
                            {/* Seated duration & running total */}
                            <div className="flex items-center justify-between text-xs bg-slate-950/60 rounded-xl px-3 py-2 border border-slate-800/70">
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <i className="fa-regular fa-clock text-[11px]" />
                                <span>{diningMins}m on table</span>
                              </div>
                              <div className="font-extrabold text-amber-400 text-sm">
                                ₹{totalAmt}
                              </div>
                            </div>

                            {/* Dish Items Breakdown (Up to 3 items) */}
                            <div className="space-y-1">
                              {items.slice(0, 3).map((it) => (
                                <div
                                  key={it.id}
                                  className="text-[11px] flex items-center justify-between text-slate-300"
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        it.menu_items?.is_veg ? "bg-emerald-400" : "bg-rose-400"
                                      }`}
                                    />
                                    <span className="truncate">
                                      {it.qty}× {it.menu_items?.name || "Dish"}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                      it.item_status === "served"
                                        ? "bg-emerald-500/20 text-emerald-300"
                                        : it.item_status === "preparing"
                                        ? "bg-amber-500/20 text-amber-300"
                                        : "bg-slate-800 text-slate-400"
                                    }`}
                                  >
                                    {it.item_status}
                                  </span>
                                </div>
                              ))}
                              {items.length > 3 && (
                                <p className="text-[10px] text-slate-500 font-medium">
                                  +{items.length - 3} more dishes in order...
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 text-center text-xs text-slate-500 font-medium">
                            Table is clean & ready for guests
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                        {isOccupied && ord ? (
                          <>
                            {/* 1-Tap Edit Running Order */}
                            <button
                              type="button"
                              onClick={() => {
                                unlockAudio();
                                setEditingOrder({
                                  orderId: ord.id,
                                  tableNumber: table.table_number,
                                });
                              }}
                              className="flex-1 py-2 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                            >
                              <i className="fa-solid fa-pen-to-square text-xs" />
                              <span>Edit</span>
                            </button>

                            {/* Shift Table */}
                            <button
                              type="button"
                              onClick={() => {
                                unlockAudio();
                                setTransferModal({
                                  isOpen: true,
                                  table,
                                  mode: "shift",
                                });
                              }}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-400 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
                              title="Shift Table (Move party to another table)"
                            >
                              <i className="fa-solid fa-arrow-right-arrow-left text-xs" />
                            </button>

                            {/* Join Table */}
                            <button
                              type="button"
                              onClick={() => {
                                unlockAudio();
                                setTransferModal({
                                  isOpen: true,
                                  table,
                                  mode: "join",
                                });
                              }}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-purple-400 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
                              title="Join Table (Merge for group dining)"
                            >
                              <i className="fa-solid fa-link text-xs" />
                            </button>

                            {/* View Bill Summary & Settle */}
                            <button
                              type="button"
                              onClick={() => setViewingBillOrder(ord)}
                              className="py-2 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                              title="Settle Bill & Free Table"
                            >
                              <i className="fa-solid fa-receipt text-xs" />
                              <span>Settle</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePunchQuickOrder(table)}
                            className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs border border-slate-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <i className="fa-solid fa-plus text-xs text-amber-400" />
                            <span>Punch Order</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB ONLINE: DEDICATED ONLINE ORDERS (Delivery & Pickup)
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === "online" && (
          <div className="space-y-4 max-w-4xl mx-auto">
            {/* Header & Mini Sub-filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-white">
                    🛵 Online & Direct Orders
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Direct Store
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Delivery and takeaway orders separated from dining room floor
                </p>
              </div>

              {/* Sub-filter pills: Active vs Completed */}
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setOnlineFilter("active")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    onlineFilter === "active"
                      ? "bg-emerald-500 text-slate-950 font-black shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>🔥 Running</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      onlineFilter === "active"
                        ? "bg-slate-950/20 text-slate-950"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {onlineOrders.active.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOnlineFilter("completed")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    onlineFilter === "completed"
                      ? "bg-slate-100 text-slate-950 font-black shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>✅ Completed</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      onlineFilter === "completed"
                        ? "bg-slate-900 text-slate-950"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {onlineOrders.completed.length}
                  </span>
                </button>
              </div>
            </div>

            {/* List View */}
            {onlineFilter === "active" ? (
              onlineOrders.active.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl p-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl mx-auto">
                    🛵
                  </div>
                  <h3 className="text-sm font-bold text-white">No Active Online Orders</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    When customers place home delivery or pickup orders from your digital store, they will appear here separately from table orders.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {onlineOrders.active.map((ord) => {
                    const elapsed = Math.floor(
                      (Date.now() - new Date(ord.openedAt).getTime()) / 60000
                    );
                    const isSettlingThis = isSettlingOnlineId === ord.id;

                    return (
                      <div
                        key={ord.id}
                        className="rounded-2xl border border-slate-800 bg-slate-900/95 p-4 shadow-xl flex flex-col justify-between gap-3 relative overflow-hidden"
                      >
                        {/* Top Indicator Strip */}
                        <div
                          className={`absolute top-0 left-0 right-0 h-1 ${
                            ord.stage === "ready"
                              ? "bg-emerald-500"
                              : ord.stage === "preparing"
                              ? "bg-amber-500 animate-pulse"
                              : "bg-cyan-500"
                          }`}
                        />

                        {/* Order Header */}
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                                  ord.type === "pickup"
                                    ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                }`}
                              >
                                {ord.type === "pickup" ? "🛍️ Takeaway" : "🛵 Delivery"}
                              </span>
                              <span className="text-xs font-mono font-extrabold text-white">
                                #{ord.orderNumber}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              {elapsed < 1 ? "Just now" : `${elapsed}m ago`}
                            </span>
                          </div>

                          {/* Customer & Destination */}
                          <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-extrabold text-white">
                                {ord.customerName}
                              </span>
                              {ord.customerPhone && (
                                <a
                                  href={`tel:${ord.customerPhone}`}
                                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20"
                                >
                                  <i className="fa-solid fa-phone text-[9px]" />
                                  <span>{ord.customerPhone}</span>
                                </a>
                              )}
                            </div>
                            {ord.type === "delivery" && ord.deliveryAddress && (
                              <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-slate-900 mt-1">
                                <p className="text-[11px] text-slate-400 flex items-start gap-1 leading-snug min-w-0">
                                  <span className="text-rose-400 shrink-0">📍</span>
                                  <span className="truncate">{ord.deliveryAddress}</span>
                                </p>
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${
                                    ord.customerCoords
                                      ? `${ord.customerCoords.lat},${ord.customerCoords.lng}`
                                      : encodeURIComponent(ord.deliveryAddress)
                                  }`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0 active:scale-95 transition-all shadow-xs"
                                  title="Navigate using Google Maps"
                                >
                                  <span>🧭 Maps</span>
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Order Stage Badge */}
                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                ord.stage === "ready"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : ord.stage === "preparing"
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                                  : "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {ord.stage === "ready"
                                ? "✅ Ready for Handover"
                                : ord.stage === "preparing"
                                ? "🔥 Cooking in Kitchen"
                                : "⏳ Order Placed"}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {ord.items.length} items
                            </span>
                          </div>

                          {/* Dishes Mini List */}
                          <div className="mt-2.5 space-y-1 bg-slate-950/40 rounded-xl p-2.5 border border-slate-800/80 max-h-36 overflow-y-auto">
                            {ord.items.map((it, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-xs text-slate-300"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                      it.isVeg ? "bg-emerald-400" : "bg-rose-400"
                                    }`}
                                  />
                                  <span className="font-medium truncate">
                                    {it.qty}× {it.name}
                                  </span>
                                </div>
                                <span className="font-mono text-[11px] text-slate-400 shrink-0">
                                  ₹{it.price * it.qty}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Bill Amount & Settle Actions */}
                        <div className="pt-2 border-t border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                                Total Bill
                              </span>
                              <span className="text-base font-black text-white font-mono">
                                ₹{ord.totalAmount}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                ord.paymentStatus === "paid"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              }`}
                            >
                              {ord.paymentStatus === "paid"
                                ? "Paid"
                                : "Collect at Delivery"}
                            </span>
                          </div>

                          {/* Rider Dispatch Control for Home Delivery */}
                          {ord.type === "delivery" && (
                            <div className="pt-2 border-t border-slate-800/80">
                              {ord.dispatch?.riderName ? (
                                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                                  <div className="flex items-center gap-2 min-w-0 text-xs">
                                    <span className="text-base">🛵</span>
                                    <div className="min-w-0">
                                      <span className="text-[10px] text-emerald-400 font-bold uppercase block font-mono">
                                        Assigned Rider
                                      </span>
                                      <span className="text-white font-bold truncate block">
                                        {ord.dispatch.riderName}{" "}
                                        {ord.dispatch.riderPhone && `(${ord.dispatch.riderPhone})`}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDispatchModalOrder(ord);
                                      setRiderNameInput(ord.dispatch?.riderName || "");
                                      setRiderPhoneInput(ord.dispatch?.riderPhone || "");
                                    }}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <i className="fa-brands fa-whatsapp text-xs" />
                                    <span>Resend</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDispatchModalOrder(ord);
                                    setRiderNameInput("");
                                    setRiderPhoneInput("");
                                  }}
                                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                                >
                                  <i className="fa-brands fa-whatsapp text-base text-emerald-200" />
                                  <span>Assign & WhatsApp Delivery Rider</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Quick 1-Tap Settle Buttons */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button
                              type="button"
                              disabled={isSettlingThis}
                              onClick={() => handleSettleOnlineOrder(ord, "cash")}
                              className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              {isSettlingThis ? (
                                <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                              ) : (
                                <i className="fa-solid fa-money-bill-wave text-xs" />
                              )}
                              <span>Cash Settled</span>
                            </button>

                            <button
                              type="button"
                              disabled={isSettlingThis}
                              onClick={() => handleSettleOnlineOrder(ord, "upi")}
                              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 disabled:opacity-50 text-cyan-300 font-bold text-xs border border-cyan-500/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              {isSettlingThis ? (
                                <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                              ) : (
                                <i className="fa-solid fa-qrcode text-xs" />
                              )}
                              <span>UPI Settled</span>
                            </button>
                          </div>

                          {/* Cancel / Reject Order Action */}
                          <div className="pt-1 flex items-center justify-between text-xs">
                            <Link
                              href="/delivery"
                              target="_blank"
                              className="text-[11px] text-slate-400 hover:text-emerald-400 font-medium flex items-center gap-1 transition-colors"
                            >
                              <span>Rider Screen</span>
                              <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
                            </Link>

                            <button
                              type="button"
                              onClick={() => {
                                setCancelModalOrder({ id: ord.id, orderNumber: ord.orderNumber });
                                setCancelReasonText("Item out of stock");
                              }}
                              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer py-1"
                            >
                              <i className="fa-solid fa-ban text-[10px]" />
                              <span>Cancel / Reject Order</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Completed Orders List */
              onlineOrders.completed.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl p-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl mx-auto">
                    ✅
                  </div>
                  <h3 className="text-sm font-bold text-white">No Completed Orders Today</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Orders settled and dispatched today will be archived here for reference.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {onlineOrders.completed.map((ord) => (
                    <div
                      key={ord.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
                          {ord.type === "pickup" ? "🛍️" : "🛵"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs sm:text-sm">
                              #{ord.orderNumber} · {ord.customerName}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400">
                              Delivered
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {ord.items.length} items · Paid via {ord.paymentMode.toUpperCase()}
                            {ord.closedAt && ` · ${new Date(ord.closedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}`}
                          </p>
                        </div>
                      </div>

                      <div className="text-right sm:border-l sm:border-slate-800 sm:pl-4 shrink-0">
                        <span className="text-xs font-extrabold text-white font-mono block">
                          ₹{ord.totalAmount}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-medium">
                          ✓ Settled
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB B: ORDER APPROVALS QUEUE
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === "approvals" && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-white">
                  Incoming Order Approvals ({pendingApprovals.length})
                </h2>
                <p className="text-xs text-slate-400">
                  Customer placed orders requiring floor verification before kitchen fires
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                Oldest First (FIFO)
              </span>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl p-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl mx-auto">
                  ✅
                </div>
                <h3 className="text-sm font-bold text-white">All Orders Approved!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No orders are currently waiting. When guests scan the table QR code and place an order, it will appear here immediately.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("floor")}
                  className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs cursor-pointer"
                >
                  Return to Floor Tables
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {pendingApprovals.map((batch) => {
                  const elapsedSec = Math.floor(
                    (Date.now() - new Date(batch.createdAt).getTime()) / 1000
                  );
                  const isProcessing = approvingBatchIds[batch.id];

                  // Find matching open order to show dish items
                  const matchingOrder = openOrders.find((o) => o.id === batch.orderId);
                  const pendingItems = (matchingOrder?.order_items || []).filter(
                    (i) => i.item_status === "pending" || batch.itemIds.includes(i.id)
                  );

                  return (
                    <div
                      key={batch.id}
                      className="rounded-2xl border-2 border-amber-500/60 bg-slate-900 p-4 shadow-xl space-y-3"
                    >
                      {/* Batch Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-lg shrink-0">
                            {batch.tableNumber}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-black text-white">
                                Table {batch.tableNumber}
                              </h3>
                              <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                {elapsedSec < 60 ? `${elapsedSec}s ago` : `${Math.floor(elapsedSec / 60)}m ago`}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">
                              {batch.customerName || "Floor Guest"} · {batch.totalItems} Items · ₹{batch.totalAmount}
                            </p>
                          </div>
                        </div>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => {
                            unlockAudio();
                            setEditingOrder({
                              orderId: batch.orderId,
                              tableNumber: batch.tableNumber,
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                        >
                          <i className="fa-solid fa-pen-to-square text-xs text-amber-400" />
                          <span>Edit Dishes</span>
                        </button>
                      </div>

                      {/* Items Preview */}
                      <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-1.5">
                        {pendingItems.length > 0 ? (
                          pendingItems.map((it) => (
                            <div
                              key={it.id}
                              className="text-xs flex items-center justify-between text-slate-300"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    it.menu_items?.is_veg ? "bg-emerald-400" : "bg-rose-400"
                                  }`}
                                />
                                <span className="font-semibold truncate">
                                  {it.qty}× {it.menu_items?.name || "Dish"}
                                </span>
                                {it.notes && (
                                  <span className="text-[10px] text-amber-300/80 italic truncate">
                                    "{it.notes}"
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-slate-400 shrink-0">
                                ₹{(Number(it.unit_price) || 0) * (Number(it.qty) || 1)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400">
                            {batch.totalItems} items awaiting confirmation
                          </div>
                        )}
                      </div>

                      {/* Action Buttons: 1-Tap Approve & Reject */}
                      <div className="flex items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleApproveBatch(batch)}
                          className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-sm shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          {isProcessing ? (
                            <>
                              <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                              <span>Firing to Kitchen...</span>
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-check text-base" />
                              <span>Approve & Send to Kitchen</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRejectingBatch(batch);
                            setRejectReason("");
                          }}
                          className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-rose-950/40 hover:border-rose-700 hover:text-rose-400 text-slate-400 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB C: GUEST BUZZER CALLS
           ═══════════════════════════════════════════════════════════ */}
        {activeTab === "calls" && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-white">
                  Table Buzzers & Guest Requests ({waiterCalls.length})
                </h2>
                <p className="text-xs text-slate-400">
                  Assistance requests initiated from dining tables
                </p>
              </div>
            </div>

            {waiterCalls.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl p-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl mx-auto">
                  🔔
                </div>
                <h3 className="text-sm font-bold text-white">No Active Calls</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When a guest presses the "Call Waiter" button on their digital menu, an alert chime will sound and the table will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {waiterCalls.map((call) => {
                  const elapsed = Math.floor(
                    (Date.now() - new Date(call.createdAt).getTime()) / 1000
                  );
                  const elapsedFormatted =
                    elapsed < 60 ? `${elapsed}s ago` : `${Math.floor(elapsed / 60)}m ago`;

                  const callEmoji =
                    call.type === "water"
                      ? "💧 Water"
                      : call.type === "bill"
                      ? "🧾 Bill Request"
                      : call.type === "clean"
                      ? "✨ Clean Table"
                      : "🛎️ Waiter Assistance";

                  return (
                    <div
                      key={call.id}
                      className="rounded-2xl border-2 border-rose-500/80 bg-rose-950/20 p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 font-black text-xl shrink-0">
                          {call.tableNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-white">
                              Table {call.tableNumber}
                            </h3>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                              {elapsedFormatted}
                            </span>
                          </div>
                          <p className="text-sm font-extrabold text-rose-300 mt-0.5">
                            {callEmoji}
                          </p>
                          {call.customNote && (
                            <p className="text-xs text-slate-300 italic mt-1 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-800">
                              "{call.customNote}"
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAcknowledgeCall(call.id)}
                        className="py-3 px-5 rounded-xl bg-white hover:bg-rose-50 text-rose-800 font-black text-sm shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                      >
                        <i className="fa-solid fa-check text-base" />
                        <span>Acknowledge & Dismiss</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ─────────────────────────────────────────────────────────────
          5. BILL SUMMARY MODAL
         ───────────────────────────────────────────────────────────── */}
      {viewingBillOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-750 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-black text-white">
                  Table {viewingBillOrder.restaurant_tables?.table_number || "T--"} Bill Summary
                </h3>
                <p className="text-xs text-slate-400">
                  {viewingBillOrder.order_items.length} items ordered
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingBillOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Items Receipt */}
            <div className="space-y-2 py-2">
              {viewingBillOrder.order_items.map((it) => (
                <div key={it.id} className="text-xs flex items-center justify-between text-slate-300">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        it.menu_items?.is_veg ? "bg-emerald-400" : "bg-rose-400"
                      }`}
                    />
                    <span>
                      {it.qty}× {it.menu_items?.name || "Dish"}
                    </span>
                  </div>
                  <span className="font-mono text-slate-200">
                    ₹{(Number(it.unit_price) || 0) * (Number(it.qty) || 1)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-300">Total Amount</span>
              <span className="text-xl font-black text-amber-400 font-mono">
                ₹
                {viewingBillOrder.order_items.reduce(
                  (sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.qty) || 1),
                  0
                )}
              </span>
            </div>

            {/* Settle & Free Table Actions */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Select Settlement Mode to Free Table:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isSettling}
                  onClick={() =>
                    handleSettleAndFreeTable(
                      viewingBillOrder.id,
                      viewingBillOrder.restaurant_tables?.table_number || "",
                      "cash"
                    )
                  }
                  className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <i className="fa-solid fa-money-bill-wave text-xs" />
                  <span>{isSettling ? "Settling..." : "💵 Cash Settle"}</span>
                </button>
                <button
                  type="button"
                  disabled={isSettling}
                  onClick={() =>
                    handleSettleAndFreeTable(
                      viewingBillOrder.id,
                      viewingBillOrder.restaurant_tables?.table_number || "",
                      "upi"
                    )
                  }
                  className="py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <i className="fa-solid fa-qrcode text-xs" />
                  <span>{isSettling ? "Settling..." : "📱 UPI Paid"}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={isSettling}
              onClick={() => setViewingBillOrder(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 font-bold text-xs cursor-pointer mt-1"
            >
              Cancel / Close
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. REJECT ORDER MODAL
         ───────────────────────────────────────────────────────────── */}
      {rejectingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-750 rounded-3xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-white">
              Decline Table {rejectingBatch.tableNumber} Order?
            </h3>
            <p className="text-xs text-slate-400">
              Please choose or provide a quick reason to inform the guest.
            </p>

            {/* Quick Reason Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                "Item out of stock",
                "Kitchen at capacity",
                "Closing soon",
                "Wrong table scanned",
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectReason(reason)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                    rejectReason === reason
                      ? "bg-rose-500/20 border-rose-500 text-rose-300"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Or type custom reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-rose-500"
            />

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingBatch(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-750 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRejecting}
                onClick={handleConfirmReject}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow cursor-pointer disabled:opacity-50"
              >
                {isRejecting ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. EDIT RUNNING ORDER MODAL (Add / Edit / Remove Dishes)
         ───────────────────────────────────────────────────────────── */}
      {editingOrder && (
        <EditRunningOrderModal
          isOpen={Boolean(editingOrder)}
          onClose={() => setEditingOrder(null)}
          orderId={editingOrder.orderId}
          tableNumber={editingOrder.tableNumber}
          menuItems={menuItems}
          onOrderUpdated={() => fetchDashboardData(false)}
          onTriggerUndoToast={(item) => setRemovedItemForUndo(item)}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. 5-SECOND FLOATING UNDO TOAST FOR ITEM REMOVAL
         ───────────────────────────────────────────────────────────── */}
      <UndoItemToast
        item={removedItemForUndo}
        onUndo={(it) => handleUndoRestore(it)}
        onDismiss={() => setRemovedItemForUndo(null)}
      />

      {/* ─────────────────────────────────────────────────────────────
          9. SHIFT & JOIN TABLE MODAL
         ───────────────────────────────────────────────────────────── */}
      {transferModal.isOpen && transferModal.table && (
        <TableTransferModal
          isOpen={transferModal.isOpen}
          onClose={() => setTransferModal({ isOpen: false, table: null, mode: "shift" })}
          sourceTable={transferModal.table}
          allTables={tables}
          mode={transferModal.mode}
          onSuccess={() => fetchDashboardData(true)}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          10. RIDER WHATSAPP DISPATCH MODAL
         ───────────────────────────────────────────────────────────── */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-left shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
                  🛵
                </span>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Dispatch to Delivery Rider
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Order #{dispatchModalOrder.orderNumber} · {dispatchModalOrder.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick Select Saved Rider */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1.5">
                Quick Select Saved Rider
              </label>
              <div className="flex flex-wrap gap-1.5">
                {savedRiders.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setRiderNameInput(r.name);
                      if (r.phone) setRiderPhoneInput(r.phone);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      riderNameInput === r.name
                        ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm"
                        : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800"
                    }`}
                  >
                    🛵 {r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Rider Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">
                  Rider Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Rider"
                  value={riderNameInput}
                  onChange={(e) => setRiderNameInput(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={riderPhoneInput}
                  onChange={(e) => setRiderPhoneInput(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Briefing Preview Card */}
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800/90 text-xs space-y-1.5 font-sans">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Customer: <strong className="text-white">{dispatchModalOrder.customerName}</strong></span>
                <span>Phone: <strong className="text-white">{dispatchModalOrder.customerPhone || "N/A"}</strong></span>
              </div>
              <div className="text-[11px] text-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Address:</span>
                <span className="line-clamp-2">{dispatchModalOrder.deliveryAddress || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-800 text-slate-400 text-[11px]">
                <span>{dispatchModalOrder.items.length} Food items</span>
                <span className="font-bold text-white">
                  Amount: ₹{dispatchModalOrder.totalAmount} ({dispatchModalOrder.paymentStatus === "paid" ? "Paid" : "Collect Cash"})
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDispatchModalOrder(null)}
                className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isDispatchingRider || !riderNameInput.trim()}
                onClick={() => handleDispatchRider(dispatchModalOrder, riderNameInput, riderPhoneInput)}
                className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
              >
                {isDispatchingRider ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                ) : (
                  <i className="fa-brands fa-whatsapp text-base text-emerald-200" />
                )}
                <span>Send on WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          11. CANCEL / REJECT ORDER MODAL (Staff Action)
         ───────────────────────────────────────────────────────────── */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 text-left shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-lg shrink-0">
                ❌
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Cancel / Reject Order?</h3>
                <p className="text-[11px] text-slate-400 font-mono">Order #{cancelModalOrder.orderNumber}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block">
                Select Reason
              </label>
              <div className="space-y-1.5">
                {[
                  "Item out of stock",
                  "Customer requested cancellation",
                  "Delivery address out of range / unreachable",
                  "Kitchen closed / cannot fulfill",
                ].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setCancelReasonText(r)}
                    className={`w-full p-2.5 rounded-xl text-xs font-semibold text-left border transition-all cursor-pointer ${
                      cancelReasonText === r
                        ? "bg-rose-950/60 border-rose-500/60 text-rose-200 shadow-xs"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={isCancellingOrder}
                onClick={() => setCancelModalOrder(null)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={isCancellingOrder}
                onClick={() => handleCancelOrder(cancelModalOrder.id, cancelReasonText)}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
              >
                {isCancellingOrder ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                ) : (
                  <i className="fa-solid fa-ban text-xs" />
                )}
                <span>Cancel Order</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
