"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  verificationCode?: string;
  paymentCollectedMode?: "cash" | "upi";
  cashAmountCollected?: number;
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
  const [restoUpiId, setRestoUpiId] = useState("orderdesk@icici");
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [deliveryTab, setDeliveryTab] = useState<"assigned" | "unassigned" | "completed" | "all">("assigned");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Doorstep Verification & Payment Modal States
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<RiderDelivery | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<"cash" | "upi">("cash");
  const [cashReceivedInput, setCashReceivedInput] = useState<string>("");
  const [isBypassPin, setIsBypassPin] = useState(false);
  const [bypassReason, setBypassReason] = useState("");
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const inFlightRef = useRef(false);

  const fetchDeliveries = useCallback(async () => {
    if (inFlightRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;

    inFlightRef.current = true;
    try {
      const res = await fetch("/api/delivery/orders", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setActiveDeliveries(data.activeDeliveries || []);
        setCompletedDeliveries(data.completedDeliveries || []);
        if (data.currentUser) {
          setCurrentUser(data.currentUser);
        }
        if (data.restaurant) {
          setRestaurant(data.restaurant);
          if (data.restaurant.upiId) setRestoUpiId(data.restaurant.upiId);
        }
      }
    } catch (err) {
      console.error("Failed to load rider deliveries:", err);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
    // Smart 15s interval for active tab
    const interval = setInterval(fetchDeliveries, 15000);

    // Instant refresh when user returns to this tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDeliveries();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchDeliveries]);

  // Derived filtered lists based on assignment
  const myAssignedDeliveries = useMemo(() => {
    if (!currentUser?.name) return activeDeliveries;
    const myName = currentUser.name.toLowerCase().trim();
    return activeDeliveries.filter(
      (d) => d.riderName && d.riderName.toLowerCase().trim() === myName
    );
  }, [activeDeliveries, currentUser]);

  const unassignedDeliveries = useMemo(() => {
    return activeDeliveries.filter((d) => !d.riderName);
  }, [activeDeliveries]);

  const handleClaimOrder = async (orderId: string) => {
    const riderNameToUse = currentUser?.name || prompt("Enter your Delivery Captain Name:");
    if (!riderNameToUse) return;

    setIsUpdatingId(orderId);
    try {
      const res = await fetch("/api/delivery/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim_order",
          orderId,
          riderName: riderNameToUse,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to claim order");

      setNotice(`Order claimed! Added to My Deliveries.`);
      setTimeout(() => setNotice(null), 4000);
      setDeliveryTab("assigned");
      fetchDeliveries();
    } catch (e: any) {
      alert(e.message || "Failed to claim order");
    } finally {
      setIsUpdatingId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    } finally {
      window.location.href = "/login";
    }
  };

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
        setNotice("🛵 Out for delivery! Follow Google Maps GPS navigation.");
        setTimeout(() => setNotice(null), 4000);
        setActiveDeliveries((prev) =>
          prev.map((d) =>
            d.id === orderId
              ? {
                  ...d,
                  dispatchStage: "dispatched",
                  dispatchedAt: new Date().toISOString(),
                }
              : d
          )
        );
        await fetchDeliveries();
      }
    } catch {
      alert("Failed to start delivery.");
    } finally {
      setIsUpdatingId(null);
    }
  };

  const openDeliveryVerificationModal = (del: RiderDelivery) => {
    setSelectedOrderForDelivery(del);
    setEnteredPin("");
    setPinError("");
    setPaymentChoice(del.paymentMode === "upi" ? "upi" : "cash");
    setCashReceivedInput("");
    setIsBypassPin(false);
    setBypassReason("");
  };

  const handleConfirmAndCompleteDelivery = async () => {
    if (!selectedOrderForDelivery) return;

    // Validate 4-digit PIN if not bypassed
    if (!isBypassPin) {
      const cleanEntered = enteredPin.trim();
      const expected = selectedOrderForDelivery.verificationCode?.trim();
      if (!cleanEntered || cleanEntered.length !== 4) {
        setPinError("Kripya customer se 4-digit verification PIN lekar yahan enter karein.");
        return;
      }
      if (expected && cleanEntered !== expected) {
        setPinError(`Galat PIN! Customer ke phone screen par dikh raha 4-digit code confirm karein.`);
        return;
      }
    } else {
      if (!bypassReason.trim()) {
        setPinError("PIN bypass karne ka kaaran (e.g. Customer phone dead) likhein.");
        return;
      }
    }

    setIsSubmittingDelivery(true);
    setPinError("");

    try {
      const res = await fetch("/api/delivery/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete_delivery",
          orderId: selectedOrderForDelivery.id,
          paymentMode: selectedOrderForDelivery.paymentStatus === "paid" ? selectedOrderForDelivery.paymentMode : paymentChoice,
          enteredPin: isBypassPin ? undefined : enteredPin.trim(),
          bypassReason: isBypassPin ? bypassReason.trim() : undefined,
          cashAmountCollected:
            selectedOrderForDelivery.paymentStatus !== "paid" && paymentChoice === "cash"
              ? selectedOrderForDelivery.totalAmount
              : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to complete delivery.");
      }

      setNotice("🎉 Order verified & successfully marked Delivered! Great job.");
      setTimeout(() => setNotice(null), 5000);
      const completedOrder = selectedOrderForDelivery;
      setSelectedOrderForDelivery(null);
      setActiveDeliveries((prev) => prev.filter((d) => d.id !== completedOrder.id));
      setCompletedDeliveries((prev) => [
        {
          ...completedOrder,
          dispatchStage: "delivered",
          closedAt: new Date().toISOString(),
          paymentStatus: "paid",
          paymentCollectedMode: paymentChoice,
        },
        ...prev,
      ]);
      await fetchDeliveries();
    } catch (err: any) {
      setPinError(err.message || "Failed to complete delivery.");
    } finally {
      setIsSubmittingDelivery(false);
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

  // Shift Cash & Trip Reconciliation calculations
  const shiftSummary = useMemo(() => {
    let cashInHand = 0;
    let upiTotal = 0;
    for (const d of completedDeliveries) {
      if (d.paymentCollectedMode === "cash" || (d.paymentMode === "cash" && d.paymentStatus === "paid")) {
        cashInHand += Number(d.cashAmountCollected || d.totalAmount || 0);
      } else if (d.paymentCollectedMode === "upi" || d.paymentMode === "upi") {
        upiTotal += Number(d.totalAmount || 0);
      }
    }
    return {
      cashInHand,
      upiTotal,
      tripsCount: completedDeliveries.length,
    };
  }, [completedDeliveries]);

  // UPI URL payload for selected order
  const upiPayload = useMemo(() => {
    if (!selectedOrderForDelivery) return "";
    return `upi://pay?pa=${restoUpiId}&pn=${encodeURIComponent(
      restaurant?.name || "Order Desk"
    )}&am=${selectedOrderForDelivery.totalAmount}&cu=INR&tn=${encodeURIComponent(
      `Delivery ${selectedOrderForDelivery.orderNumber}`
    )}`;
  }, [selectedOrderForDelivery, restoUpiId, restaurant]);

  const qrImageUrl = useMemo(() => {
    if (!upiPayload) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
      upiPayload
    )}`;
  }, [upiPayload]);

  // Cash change calculations
  const cashNum = Number(cashReceivedInput) || 0;
  const changeToReturn =
    selectedOrderForDelivery && cashNum > selectedOrderForDelivery.totalAmount
      ? cashNum - selectedOrderForDelivery.totalAmount
      : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16 w-full max-w-full overflow-x-hidden">
      {/* Top App Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between shadow-lg w-full">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-base sm:text-lg border border-emerald-500/30 font-black shrink-0">
            🛵
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-extrabold text-white leading-tight truncate">
              {restaurant?.name || "Restaurant"} Rider Fleet
            </h1>
            <p className="text-[9px] sm:text-[10px] text-emerald-400 font-bold tracking-wider uppercase flex items-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              Delivery Captain Portal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {currentUser?.name && (
            <div className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <i className="fa-solid fa-user-shield text-[10px]" />
              <span className="max-w-[100px] truncate">{currentUser.name}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="h-8 px-2.5 rounded-xl border border-amber-500/40 bg-amber-950/30 hover:bg-amber-900/50 hover:border-amber-400 text-amber-300 text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Lock screen or switch captain"
          >
            <i className="fa-solid fa-lock text-[10px]" />
            <span className="hidden sm:inline">Switch</span>
          </button>

          <button
            type="button"
            onClick={() => fetchDeliveries()}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs transition-colors cursor-pointer border border-slate-700 active:scale-95"
            title="Refresh Deliveries"
          >
            <i className={`fa-solid fa-arrows-rotate ${isLoading ? "fa-spin" : ""}`} />
          </button>
          <Link
            href="/waiter"
            className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[10px] sm:text-[11px] font-bold text-slate-300 border border-slate-700 transition-colors whitespace-nowrap active:scale-95"
          >
            Floor →
          </Link>
        </div>
      </header>

      {/* Notice Toast */}
      {notice && (
        <div className="mx-3 sm:mx-4 mt-2.5 sm:mt-3 px-3.5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2">
          <span>{notice}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-xl w-full mx-auto px-3 sm:px-4 py-3 sm:py-4 flex-1 flex flex-col gap-3 sm:gap-4 overflow-hidden">
        {/* Rider Shift Cash & Trips Summary Strip */}
        <div className="w-full bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-2.5 sm:p-3.5 rounded-2xl sm:rounded-3xl shadow-xl grid grid-cols-3 divide-x divide-slate-800/80 text-center">
          <div className="px-1 sm:px-2 min-w-0">
            <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-tight text-amber-400 block font-bold truncate">
              💵 Cash Hand
            </span>
            <span className="text-sm sm:text-base md:text-lg font-black font-mono text-white block mt-0.5 truncate">
              ₹{shiftSummary.cashInHand}
            </span>
            <span className="text-[8px] sm:text-[9px] text-slate-500 block truncate">
              Counter Due
            </span>
          </div>

          <div className="px-1 sm:px-2 min-w-0">
            <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-tight text-cyan-400 block font-bold truncate">
              📱 UPI Paid
            </span>
            <span className="text-sm sm:text-base md:text-lg font-black font-mono text-white block mt-0.5 truncate">
              ₹{shiftSummary.upiTotal}
            </span>
            <span className="text-[8px] sm:text-[9px] text-slate-500 block truncate">
              In Bank
            </span>
          </div>

          <div className="px-1 sm:px-2 min-w-0">
            <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-tight text-emerald-400 block font-bold truncate">
              📦 Trips
            </span>
            <span className="text-sm sm:text-base md:text-lg font-black font-mono text-white block mt-0.5 truncate">
              {shiftSummary.tripsCount}
            </span>
            <span className="text-[8px] sm:text-[9px] text-slate-500 block truncate">
              Delivered
            </span>
          </div>
        </div>

        {/* Smart Assignment Tab Switcher */}
        <div className="w-full grid grid-cols-3 gap-1 sm:gap-1.5 bg-slate-900 p-1 sm:p-1.5 rounded-2xl border border-slate-800 text-center">
          <button
            type="button"
            onClick={() => setDeliveryTab("assigned")}
            className={`py-2 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
              deliveryTab === "assigned"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="truncate">My Deliveries</span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
                deliveryTab === "assigned"
                  ? "bg-slate-950 text-amber-400 font-bold"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {myAssignedDeliveries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDeliveryTab("unassigned")}
            className={`py-2 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
              deliveryTab === "unassigned"
                ? "bg-blue-500 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="truncate">Available Pool</span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
                deliveryTab === "unassigned"
                  ? "bg-slate-950 text-blue-300 font-bold"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {unassignedDeliveries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDeliveryTab("completed")}
            className={`py-2 px-1 sm:px-2 rounded-xl text-[10px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
              deliveryTab === "completed"
                ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="truncate">Completed</span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
                deliveryTab === "completed"
                  ? "bg-slate-950 text-emerald-400 font-bold"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {completedDeliveries.length}
            </span>
          </button>
        </div>

        {/* Deliveries List */}
        {deliveryTab === "assigned" ? (
          myAssignedDeliveries.length === 0 ? (
            <div className="py-16 sm:py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl p-6 sm:p-8 space-y-3 bg-slate-900/40 my-auto">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-2xl sm:text-3xl mx-auto shadow-inner">
                🛵
              </div>
              <h3 className="text-sm font-black text-white">No Deliveries Assigned to You</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                {currentUser?.name ? `Captain ${currentUser.name}, ` : ""}jab manager counter se aapko order assign karega, wo yahan show hoga.
              </p>
              {unassignedDeliveries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDeliveryTab("unassigned")}
                  className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <span>View {unassignedDeliveries.length} Orders in Available Pool</span>
                  <i className="fa-solid fa-arrow-right text-[10px]" />
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3.5 sm:space-y-4">
              {myAssignedDeliveries.map((del) => {
                const elapsedMins = Math.floor(
                  (Date.now() - new Date(del.openedAt).getTime()) / 60000
                );
                const isDispatched = del.dispatchStage === "dispatched";
                const isUpdating = isUpdatingId === del.id;

                return (
                  <div
                    key={del.id}
                    className={`rounded-2xl sm:rounded-3xl border bg-slate-900/95 p-3.5 sm:p-5 shadow-xl space-y-3.5 sm:space-y-4 transition-all w-full ${
                      isDispatched
                        ? "border-emerald-500/50 shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                        : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {/* Order Header & Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 sm:pb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs sm:text-sm font-black text-white bg-slate-800 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl border border-slate-700 shrink-0">
                          {del.orderNumber}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 flex items-center gap-1 font-mono shrink-0">
                          <i className="fa-solid fa-clock text-[9px] sm:text-[10px]" />
                          {elapsedMins}m ago
                        </span>
                      </div>

                      {/* Stage Pill & Assigned Captain */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {del.riderName && (
                          <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                            <i className="fa-solid fa-user-shield text-[9px]" />
                            <span>{del.riderName}</span>
                          </span>
                        )}
                        <span
                          className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border shrink-0 ${
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
                            ? "✅ Food Ready"
                            : "🍳 Kitchen Cooking"}
                        </span>
                      </div>
                    </div>

                    {/* Customer & Address Details */}
                    <div className="bg-slate-950/70 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-800/80 space-y-2 sm:space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] sm:text-[10px] font-mono uppercase text-slate-400 block font-bold">
                            Customer
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-white block truncate">
                            {del.customerName}
                          </span>
                        </div>

                        {del.customerPhone && (
                          <a
                            href={`tel:${del.customerPhone}`}
                            className="shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px] sm:text-xs hover:bg-emerald-400 active:scale-95 transition-all shadow-md"
                          >
                            <i className="fa-solid fa-phone text-[10px] sm:text-xs" />
                            <span>Call</span>
                            <span className="hidden sm:inline font-mono">{del.customerPhone}</span>
                          </a>
                        )}
                      </div>

                      {/* Address */}
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-[9px] sm:text-[10px] font-mono uppercase text-slate-400 block font-bold">
                          Delivery Doorstep
                        </span>
                        <p className="text-xs text-slate-200 font-medium leading-relaxed mt-0.5 break-words">
                          {del.deliveryAddress || "Address provided via map pin"}
                        </p>
                      </div>

                      {/* 1-Tap Google Maps Navigation Button */}
                      <button
                        type="button"
                        onClick={() => openNavigation(del)}
                        className="w-full mt-1 py-2 sm:py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-extrabold text-[11px] sm:text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                      >
                        <i className="fa-solid fa-location-arrow text-xs sm:text-sm text-amber-300" />
                        <span>Turn-by-Turn GPS Navigation</span>
                      </button>
                    </div>

                    {/* Food Items */}
                    <div className="space-y-1.5 text-xs text-slate-300">
                      <span className="text-[9px] sm:text-[10px] font-mono uppercase text-slate-400 font-bold block">
                        Items to Deliver ({del.items.length})
                      </span>
                      <div className="space-y-1 bg-slate-950/40 p-2 sm:p-2.5 rounded-xl border border-slate-800/60 max-h-36 overflow-y-auto">
                        {del.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs gap-2">
                            <span className="font-semibold text-slate-200 truncate">
                              {it.qty}× {it.name}
                            </span>
                            <span className="font-mono text-slate-400 text-[11px] shrink-0">
                              ₹{it.price * it.qty}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Status Pill Card */}
                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[9px] sm:text-[10px] font-mono uppercase text-slate-400 block font-bold">
                          Amount to Collect
                        </span>
                        <span className="text-sm sm:text-base font-black text-white font-mono">
                          ₹{del.totalAmount}
                        </span>
                      </div>

                      <div>
                        {del.paymentStatus === "paid" ? (
                          <span className="text-[10px] sm:text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2 sm:px-2.5 py-1 rounded-xl border border-emerald-500/30 flex items-center gap-1 sm:gap-1.5">
                            <i className="fa-solid fa-check text-[10px]" />
                            <span>Paid Online (Do Not Collect)</span>
                          </span>
                        ) : (
                          <span className="text-[10px] sm:text-xs font-black text-amber-400 bg-amber-950/60 px-2 sm:px-2.5 py-1 rounded-xl border border-amber-500/30 flex items-center gap-1 sm:gap-1.5 animate-pulse">
                            <i className="fa-solid fa-money-bill-wave text-[10px]" />
                            <span>Pay on Delivery (Cash / UPI)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rider Action Controls */}
                    <div className="pt-1 sm:pt-2">
                      {!isDispatched ? (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleStartDelivery(del.id)}
                          className="w-full py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                        >
                          {isUpdating ? (
                            <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                          ) : (
                            <i className="fa-solid fa-motorcycle text-sm sm:text-base" />
                          )}
                          <span>Pick Up Food &amp; Start Delivery</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openDeliveryVerificationModal(del)}
                          className="w-full py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                        >
                          <i className="fa-solid fa-shield-check text-sm sm:text-base" />
                          <span>Arrived at Doorstep · Verify &amp; Handover</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : deliveryTab === "unassigned" ? (
          unassignedDeliveries.length === 0 ? (
            <div className="py-16 sm:py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl p-6 sm:p-8 space-y-3 bg-slate-900/40 my-auto">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-2xl sm:text-3xl mx-auto shadow-inner">
                ✓
              </div>
              <h3 className="text-sm font-black text-white">Pool is Clear · All Orders Assigned</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Koi bhi unassigned order pending nahi hai. Saare active orders captains ko assign ho chuke hain.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 sm:space-y-4">
              {unassignedDeliveries.map((del) => {
                const elapsedMins = Math.floor(
                  (Date.now() - new Date(del.openedAt).getTime()) / 60000
                );
                return (
                  <div
                    key={del.id}
                    className="rounded-2xl sm:rounded-3xl border border-blue-500/40 bg-slate-900/95 p-3.5 sm:p-5 shadow-xl space-y-3.5 transition-all w-full"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs sm:text-sm font-black text-white bg-slate-800 px-2 sm:px-2.5 py-0.5 rounded-lg border border-slate-700">
                          {del.orderNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {elapsedMins}m ago
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                        ⚡ Available in Pool
                      </span>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-mono uppercase text-[10px]">Customer:</span>
                        <strong className="text-white">{del.customerName}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-mono uppercase text-[10px]">Address:</span>
                        <span className="text-slate-300 line-clamp-1">{del.deliveryAddress || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-mono uppercase text-[10px]">Bill:</span>
                        <strong className="text-emerald-400 font-mono">₹{del.totalAmount}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isUpdatingId === del.id}
                      onClick={() => handleClaimOrder(del.id)}
                      className="w-full py-3 px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                    >
                      {isUpdatingId === del.id ? (
                        <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                      ) : (
                        <i className="fa-solid fa-bolt text-sm text-amber-300" />
                      )}
                      <span>⚡ Claim Order (Assign to Me)</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Completed Deliveries Tab */
          completedDeliveries.length === 0 ? (
            <div className="py-16 sm:py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl p-6 sm:p-8 space-y-3 bg-slate-900/40 my-auto">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl sm:text-3xl mx-auto shadow-inner">
                📦
              </div>
              <h3 className="text-sm font-black text-white">No Completed Deliveries Yet</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Orders you mark as delivered today will appear here as your completed trip record.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-900 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-400">Total Delivered Today:</span>
                <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono">
                  {completedDeliveries.length} Deliveries · ₹
                  {completedDeliveries.reduce((sum, d) => sum + d.totalAmount, 0)}
                </span>
              </div>

              {completedDeliveries.map((del) => (
                <div
                  key={del.id}
                  className="rounded-xl sm:rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3.5 sm:p-4 space-y-2 text-xs"
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
                  <div className="text-slate-300 break-words">
                    <strong className="text-white">{del.customerName}</strong> ·{" "}
                    {del.deliveryAddress}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                    <span>
                      {del.items.length} items (
                      {del.paymentCollectedMode
                        ? del.paymentCollectedMode.toUpperCase()
                        : del.paymentMode.toUpperCase()}
                      )
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

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Doorstep 4-Digit Verification PIN & Payment Collection
         ───────────────────────────────────────────────────────────── */}
      {selectedOrderForDelivery && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-md shadow-2xl flex flex-col gap-3.5 sm:gap-4 animate-in slide-in-from-bottom duration-200 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 sm:pb-3">
              <div>
                <span className="text-[9px] sm:text-[10px] font-mono uppercase text-emerald-400 font-bold tracking-wider block">
                  Delivery Verification &amp; Payment
                </span>
                <h3 className="text-sm sm:text-base font-black text-white">
                  Order {selectedOrderForDelivery.orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForDelivery(null)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold cursor-pointer active:scale-95"
              >
                ✕
              </button>
            </div>

            {/* Customer & Address Quick summary */}
            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white truncate mr-2">{selectedOrderForDelivery.customerName}</span>
                <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm shrink-0">
                  Total: ₹{selectedOrderForDelivery.totalAmount}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 break-words">
                {selectedOrderForDelivery.deliveryAddress}
              </p>
            </div>

            {/* STEP 1: 4-Digit In-App Verification PIN */}
            <div className="bg-slate-950/80 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800 space-y-2 sm:space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-black text-white flex items-center gap-1.5">
                  <i className="fa-solid fa-shield-halved text-amber-400 text-xs" />
                  <span>1. Customer Verification PIN</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsBypassPin(!isBypassPin);
                    setPinError("");
                  }}
                  className="text-[10px] font-bold text-slate-400 hover:text-amber-400 underline cursor-pointer"
                >
                  {isBypassPin ? "Use PIN Input" : "Bypass PIN?"}
                </button>
              </div>

              {!isBypassPin ? (
                <div className="space-y-1.5 sm:space-y-2">
                  <p className="text-[10px] sm:text-[11px] text-slate-400">
                    Customer se unke phone screen par dikh raha <strong className="text-white">4-Digit PIN</strong> maangein:
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="PIN"
                    className="w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-slate-900 border-2 border-slate-700 text-white font-mono font-black text-xl sm:text-2xl text-center tracking-[0.25em] sm:tracking-[0.4em] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ) : (
                <div className="space-y-1.5 sm:space-y-2 animate-in fade-in">
                  <p className="text-[10px] sm:text-[11px] text-amber-300 font-semibold">
                    Customer ka phone switch off hai ya PIN unavailable hai?
                  </p>
                  <input
                    type="text"
                    value={bypassReason}
                    onChange={(e) => setBypassReason(e.target.value)}
                    placeholder="Kaaran likhein (e.g. Phone dead / Handed to family member)"
                    className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-amber-500/50 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}
            </div>

            {/* STEP 2: Doorstep Payment Collection */}
            <div className="bg-slate-950/80 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800 space-y-2.5 sm:space-y-3">
              <span className="text-[11px] sm:text-xs font-black text-white flex items-center gap-1.5">
                <i className="fa-solid fa-wallet text-cyan-400 text-xs" />
                <span>2. Doorstep Payment Status</span>
              </span>

              {selectedOrderForDelivery.paymentStatus === "paid" ? (
                <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <i className="fa-solid fa-circle-check text-sm shrink-0" />
                  <span>Order is already PAID ONLINE. Do NOT collect money from customer.</span>
                </div>
              ) : (
                <div className="space-y-2.5 sm:space-y-3">
                  {/* Payment Mode Selector */}
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentChoice("cash")}
                      className={`py-2 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                        paymentChoice === "cash"
                          ? "bg-amber-500 text-slate-950 border-amber-500 font-black shadow-md"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      <i className="fa-solid fa-money-bill-wave text-xs" />
                      <span>Cash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentChoice("upi")}
                      className={`py-2 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                        paymentChoice === "upi"
                          ? "bg-cyan-500 text-slate-950 border-cyan-500 font-black shadow-md"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      <i className="fa-solid fa-qrcode text-xs" />
                      <span>UPI QR</span>
                    </button>
                  </div>

                  {/* Cash Calculator Option */}
                  {paymentChoice === "cash" ? (
                    <div className="p-2.5 sm:p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Total to Collect:</span>
                        <span className="font-mono font-black text-white text-sm">
                          ₹{selectedOrderForDelivery.totalAmount}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-slate-400 shrink-0">Cash Given:</span>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-2 text-xs text-slate-500 font-mono">₹</span>
                          <input
                            type="number"
                            placeholder="e.g. 500"
                            value={cashReceivedInput}
                            onChange={(e) => setCashReceivedInput(e.target.value)}
                            className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>

                      {/* Quick Cash Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setCashReceivedInput(String(selectedOrderForDelivery.totalAmount))}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 cursor-pointer"
                        >
                          Exact ₹{selectedOrderForDelivery.totalAmount}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashReceivedInput("500")}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 cursor-pointer"
                        >
                          ₹500
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashReceivedInput("1000")}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 cursor-pointer"
                        >
                          ₹1000
                        </button>
                      </div>

                      {changeToReturn > 0 && (
                        <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between">
                          <span>Return Change:</span>
                          <span className="font-mono text-sm text-emerald-400 font-black">
                            ₹{changeToReturn}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Live UPI QR Code Option (100% Free - Direct Bank Transfer) */
                    <div className="p-2.5 sm:p-3 bg-slate-900 rounded-xl border border-slate-800 text-center space-y-2">
                      <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block">
                        Customer scan with PhonePe / GPay / Paytm
                      </span>

                      {/* QR Image */}
                      {qrImageUrl && (
                        <div className="bg-white p-2 rounded-xl inline-block shadow-lg mx-auto">
                          <img
                            src={qrImageUrl}
                            alt="UPI QR Code"
                            className="w-36 h-36 sm:w-40 sm:h-40 object-contain mx-auto"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-center gap-2 text-xs">
                        <span className="text-slate-400">Total:</span>
                        <span className="font-mono font-black text-cyan-400 text-base">
                          ₹{selectedOrderForDelivery.totalAmount}
                        </span>
                      </div>

                      <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-400">
                        <span>UPI: {restoUpiId}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(restoUpiId);
                              setCopiedUpi(true);
                              setTimeout(() => setCopiedUpi(false), 2000);
                            }
                          }}
                          className="text-cyan-400 underline font-bold cursor-pointer"
                        >
                          {copiedUpi ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {pinError && (
              <div className="p-2.5 sm:p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-rose-400 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Submit Action Button */}
            <button
              type="button"
              disabled={isSubmittingDelivery}
              onClick={handleConfirmAndCompleteDelivery}
              className="w-full py-3 sm:py-3.5 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmittingDelivery ? (
                <i className="fa-solid fa-circle-notch fa-spin text-sm" />
              ) : (
                <i className="fa-solid fa-check-double text-sm sm:text-base" />
              )}
              <span>Verify PIN &amp; Confirm Handover</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
