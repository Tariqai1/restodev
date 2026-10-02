"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface RiderItem {
  name: string;
  qty: number;
  price: number;
  isVeg: boolean;
}

interface RiderDelivery {
  id: string;
  orderNumber: string;
  type: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress?: string;
  customerCoords?: { lat: number; lng: number } | null;
  kitchenStage: "received" | "preparing" | "ready";
  dispatchStage: "pending" | "dispatched" | "delivered" | "cancelled";
  riderName?: string | null;
  riderPhone?: string | null;
  dispatchedAt?: string | null;
  openedAt: string;
  closedAt?: string | null;
  totalAmount: number;
  paymentMode: string;
  paymentStatus: "paid" | "unpaid";
  items: RiderItem[];
}

export default function DeliveryPortalPage() {
  const [activeDeliveries, setActiveDeliveries] = useState<RiderDelivery[]>([]);
  const [completedDeliveries, setCompletedDeliveries] = useState<RiderDelivery[]>([]);
  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await fetch("/api/delivery/orders");
      const data = await res.json();
      if (res.ok && data.ok) {
        setActiveDeliveries(data.activeDeliveries || []);
        setCompletedDeliveries(data.completedDeliveries || []);
        if (data.restaurant) setRestaurant(data.restaurant);
      }
    } catch (err) {
      console.error("Failed to load rider deliveries:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
    const interval = setInterval(fetchDeliveries, 8000);
    return () => clearInterval(interval);
  }, [fetchDeliveries]);

  const handleStartDelivery = async (orderId: string) => {
    setIsUpdatingId(orderId);
    try {
      const res = await fetch("/api/delivery/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_delivery", orderId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setNotice("🛵 Out for delivery! Follow Google Maps navigation.");
        setTimeout(() => setNotice(null), 4000);
        await fetchDeliveries();
      }
    } catch {
      alert("Failed to start delivery.");
    } finally {
      setIsUpdatingId(null);
    }
  };

  const handleCompleteDelivery = async (orderId: string, paymentMode: "cash" | "upi") => {
    const confirmText =
      paymentMode === "cash"
        ? "Confirm Cash collected and order delivered?"
        : "Confirm UPI payment received and order delivered?";
    if (!window.confirm(confirmText)) return;

    setIsUpdatingId(orderId);
    try {
      const res = await fetch("/api/delivery/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_delivery",
          orderId,
          paymentMode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setNotice("✅ Order successfully marked Delivered! Great job.");
        setTimeout(() => setNotice(null), 4000);
        await fetchDeliveries();
      }
    } catch {
      alert("Failed to complete delivery.");
    } finally {
      setIsUpdatingId(null);
    }
  };

  const openNavigation = (del: RiderDelivery) => {
    if (del.customerCoords?.lat && del.customerCoords?.lng) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${del.customerCoords.lat},${del.customerCoords.lng}`,
        "_blank"
      );
    } else if (del.deliveryAddress) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(del.deliveryAddress)}`,
        "_blank"
      );
    } else {
      alert("No delivery address or GPS coordinates found.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-12">
      {/* Top App Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg border border-emerald-500/30 font-black">
            🛵
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white leading-tight">
              {restaurant?.name || "Restaurant"} Rider Fleet
            </h1>
            <p className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Delivery Boy Portal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchDeliveries()}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs transition-colors cursor-pointer border border-slate-700"
            title="Refresh Orders"
          >
            <i className={`fa-solid fa-arrows-rotate ${isLoading ? "fa-spin" : ""}`} />
          </button>
          <Link
            href="/waiter"
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 border border-slate-700 transition-colors"
          >
            Dining Floor →
          </Link>
        </div>
      </header>

      {/* Notice Toast */}
      {notice && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2">
          <span>{notice}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-xl w-full mx-auto p-4 flex-1 flex flex-col gap-4">
        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "active"
                ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Active Deliveries</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                activeTab === "active"
                  ? "bg-slate-950 text-emerald-400"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {activeDeliveries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "completed"
                ? "bg-slate-100 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Completed Today</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                activeTab === "completed"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {completedDeliveries.length}
            </span>
          </button>
        </div>

        {/* Deliveries List */}
        {activeTab === "active" ? (
          activeDeliveries.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl p-8 space-y-3 bg-slate-900/40 my-auto">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-3xl mx-auto shadow-inner">
                🛵
              </div>
              <h3 className="text-sm font-black text-white">No Active Deliveries Right Now</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                When an online customer orders for home delivery, the order and live GPS location will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeDeliveries.map((del) => {
                const elapsedMins = Math.floor(
                  (Date.now() - new Date(del.openedAt).getTime()) / 60000
                );
                const isDispatched = del.dispatchStage === "dispatched";
                const isUpdating = isUpdatingId === del.id;

                return (
                  <div
                    key={del.id}
                    className={`rounded-3xl border bg-slate-900/95 p-4 sm:p-5 shadow-xl space-y-4 transition-all ${
                      isDispatched
                        ? "border-emerald-500/50 shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {/* Order Header & Badges */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-white bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                          {del.orderNumber}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 font-mono">
                          <i className="fa-solid fa-clock text-[10px]" />
                          {elapsedMins}m ago
                        </span>
                      </div>

                      {/* Stage Pill */}
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                          isDispatched
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse"
                            : del.kitchenStage === "ready"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {isDispatched
                          ? "🛵 Out for Delivery"
                          : del.kitchenStage === "ready"
                          ? "✅ Food Ready to Pickup"
                          : "🍳 Kitchen Cooking"}
                      </span>
                    </div>

                    {/* Customer & Address Details */}
                    <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                            Customer
                          </span>
                          <span className="text-sm font-bold text-white">
                            {del.customerName}
                          </span>
                        </div>

                        {del.customerPhone && (
                          <a
                            href={`tel:${del.customerPhone}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs hover:bg-emerald-400 active:scale-95 transition-all shadow-md"
                          >
                            <i className="fa-solid fa-phone text-xs" />
                            <span>Call {del.customerPhone}</span>
                          </a>
                        )}
                      </div>

                      {/* Address */}
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                          Delivery Doorstep
                        </span>
                        <p className="text-xs text-slate-200 font-medium leading-relaxed mt-0.5">
                          {del.deliveryAddress || "Address provided via map pin"}
                        </p>
                      </div>

                      {/* 1-Tap Google Maps Navigation Button */}
                      <button
                        type="button"
                        onClick={() => openNavigation(del)}
                        className="w-full mt-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                      >
                        <i className="fa-solid fa-location-arrow text-sm text-amber-300" />
                        <span>Open Turn-by-Turn GPS Navigation</span>
                      </button>
                    </div>

                    {/* Food Items */}
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                        Items to Deliver ({del.items.length})
                      </span>
                      <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 max-h-36 overflow-y-auto">
                        {del.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-200">
                              {it.qty}× {it.name}
                            </span>
                            <span className="font-mono text-slate-400 text-[11px]">
                              ₹{it.price * it.qty}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Box */}
                    <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                          Amount to Collect
                        </span>
                        <span className="text-base font-black text-white font-mono">
                          ₹{del.totalAmount}
                        </span>
                      </div>

                      <div>
                        {del.paymentStatus === "paid" ? (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-xl border border-emerald-500/30 flex items-center gap-1.5">
                            <i className="fa-solid fa-check" />
                            <span>Paid Online (Do Not Collect)</span>
                          </span>
                        ) : (
                          <span className="text-xs font-black text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-xl border border-amber-500/30 flex items-center gap-1.5 animate-pulse">
                            <i className="fa-solid fa-money-bill-wave" />
                            <span>Collect Cash / UPI</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rider Action Controls */}
                    <div className="pt-2">
                      {!isDispatched ? (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleStartDelivery(del.id)}
                          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                        >
                          {isUpdating ? (
                            <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                          ) : (
                            <i className="fa-solid fa-motorcycle text-base" />
                          )}
                          <span>Pick Up Food & Start Delivery</span>
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleCompleteDelivery(del.id, "cash")}
                            className="py-3 px-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                          >
                            <i className="fa-solid fa-check-double text-xs" />
                            <span>Delivered (Cash Collected)</span>
                          </button>

                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleCompleteDelivery(del.id, "upi")}
                            className="py-3 px-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 active:scale-98 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                          >
                            <i className="fa-solid fa-qrcode text-xs" />
                            <span>Delivered (UPI Received)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Completed Deliveries Tab */
          completedDeliveries.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl p-8 space-y-3 bg-slate-900/40 my-auto">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-3xl mx-auto shadow-inner">
                📦
              </div>
              <h3 className="text-sm font-black text-white">No Completed Deliveries Yet</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Orders you mark as delivered today will appear here as your completed trip record.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">Total Delivered Today:</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  {completedDeliveries.length} Deliveries · ₹
                  {completedDeliveries.reduce((sum, d) => sum + d.totalAmount, 0)}
                </span>
              </div>

              {completedDeliveries.map((del) => (
                <div
                  key={del.id}
                  className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-white text-xs bg-slate-800 px-2 py-0.5 rounded-lg">
                      {del.orderNumber}
                    </span>
                    <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                      <i className="fa-solid fa-check text-[10px]" />
                      Delivered
                    </span>
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-white">{del.customerName}</strong> ·{" "}
                    {del.deliveryAddress}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                    <span>
                      {del.items.length} items ({del.paymentMode.toUpperCase()})
                    </span>
                    <span className="font-mono font-bold text-white text-xs">
                      ₹{del.totalAmount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
