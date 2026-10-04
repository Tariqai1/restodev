"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import QRCode from "qrcode";

interface OnlineOrderTicket {
  id: string;
  order_type?: "delivery" | "pickup" | "dine_in";
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  restaurant_tables?: { table_number: string };
  status: string;
  opened_at?: string;
  prepEstimate?: number | null;
  order_items: Array<{
    id: string;
    qty: number;
    unit_price?: number;
    item_status: string;
    notes?: string;
    menu_items?: {
      id?: string;
      name: string;
      price?: number;
      is_veg?: boolean;
    };
  }>;
}

interface DeliveryConfig {
  onlineOrderingEnabled: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryRadiusKm: number;
  deliveryFee: number;
  minimumOrderAmount: number;
  estimatedPrepMinutes: number;
  slug: string;
}

interface OnlineOrdersViewProps {
  restaurantId: string;
  restaurantName: string;
  onGoToSettings?: () => void;
}

export default function OnlineOrdersView({
  restaurantId,
  restaurantName,
  onGoToSettings,
}: OnlineOrdersViewProps) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OnlineOrderTicket[]>([]);
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig>({
    onlineOrderingEnabled: true,
    pickupEnabled: true,
    deliveryEnabled: true,
    deliveryRadiusKm: 5,
    deliveryFee: 30,
    minimumOrderAmount: 150,
    estimatedPrepMinutes: 25,
    slug: "",
  });

  const [filterType, setFilterType] = useState<"all" | "delivery" | "pickup">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "preparing" | "ready" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState<string | null>(null);

  // QR Modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  const origin = typeof window !== "undefined" ? window.location.origin : "https://orderdesk.app";
  const storeSlug = deliveryConfig.slug.trim() || restaurantId || "store";
  const storefrontUrl = `${origin}/r/${storeSlug}`;

  // Fetch Delivery Settings & Kitchen Tickets
  const loadData = useCallback(async () => {
    try {
      const [settingsRes, kitchenRes] = await Promise.all([
        fetch(`/api/restaurant/delivery?restaurantId=${restaurantId}`),
        fetch("/api/kitchen"),
      ]);

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        if (sData.settings) {
          setDeliveryConfig({
            onlineOrderingEnabled: Boolean(sData.settings.onlineOrderingEnabled),
            pickupEnabled: sData.settings.pickupEnabled !== false,
            deliveryEnabled: sData.settings.deliveryEnabled !== false,
            deliveryRadiusKm: Number(sData.settings.deliveryRadiusKm) || 5,
            deliveryFee: Number(sData.settings.deliveryFee) || 0,
            minimumOrderAmount: Number(sData.settings.minimumOrderAmount) || 0,
            estimatedPrepMinutes: Number(sData.settings.estimatedPrepMinutes) || 25,
            slug: sData.settings.slug || sData.restaurant?.slug || "",
          });
        }
      }

      if (kitchenRes.ok) {
        const kData = await kitchenRes.json();
        if (Array.isArray(kData.tickets)) {
          setOrders(kData.tickets);
        }
      }
    } catch (err) {
      console.error("Failed to load online orders data:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 12000); // Polling for live orders
    return () => clearInterval(interval);
  }, [loadData]);

  // Generate QR on demand
  useEffect(() => {
    if (storefrontUrl) {
      QRCode.toDataURL(storefrontUrl, {
        width: 450,
        margin: 2,
        color: { dark: "#1e1b4b", light: "#ffffff" },
      })
        .then(setQrCodeUrl)
        .catch(() => {});
    }
  }, [storefrontUrl]);

  // Toggle Online Store Status
  const handleToggleOnlineStore = async () => {
    setIsTogglingStatus(true);
    const newStatus = !deliveryConfig.onlineOrderingEnabled;
    try {
      const res = await fetch("/api/restaurant/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          onlineOrderingEnabled: newStatus,
          slug: deliveryConfig.slug,
          deliveryFee: deliveryConfig.deliveryFee,
          minimumOrderAmount: deliveryConfig.minimumOrderAmount,
          deliveryRadiusKm: deliveryConfig.deliveryRadiusKm,
          estimatedPrepMinutes: deliveryConfig.estimatedPrepMinutes,
        }),
      });
      if (res.ok) {
        setDeliveryConfig((prev) => ({ ...prev, onlineOrderingEnabled: newStatus }));
      }
    } catch (err) {
      console.error("Failed to toggle online store:", err);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Copy Storefront Link
  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(storefrontUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // WhatsApp Share
  const handleShareWhatsApp = () => {
    const text = `Hello! Order delicious food directly from *${restaurantName}*.\n\nBrowse full menu & get hot delivery at your doorstep:\n👉 ${storefrontUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Advance Order Status
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: "preparing" | "served") => {
    setIsUpdatingOrder(orderId);
    try {
      const res = await fetch("/api/kitchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          markAllStatus: nextStatus,
        }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error("Failed to advance order:", err);
    } finally {
      setIsUpdatingOrder(null);
    }
  };

  // Download QR Code image
  const handleDownloadQr = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `${storeSlug}-online-order-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Online Orders
  const onlineOrders = useMemo(() => {
    return orders.filter((o) => {
      const isOnline =
        o.order_type === "delivery" ||
        o.order_type === "pickup" ||
        o.restaurant_tables?.table_number?.includes("DEL-") ||
        o.restaurant_tables?.table_number?.includes("PU-") ||
        o.restaurant_tables?.table_number?.toLowerCase().includes("online") ||
        Boolean(o.customer_phone) ||
        Boolean(o.delivery_address);
      return isOnline;
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return onlineOrders.filter((o) => {
      // Type filter
      if (filterType === "delivery" && o.order_type !== "delivery" && !o.restaurant_tables?.table_number?.includes("DEL-")) {
        return false;
      }
      if (filterType === "pickup" && o.order_type !== "pickup" && !o.restaurant_tables?.table_number?.includes("PU-")) {
        return false;
      }

      // Status filter
      const allServed = o.order_items.length > 0 && o.order_items.every((it) => it.item_status === "served");
      const anyPreparing = o.order_items.some((it) => it.item_status === "preparing");
      const orderStage = allServed ? "ready" : anyPreparing ? "preparing" : "pending";

      if (filterStatus === "pending" && orderStage !== "pending") return false;
      if (filterStatus === "preparing" && orderStage !== "preparing") return false;
      if (filterStatus === "ready" && orderStage !== "ready") return false;
      if (filterStatus === "completed" && o.status !== "completed") return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = o.customer_name?.toLowerCase().includes(q);
        const matchesPhone = o.customer_phone?.toLowerCase().includes(q);
        const matchesId = o.id.toLowerCase().includes(q);
        const matchesAddress = o.delivery_address?.toLowerCase().includes(q);
        const matchesTable = o.restaurant_tables?.table_number?.toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesId || matchesAddress || matchesTable;
      }

      return true;
    });
  }, [onlineOrders, filterType, filterStatus, searchQuery]);

  // Analytics counts
  const deliveryCount = onlineOrders.filter(
    (o) => o.order_type === "delivery" || o.restaurant_tables?.table_number?.includes("DEL-")
  ).length;
  const pickupCount = onlineOrders.filter(
    (o) => o.order_type === "pickup" || o.restaurant_tables?.table_number?.includes("PU-")
  ).length;
  const totalOnlineRevenue = onlineOrders.reduce((sum, o) => {
    const orderSum = o.order_items.reduce((s, it) => s + (Number(it.unit_price || it.menu_items?.price || 0) * (it.qty || 1)), 0);
    return sum + orderSum;
  }, 0);

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* TOP HERO BANNER: STOREFRONT LINK & LIVE SWITCH */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm shadow-xs shrink-0">
                <i className="fa-solid fa-motorcycle" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Online Orders & Storefront Hub
              </h2>
              {/* Status Pill */}
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                  deliveryConfig.onlineOrderingEnabled
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-rose-100 text-rose-800 border border-rose-300"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    deliveryConfig.onlineOrderingEnabled
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-rose-500"
                  }`}
                />
                {deliveryConfig.onlineOrderingEnabled ? "Live & Accepting Orders" : "Store Paused"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Customers can order directly from home without paying 30% aggregator commissions.
            </p>
          </div>

          {/* Quick Actions & Store Controls */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Online/Offline Toggle */}
            <button
              type="button"
              disabled={isTogglingStatus}
              onClick={handleToggleOnlineStore}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 shadow-2xs active:scale-95 ${
                deliveryConfig.onlineOrderingEnabled
                  ? "bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-emerald-200"
              }`}
            >
              <i
                className={`fa-solid ${
                  deliveryConfig.onlineOrderingEnabled ? "fa-pause text-amber-600" : "fa-play"
                }`}
              />
              <span>
                {deliveryConfig.onlineOrderingEnabled ? "Pause Online Store" : "Turn Store Online"}
              </span>
            </button>

            {/* Open Storefront */}
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[11px]" />
              <span>Open Store</span>
            </a>

            {/* Rider Fleet Portal */}
            <a
              href="/delivery"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
              title="Open Delivery Captain & Rider Dispatch Terminal"
            >
              <i className="fa-solid fa-motorcycle text-[11px]" />
              <span>Rider Portal</span>
            </a>

            {/* WhatsApp Share */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="Share store link on WhatsApp"
            >
              <i className="fa-brands fa-whatsapp text-sm" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            {/* QR Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="View & Download Store QR Code"
            >
              <i className="fa-solid fa-qrcode text-slate-600" />
              <span className="hidden sm:inline">Packaging QR</span>
            </button>
          </div>
        </div>

        {/* Public URL Bar */}
        <div className="mt-4 pt-3 border-t border-amber-200/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0 bg-white/80 border border-slate-200 rounded-xl px-3 py-1.5">
            <i className="fa-solid fa-link text-slate-400 text-xs shrink-0" />
            <span className="text-xs font-mono text-slate-700 truncate select-all">
              {storefrontUrl}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                copiedLink
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <i className={`fa-solid ${copiedLink ? "fa-check text-emerald-600" : "fa-copy"}`} />
              <span>{copiedLink ? "Copied Link!" : "Copy Link"}</span>
            </button>

            {onGoToSettings && (
              <button
                type="button"
                onClick={onGoToSettings}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-sliders mr-1" />
                Delivery Settings
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* KPI METRIC CARDS */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Deliveries */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">🛵 Deliveries</span>
            <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-motorcycle" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{deliveryCount}</span>
            <span className="text-[11px] text-slate-400">orders</span>
          </div>
        </div>

        {/* Pickups */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">🥡 Takeaway</span>
            <span className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-bag-shopping" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{pickupCount}</span>
            <span className="text-[11px] text-slate-400">orders</span>
          </div>
        </div>

        {/* Online Sales */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">💰 Online Sales</span>
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-indian-rupee-sign" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">₹{totalOnlineRevenue}</span>
            <span className="text-[11px] text-slate-400">direct</span>
          </div>
        </div>

        {/* Delivery Config Info */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">📍 Coverage & Fee</span>
            <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-map-location-dot" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 text-xs font-bold text-slate-800">
            <span>{deliveryConfig.deliveryRadiusKm} km</span>
            <span className="text-slate-300">·</span>
            <span>₹{deliveryConfig.deliveryFee} fee</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Min ₹{deliveryConfig.minimumOrderAmount}</p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* FILTER TABS & SEARCH BAR */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Type Filter Buttons */}
        <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 gap-1 self-start">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === "all"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Online ({onlineOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("delivery")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === "delivery"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-solid fa-motorcycle text-[10px]" />
            Delivery ({deliveryCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("pickup")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === "pickup"
                ? "bg-purple-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fa-solid fa-bag-shopping text-[10px]" />
            Pickup ({pickupCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative max-w-sm w-full">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Search by customer name, phone, address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* ORDERS LIST / CARDS */}
      {/* ======================================================== */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
          <i className="fa-solid fa-circle-notch fa-spin text-amber-500 text-xl mb-2 block" />
          Loading online orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mx-auto mb-3">
            <i className="fa-solid fa-motorcycle" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Online Orders Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Share your direct online store link on WhatsApp, Instagram bio, or print QR stickers on your takeaway packaging to start receiving orders!
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
            >
              <i className="fa-brands fa-whatsapp text-sm" />
              <span>Share Link on WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
            >
              <i className="fa-solid fa-qrcode" />
              <span>Get Packaging QR</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.map((ord) => {
            const isDelivery =
              ord.order_type === "delivery" ||
              ord.restaurant_tables?.table_number?.includes("DEL-");
            const allServed =
              ord.order_items.length > 0 &&
              ord.order_items.every((it) => it.item_status === "served");
            const anyPreparing = ord.order_items.some((it) => it.item_status === "preparing");
            const orderStage = allServed ? "ready" : anyPreparing ? "preparing" : "pending";

            const orderTotal = ord.order_items.reduce(
              (s, it) =>
                s +
                Number(it.unit_price || it.menu_items?.price || 0) * (it.qty || 1),
              0
            );

            return (
              <div
                key={ord.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                {/* Order Header */}
                <div>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
                          isDelivery
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}
                      >
                        <i className={`fa-solid ${isDelivery ? "fa-motorcycle" : "fa-bag-shopping"}`} />
                        <span>{isDelivery ? "Home Delivery" : "Store Pickup"}</span>
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-500">
                        #{ord.id.slice(0, 6)}
                      </span>
                    </div>

                    {/* Order Stage Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        orderStage === "ready"
                          ? "bg-emerald-100 text-emerald-800"
                          : orderStage === "preparing"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {orderStage === "ready"
                        ? isDelivery ? "Dispatched" : "Ready"
                        : orderStage === "preparing"
                        ? "Cooking"
                        : "Received"}
                    </span>
                  </div>

                  {/* Customer Information */}
                  <div className="mt-3 bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {ord.customer_name || "Online Guest"}
                      </span>
                      {ord.customer_phone && (
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${ord.customer_phone}`}
                            className="text-slate-600 hover:text-slate-900 transition-colors"
                            title="Call Customer"
                          >
                            <i className="fa-solid fa-phone text-xs" />
                          </a>
                          <a
                            href={`https://wa.me/91${ord.customer_phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-700"
                            title="WhatsApp Customer"
                          >
                            <i className="fa-brands fa-whatsapp text-sm" />
                          </a>
                          <span className="font-mono text-slate-600">{ord.customer_phone}</span>
                        </div>
                      )}
                    </div>

                    {isDelivery && ord.delivery_address && (
                      <div className="flex items-start gap-1.5 text-slate-600 pt-1 border-t border-slate-200/60">
                        <i className="fa-solid fa-location-dot text-rose-500 text-xs mt-0.5 shrink-0" />
                        <span className="line-clamp-2 leading-relaxed">
                          {ord.delivery_address}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Items List */}
                  <div className="mt-3 space-y-2">
                    {ord.order_items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-xs py-1 border-b border-dashed border-slate-100 last:border-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              it.menu_items?.is_veg ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          <span className="font-semibold text-slate-800 truncate">
                            {it.qty}× {it.menu_items?.name || "Dish"}
                          </span>
                        </div>
                        <span className="font-mono text-slate-600 shrink-0">
                          ₹{Number(it.unit_price || it.menu_items?.price || 0) * (it.qty || 1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Footer: Total & Lifecycle Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-500">Order Amount</span>
                    <span className="text-base font-bold font-mono text-slate-900">
                      ₹{orderTotal}
                    </span>
                  </div>

                  {/* Action Button */}
                  <div className="flex gap-2">
                    {orderStage === "pending" && (
                      <button
                        type="button"
                        disabled={isUpdatingOrder === ord.id}
                        onClick={() => handleUpdateOrderStatus(ord.id, "preparing")}
                        className="w-full py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <i className="fa-solid fa-fire-burner" />
                        <span>Start Cooking</span>
                      </button>
                    )}

                    {orderStage === "preparing" && (
                      <button
                        type="button"
                        disabled={isUpdatingOrder === ord.id}
                        onClick={() => handleUpdateOrderStatus(ord.id, "served")}
                        className="w-full py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <i className={`fa-solid ${isDelivery ? "fa-motorcycle" : "fa-check"}`} />
                        <span>{isDelivery ? "Mark Out for Delivery" : "Mark Ready for Pickup"}</span>
                      </button>
                    )}

                    {orderStage === "ready" && (
                      <div className="w-full py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 text-center flex items-center justify-center gap-1.5">
                        <i className="fa-solid fa-circle-check text-emerald-600" />
                        <span>{isDelivery ? "Out for Delivery" : "Order Ready for Pickup"}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* QR MODAL FOR PACKAGING & SOCIAL SHARING */}
      {/* ======================================================== */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95 duration-150 text-center">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Packaging & Delivery QR
              </h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Print this QR code on food containers, delivery boxes, and flyers so customers can reorder directly from home!
            </p>

            {qrCodeUrl && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl inline-block mx-auto shadow-xs">
                <img
                  src={qrCodeUrl}
                  alt="Online Store QR"
                  className="w-56 h-56 mx-auto rounded-lg"
                />
              </div>
            )}

            <div className="text-xs font-mono text-slate-600 bg-slate-100 p-2 rounded-lg truncate">
              {storefrontUrl}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-download" />
                <span>Download QR</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
