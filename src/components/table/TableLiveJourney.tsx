"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { ActiveOrder, ActiveOrderItem, RestaurantFeatures, OrderStage, CancelledItemNotice } from "./TableTypes";
import { triggerHaptic } from "./tableUtils";

interface TableLiveJourneyProps {
  currentJourneyLayout: "floating_capsule" | "split_card" | "slim_accordion";
  activeOrder: ActiveOrder;
  activeStage: OrderStage;
  isApprovalPending: boolean;
  remainingMinutesText: string | null;
  tableNumber: string;
  features: RestaurantFeatures;
  offerConfig: {
    active: boolean;
    bounceBackReward?: string;
    [key: string]: any;
  };
  isJourneySheetOpen: boolean;
  setIsJourneySheetOpen: (open: boolean) => void;
  isTicketExpanded: boolean;
  setIsTicketExpanded: (exp: boolean | ((prev: boolean) => boolean)) => void;
  handleReorderItem: (item: ActiveOrderItem) => void;
  setIsScratchModalOpen: (open: boolean) => void;
  setIsCallModalOpen: (open: boolean) => void;
  onAddFoodClick: () => void;
  onCancelItem?: (orderId: string, itemId: string) => Promise<boolean>;
  onUpdateItemQty?: (orderId: string, itemId: string, newQty: number) => Promise<boolean>;
  cancelledItems?: CancelledItemNotice[];
}

export default function TableLiveJourney({
  currentJourneyLayout,
  activeOrder,
  activeStage,
  isApprovalPending,
  remainingMinutesText,
  tableNumber,
  features,
  offerConfig,
  isJourneySheetOpen,
  setIsJourneySheetOpen,
  isTicketExpanded,
  setIsTicketExpanded,
  handleReorderItem,
  setIsScratchModalOpen,
  setIsCallModalOpen,
  onAddFoodClick,
  onCancelItem,
  onUpdateItemQty,
  cancelledItems = [],
}: TableLiveJourneyProps) {
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const dragControls = useDragControls();

  if (!activeOrder || !activeOrder.order_items || activeOrder.order_items.length === 0) {
    return null;
  }

  const orderTotal = activeOrder.order_items.reduce(
    (sum, it) => sum + Number(it.unit_price) * Number(it.qty),
    0
  );

  const handleExecuteCancel = async (itemId: string) => {
    if (!onCancelItem) return;
    triggerHaptic(15);
    setProcessingItemId(itemId);
    try {
      await onCancelItem(activeOrder.id, itemId);
    } finally {
      setProcessingItemId(null);
      setConfirmCancelId(null);
    }
  };

  const handleExecuteQtyChange = async (itemId: string, newQty: number) => {
    if (!onUpdateItemQty) return;
    triggerHaptic(10);
    setProcessingItemId(itemId);
    try {
      await onUpdateItemQty(activeOrder.id, itemId, newQty);
    } finally {
      setProcessingItemId(null);
    }
  };

  const renderOrderItemCards = () => (
    <AnimatePresence initial={false} mode="popLayout">
      {activeOrder.order_items.map((it) => {
        const isEditable = isApprovalPending || it.item_status === "pending";
        const isConfirming = confirmCancelId === it.id;
        const isProcessing = processingItemId === it.id;

        return (
          <motion.div
            key={it.id}
            layout
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.92,
              x: -18,
              height: 0,
              marginBottom: 0,
              paddingTop: 0,
              paddingBottom: 0,
              overflow: "hidden",
            }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="p-2.5 rounded-xl bg-stone-50/90 border border-stone-200/90 hover:border-stone-300 transition-all text-xs space-y-2"
          >
            {/* Line 1: Veg indicator + Full Dish Name (100% width) + Portion Badge + Item Total Price */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                <span
                  className={`${
                    it.menu_items?.is_veg ? "veg-indicator" : "nonveg-indicator"
                  } shrink-0 mt-0.5`}
                />
                <span className="font-bold text-stone-900 text-xs sm:text-sm leading-snug break-words">
                  {it.menu_items?.name || "Dish"}
                </span>
                {it.notes && it.notes.toLowerCase().includes("half") ? (
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider shrink-0">
                    Half
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 border border-stone-200 uppercase tracking-wider shrink-0">
                    Full
                  </span>
                )}
              </div>
              <span className="font-mono font-black text-stone-900 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                ₹{Number(it.unit_price) * Number(it.qty)}
              </span>
            </div>

            {/* Line 2: Status Badge / Quantities & Pre-Verification Controls */}
            <div className="flex items-center justify-between pt-1 border-t border-stone-200/50 text-[11px] gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {isEditable ? (
                  /* Quantity Stepper for unverified items */
                  <div className="flex items-center bg-stone-200/70 rounded-lg p-0.5 border border-stone-300/80">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      disabled={isProcessing}
                      onClick={() => {
                        if (it.qty > 1) {
                          handleExecuteQtyChange(it.id, it.qty - 1);
                        } else {
                          setConfirmCancelId(it.id);
                        }
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs shadow-2xs cursor-pointer disabled:opacity-40"
                    >
                      -
                    </motion.button>
                    <span className="w-5 text-center font-bold text-stone-800 text-[10px] font-mono">
                      {it.qty}
                    </span>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      disabled={isProcessing}
                      onClick={() => handleExecuteQtyChange(it.id, it.qty + 1)}
                      className="w-5 h-5 flex items-center justify-center rounded bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs shadow-2xs cursor-pointer disabled:opacity-40"
                    >
                      +
                    </motion.button>
                  </div>
                ) : (
                  <span className="font-bold text-stone-600 bg-stone-200/60 px-1.5 py-0.5 rounded text-[10px]">
                    {it.qty}×
                  </span>
                )}

                {/* Status indicator */}
                {it.item_status === "served" ? (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 shrink-0">
                    <span>✓</span> Ready
                  </span>
                ) : it.item_status === "preparing" ? (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-300 animate-pulse flex items-center gap-1 shrink-0">
                    <span>🔥</span> Cooking
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
                    <span>Verifying</span>
                  </span>
                )}

                <span className="text-[10px] text-stone-400 font-mono">
                  (₹{it.unit_price}/ea)
                </span>
              </div>

              {/* Action Buttons: Pre-Verification Cancel OR Post-Verification Repeat */}
              <div className="flex items-center gap-1.5">
                {isEditable ? (
                  !isConfirming && (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      disabled={isProcessing}
                      onClick={() => setConfirmCancelId(it.id)}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 cursor-pointer shadow-2xs transition-colors flex items-center gap-1"
                    >
                      <i className="fa-solid fa-trash-can text-[9px]" />
                      <span>Cancel</span>
                    </motion.button>
                  )
                ) : (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleReorderItem(it)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-white hover:bg-stone-100 cursor-pointer shadow-2xs transition-transform flex items-center gap-1"
                    style={{ borderColor: "var(--hairline)", color: "var(--rust)" }}
                  >
                    <span>+</span> Repeat
                  </motion.button>
                )}
              </div>
            </div>

            {/* Inline Confirmation for Pre-Verification Item Cancellation */}
            <AnimatePresence>
              {isConfirming && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="p-2 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="font-semibold text-rose-900 leading-tight">
                    Remove dish from order?
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      disabled={isProcessing}
                      onClick={() => handleExecuteCancel(it.id)}
                      className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] cursor-pointer shadow-xs"
                    >
                      {isProcessing ? "Removing..." : "Yes, Remove"}
                    </motion.button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setConfirmCancelId(null)}
                      className="px-2 py-1 rounded-md bg-white hover:bg-stone-100 text-stone-600 font-bold text-[10px] border border-stone-200 cursor-pointer"
                    >
                      Keep
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );

  const renderCancelledDishesList = () => {
    if (!cancelledItems || cancelledItems.length === 0) return null;
    return (
      <div className="mt-2.5 pt-2 border-t border-dashed border-red-200 space-y-1.5 animate-in fade-in">
        <div className="text-[10px] font-bold uppercase tracking-wider text-red-600 flex items-center gap-1">
          <span>❌</span> Cancelled Dishes ({cancelledItems.length})
        </div>
        {cancelledItems.map((ci) => (
          <div
            key={ci.id}
            className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-red-50/90 border border-red-100"
          >
            <div>
              <div className="line-through text-stone-500 font-semibold">{ci.dishName}</div>
              <div className="text-[10px] text-red-600">{ci.reason}</div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-mono text-stone-400">Qty: {ci.qty}</span>
              <div className="text-[10px] font-bold text-red-600">₹0 (Removed)</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>


      {/* ========================================================================= */}
      {/* OPTION 1: INLINE ORDER JOURNEY PROGRESS CARD (FOR MOBILE & TABLET)        */}
      {/* ========================================================================= */}
      {currentJourneyLayout === "floating_capsule" && (
        <div
          id="live-order-journey-map"
          className="mx-4 mt-3 rounded-2xl border shadow-sm overflow-hidden bg-white animate-fade-in"
          style={{ borderColor: "var(--hairline)" }}
        >
          {/* Header */}
          <div
            className="p-3 bg-stone-50/80 border-b flex items-center justify-between"
            style={{ borderColor: "var(--hairline)" }}
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="text-xl shrink-0">
                {activeStage === "served"
                  ? "🍽️"
                  : activeStage === "preparing"
                  ? "🔥"
                  : isApprovalPending
                  ? "👨‍💼"
                  : "📱"}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading text-xs font-black uppercase tracking-wider text-stone-900 truncate">
                    Track Your Order
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-200 text-stone-700 font-bold shrink-0">
                    #{activeOrder.id.slice(0, 6)}
                  </span>
                </div>
                <div className="text-[10px] text-stone-500 font-medium truncate">
                  Table {tableNumber} • {activeOrder.order_items.length} dishes (₹{orderTotal})
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(12);
                setIsJourneySheetOpen(true);
              }}
              className="text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer transition-transform active:scale-95 text-white whitespace-nowrap shrink-0 leading-none h-7"
              style={{
                backgroundColor: isApprovalPending
                  ? "#D97706"
                  : activeStage === "preparing"
                  ? "#2563EB"
                  : activeStage === "served"
                  ? "#059669"
                  : "#D96B27",
              }}
            >
              <span>{isApprovalPending ? "Edit / Track" : "Track"}</span>
              <span className="text-xs">▴</span>
            </button>
          </div>

          {/* Connected 4-Station Progress Bar */}
          <div className="p-3.5 space-y-2.5">
            <div className="relative py-1">
              <div className="absolute left-4 right-4 top-3.5 h-1 bg-stone-200 rounded-full" />
              <div
                className="absolute left-4 top-3.5 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-sky-500 rounded-full transition-all duration-700"
                style={{
                  width:
                    activeStage === "served"
                      ? "calc(100% - 2rem)"
                      : activeStage === "preparing"
                      ? "66%"
                      : isApprovalPending
                      ? "33%"
                      : "12%",
                }}
              />

              <div className="relative flex items-start justify-between z-10">
                {/* 1. Table */}
                <div className="flex flex-col items-center w-14 text-center">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                    ✓
                  </div>
                  <span className="text-[9px] font-bold mt-1 text-stone-800">Table</span>
                  <span className="text-[8px] text-emerald-700 font-semibold">Placed</span>
                </div>

                {/* 2. Captain */}
                <div className="flex flex-col items-center w-14 text-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow-xs ${
                      activeStage === "preparing" || activeStage === "served"
                        ? "bg-emerald-600 text-white"
                        : isApprovalPending
                        ? "bg-amber-500 text-stone-900 animate-pulse ring-2 ring-amber-300"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {activeStage === "preparing" || activeStage === "served" || !isApprovalPending ? "✓" : "👨‍💼"}
                  </div>
                  <span className="text-[9px] font-bold mt-1 text-stone-800">Captain</span>
                  <span className="text-[8px] text-amber-700 font-semibold">
                    {isApprovalPending ? "Verifying" : "Approved"}
                  </span>
                </div>

                {/* 3. Kitchen */}
                <div className="flex flex-col items-center w-14 text-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow-xs ${
                      activeStage === "served"
                        ? "bg-emerald-600 text-white"
                        : activeStage === "preparing"
                        ? "bg-blue-600 text-white animate-pulse ring-2 ring-blue-300"
                        : "bg-stone-200 text-stone-500"
                    }`}
                  >
                    {activeStage === "served" ? "✓" : activeStage === "preparing" ? "🔥" : "3"}
                  </div>
                  <span className="text-[9px] font-bold mt-1 text-stone-800">Kitchen</span>
                  <span className="text-[8px] text-blue-700 font-semibold">
                    {activeStage === "preparing"
                      ? remainingMinutesText ? `${remainingMinutesText}` : "Cooking"
                      : activeStage === "served"
                      ? "Cooked"
                      : "Pending"}
                  </span>
                </div>

                {/* 4. Served */}
                <div className="flex flex-col items-center w-14 text-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow-xs ${
                      activeStage === "served"
                        ? "bg-emerald-600 text-white ring-2 ring-emerald-300"
                        : "bg-stone-200 text-stone-500"
                    }`}
                  >
                    {activeStage === "served" ? "✨" : "4"}
                  </div>
                  <span className="text-[9px] font-bold mt-1 text-stone-800">Served</span>
                  <span className="text-[8px] text-emerald-700 font-semibold">
                    {activeStage === "served" ? "Delivered" : "Final"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Helper Text & View Order Action */}
            <div className="p-2 rounded-xl bg-stone-50 border border-stone-200/80 text-[11px] text-stone-600 flex items-center justify-between">
              <span className="truncate">
                {isApprovalPending
                  ? `👨‍💼 Captain reviewing items at Table ${tableNumber}.`
                  : activeStage === "preparing"
                  ? `🔥 Chef cooking your fresh dishes.${remainingMinutesText ? ` ETA: ${remainingMinutesText}.` : ""}`
                  : activeStage === "served"
                  ? `🍽️ All dishes delivered at Table ${tableNumber}.`
                  : `Order registered at Table ${tableNumber}.`}
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setIsJourneySheetOpen(true);
                }}
                className="text-[10px] font-bold text-amber-700 underline shrink-0 ml-2 cursor-pointer"
              >
                View Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OPTION 2: SIDE-BY-SIDE SPLIT CARD (TABLET & MOBILE RESPONSIVE DUAL COLUMNS)*/}
      {/* ========================================================================= */}
      {currentJourneyLayout === "split_card" && (
        <div
          id="live-order-journey-map"
          className="mx-4 mt-3 rounded-2xl border shadow-sm overflow-hidden bg-white"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div
            className="p-3.5 bg-stone-50/80 border-b flex items-center justify-between"
            style={{ borderColor: "var(--hairline)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {activeStage === "served"
                  ? "🍽️"
                  : activeStage === "preparing"
                  ? "🔥"
                  : isApprovalPending
                  ? "👨‍💼"
                  : "📱"}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-heading text-xs font-black uppercase tracking-wider text-stone-900">
                  Live Order Journey
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-200 text-stone-700 font-bold">
                  #{activeOrder.id.slice(0, 6)}
                </span>
              </div>
            </div>

            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{
                backgroundColor: isApprovalPending
                  ? "#FFFBEB"
                  : activeStage === "preparing"
                  ? "#EFF6FF"
                  : activeStage === "served"
                  ? "#E8F5E9"
                  : "#F3F4F6",
                color: isApprovalPending
                  ? "#B45309"
                  : activeStage === "preparing"
                  ? "#1D4ED8"
                  : activeStage === "served"
                  ? "#15803D"
                  : "#374151",
              }}
            >
              {isApprovalPending
                ? "Verifying"
                : activeStage === "preparing"
                ? "Cooking"
                : activeStage === "served"
                ? "Served"
                : "Placed"}
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left Column: Timeline & Station Status */}
            <div className="md:col-span-5 flex flex-col justify-between space-y-4 p-3.5 rounded-xl bg-stone-50/60 border border-stone-200/70">
              <div>
                <div className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider mb-2.5">
                  Station Roadmap
                </div>
                <div className="space-y-3 relative pl-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                  {/* 1. Table */}
                  <div className="relative flex items-center gap-2.5">
                    <span className="absolute -left-6 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-xs ring-2 ring-emerald-100">
                      ✓
                    </span>
                    <div>
                      <div className="text-xs font-black text-stone-900 leading-tight">Your Table</div>
                      <div className="text-[10px] text-emerald-700 font-semibold">Order Placed</div>
                    </div>
                  </div>

                  {/* 2. Captain */}
                  <div className="relative flex items-center gap-2.5">
                    <span
                      className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-xs ring-2 ${
                        activeStage === "preparing" || activeStage === "served"
                          ? "bg-emerald-600 text-white ring-emerald-100"
                          : isApprovalPending
                          ? "bg-amber-500 text-stone-900 ring-amber-200 animate-pulse"
                          : "bg-emerald-600 text-white ring-emerald-100"
                      }`}
                    >
                      {activeStage === "preparing" || activeStage === "served" || !isApprovalPending ? "✓" : "👨‍💼"}
                    </span>
                    <div>
                      <div className="text-xs font-black text-stone-900 leading-tight">Floor Captain</div>
                      <div
                        className={`text-[10px] font-semibold ${
                          isApprovalPending ? "text-amber-700 font-bold" : "text-emerald-700"
                        }`}
                      >
                        {isApprovalPending ? "Verifying Items..." : "Approved"}
                      </div>
                    </div>
                  </div>

                  {/* 3. Kitchen */}
                  <div className="relative flex items-center gap-2.5">
                    <span
                      className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-xs ring-2 ${
                        activeStage === "served"
                          ? "bg-emerald-600 text-white ring-emerald-100"
                          : activeStage === "preparing"
                          ? "bg-blue-600 text-white ring-blue-200 animate-pulse"
                          : "bg-stone-200 text-stone-500 ring-stone-100"
                      }`}
                    >
                      {activeStage === "served" ? "✓" : activeStage === "preparing" ? "🔥" : "3"}
                    </span>
                    <div>
                      <div className="text-xs font-black text-stone-900 leading-tight">Kitchen Stoves</div>
                      <div
                        className={`text-[10px] font-semibold ${
                          activeStage === "preparing"
                            ? "text-blue-700 font-bold"
                            : activeStage === "served"
                            ? "text-emerald-700"
                            : "text-stone-400"
                        }`}
                      >
                        {activeStage === "preparing"
                          ? remainingMinutesText ? `Cooking (${remainingMinutesText})` : "Cooking"
                          : activeStage === "served"
                          ? "Cooked"
                          : "Pending KOT"}
                      </div>
                    </div>
                  </div>

                  {/* 4. Served */}
                  <div className="relative flex items-center gap-2.5">
                    <span
                      className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-xs ring-2 ${
                        activeStage === "served"
                          ? "bg-emerald-600 text-white ring-emerald-200"
                          : "bg-stone-200 text-stone-500 ring-stone-100"
                      }`}
                    >
                      {activeStage === "served" ? "✨" : "4"}
                    </span>
                    <div>
                      <div className="text-xs font-black text-stone-900 leading-tight">Table Served</div>
                      <div
                        className={`text-[10px] font-semibold ${
                          activeStage === "served" ? "text-emerald-700" : "text-stone-400"
                        }`}
                      >
                        {activeStage === "served" ? "Delivered Hot" : "Final Stage"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-stone-200/80 text-[11px] text-stone-600 leading-relaxed">
                {isApprovalPending
                  ? `Captain is reviewing items at Table ${tableNumber} before sending KOT.`
                  : activeStage === "preparing"
                  ? `Kitchen is preparing dishes fresh.${remainingMinutesText ? ` Target time: ${remainingMinutesText}.` : ""}`
                  : activeStage === "served"
                  ? `All dishes served hot at Table ${tableNumber}. Enjoy your meal!`
                  : `Order registered from Table ${tableNumber}.`}
              </div>
            </div>

            {/* Right Column: Dishes in Ticket */}
            <div className="md:col-span-7 flex flex-col justify-between space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-700 pb-1 border-b border-stone-200/60">
                <span>Dishes in Ticket ({activeOrder.order_items.length})</span>
                <span className="font-mono text-stone-900 font-black">
                  Total: ₹{orderTotal}
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {renderOrderItemCards()}
                {renderCancelledDishesList()}
              </div>

              <button
                type="button"
                onClick={onAddFoodClick}
                className="w-full py-2 px-3 rounded-lg text-xs font-bold border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 cursor-pointer flex items-center justify-center gap-1 transition-colors"
              >
                <span>+ Add Extra Dishes to Table</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OPTION 3: ULTRA-SLIM INLINE ACCORDION (SINGLE COMPACT CARD WITH 2-LINE)   */}
      {/* ========================================================================= */}
      {currentJourneyLayout === "slim_accordion" && (
        <div
          id="live-order-journey-map"
          className="mx-4 mt-3 rounded-2xl border shadow-sm overflow-hidden bg-white"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div
            onClick={() => setIsTicketExpanded((prev) => !prev)}
            className="p-3 flex items-center justify-between cursor-pointer select-none bg-stone-50/80 border-b hover:bg-stone-100/60 transition-colors"
            style={{ borderColor: "var(--hairline)" }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl">
                {activeStage === "served"
                  ? "🍽️"
                  : activeStage === "preparing"
                  ? "🔥"
                  : isApprovalPending
                  ? "👨‍💼"
                  : "📱"}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-heading text-xs font-black uppercase tracking-wider text-stone-900">
                    Live Order Journey
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-200 text-stone-700 font-bold">
                    #{activeOrder.id.slice(0, 6)}
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 font-medium truncate">
                  {activeOrder.order_items.length} dishes •{" "}
                  {isApprovalPending
                    ? "Captain Verifying"
                    : activeStage === "preparing"
                    ? "Cooking in Kitchen"
                    : activeStage === "served"
                    ? "Served"
                    : "Placed"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                style={{
                  backgroundColor: isApprovalPending
                    ? "#FFFBEB"
                    : activeStage === "preparing"
                    ? "#EFF6FF"
                    : activeStage === "served"
                    ? "#E8F5E9"
                    : "#F3F4F6",
                  color: isApprovalPending
                    ? "#B45309"
                    : activeStage === "preparing"
                    ? "#1D4ED8"
                    : activeStage === "served"
                    ? "#15803D"
                    : "#374151",
                }}
              >
                {isApprovalPending
                  ? "Verifying"
                  : activeStage === "preparing"
                  ? "Cooking"
                  : activeStage === "served"
                  ? "Served"
                  : "Placed"}
              </span>
              <span className="text-xs font-bold text-stone-400">
                {isTicketExpanded ? "▴" : "▾"}
              </span>
            </div>
          </div>

          <div className="p-3.5 space-y-3">
            {/* Slim Progress Bar */}
            <div className="relative py-1">
              <div className="absolute left-4 right-4 top-3.5 h-1 bg-stone-200 rounded-full" />
              <div
                className="absolute left-4 top-3.5 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-sky-500 rounded-full transition-all duration-700"
                style={{
                  width:
                    activeStage === "served"
                      ? "calc(100% - 2rem)"
                      : activeStage === "preparing"
                      ? "66%"
                      : isApprovalPending
                      ? "33%"
                      : "12%",
                }}
              />

              <div className="relative flex items-start justify-between z-10">
                <div className="flex flex-col items-center w-14 text-center">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                    ✓
                  </div>
                  <span className="text-[9px] font-bold mt-1 text-stone-800">Table</span>
                </div>

                <div className="flex flex-col items-center w-14 text-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow-xs ${
                      activeStage === "preparing" || activeStage === "served"
                        ? "bg-emerald-600 text-white"
                        : isApprovalPending
                        ? "bg-amber-500 text-stone-900 animate-pulse"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {activeStage === "preparing" || activeStage === "served" || !isApprovalPending ? "✓" : "👨‍💼"}
                  </div>
                  <span className="text-[9px] font-bold mt-1 text-stone-800">Captain</span>
                </div>

                <div className="flex flex-col items-center w-14 text-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow-xs ${
                      activeStage === "served"
                        ? "bg-emerald-600 text-white"
                        : activeStage === "preparing"
                        ? "bg-blue-600 text-white animate-pulse"
                        : "bg-stone-200 text-stone-500"
                    }`}
                  >
                    {activeStage === "served" ? "✓" : activeStage === "preparing" ? "🔥" : "3"}
                  </div>
                  <span className="text-[9px] font-bold mt-1 text-stone-800">Kitchen</span>
                </div>

                <div className="flex flex-col items-center w-14 text-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow-xs ${
                      activeStage === "served" ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-500"
                    }`}
                  >
                    {activeStage === "served" ? "✨" : "4"}
                  </div>
                  <span className="text-[9px] font-bold mt-1 text-stone-800">Served</span>
                </div>
              </div>
            </div>

            <div className="p-2 px-3 rounded-lg bg-stone-50 border border-stone-200 text-[11px] text-stone-600 flex items-center justify-between">
              <span>
                {isApprovalPending
                  ? `👨‍💼 Floor captain reviewing items at Table ${tableNumber}`
                  : activeStage === "preparing"
                  ? `🔥 Chef cooking dishes in Kitchen${remainingMinutesText ? ` (${remainingMinutesText})` : ""}`
                  : activeStage === "served"
                  ? `🍽️ All dishes delivered to Table ${tableNumber}!`
                  : `📱 Order captured at Table ${tableNumber}`}
              </span>
              <button
                type="button"
                onClick={() => setIsTicketExpanded((prev) => !prev)}
                className="text-[10px] font-bold text-stone-500 underline ml-2 cursor-pointer whitespace-nowrap"
              >
                {isTicketExpanded ? "Hide Dishes" : `View Dishes (${activeOrder.order_items.length})`}
              </button>
            </div>

            {isTicketExpanded && (
              <div
                className="pt-2 border-t border-dashed space-y-2"
                style={{ borderColor: "var(--hairline)" }}
              >
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {renderOrderItemCards()}
                  {renderCancelledDishesList()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide-Up Bottom Sheet Drawer for Live Order Journey (Mode 1: floating_capsule) */}
      <AnimatePresence>
        {isJourneySheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center backdrop-blur-md p-0 sm:p-4"
            style={{ backgroundColor: "rgba(18, 14, 10, 0.55)" }}
            onClick={() => setIsJourneySheetOpen(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0.9 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 32, stiffness: 360, mass: 0.85 }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  setIsJourneySheetOpen(false);
                }
              }}
              className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden touch-pan-y"
              style={{ borderColor: "var(--hairline)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Drag Handle */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="w-12 h-1.5 bg-stone-300 hover:bg-stone-400 rounded-full mx-auto mt-2.5 mb-1 shrink-0 transition-colors cursor-grab active:cursor-grabbing touch-none"
              />

            {/* Sheet Header */}
            <div
              className="p-4 border-b flex items-center justify-between bg-stone-50/80"
              style={{ borderColor: "var(--hairline)" }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">
                  {activeStage === "served"
                    ? "🍽️"
                    : activeStage === "preparing"
                    ? "🔥"
                    : isApprovalPending
                    ? "👨‍💼"
                    : "📱"}
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading text-xs font-black uppercase tracking-wider text-stone-900">
                      Live Order Journey
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-200 text-stone-800 font-bold">
                      #{activeOrder.id.slice(0, 6)}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500 font-medium">
                    Table {tableNumber} • {activeOrder.order_items.length} dishes (₹{orderTotal})
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                  style={{
                    backgroundColor: isApprovalPending
                      ? "#FFFBEB"
                      : activeStage === "preparing"
                      ? "#EFF6FF"
                      : activeStage === "served"
                      ? "#E8F5E9"
                      : "#F3F4F6",
                    color: isApprovalPending
                      ? "#B45309"
                      : activeStage === "preparing"
                      ? "#1D4ED8"
                      : activeStage === "served"
                      ? "#15803D"
                      : "#374151",
                  }}
                >
                  {isApprovalPending
                    ? "Verifying"
                    : activeStage === "preparing"
                    ? "Cooking"
                    : activeStage === "served"
                    ? "Served"
                    : "Placed"}
                </span>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  onClick={() => {
                    triggerHaptic(8);
                    setIsJourneySheetOpen(false);
                  }}
                  className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors shadow-2xs"
                >
                  ✕
                </motion.button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 overflow-y-auto space-y-4">
              {/* 4-Station Stepper Roadmap */}
              <div className="relative py-2">
                <div className="absolute left-6 right-6 top-6 h-1.5 bg-stone-200 rounded-full" />
                <div
                  className="absolute left-6 top-6 h-1.5 bg-gradient-to-r from-emerald-500 via-amber-500 to-sky-500 rounded-full transition-all duration-700"
                  style={{
                    width:
                      activeStage === "served"
                        ? "calc(100% - 3rem)"
                        : activeStage === "preparing"
                        ? "66%"
                        : isApprovalPending
                        ? "33%"
                        : "12%",
                  }}
                />

                <div className="relative flex items-start justify-between z-10">
                  {/* Station 1: Your Table */}
                  <div className="flex flex-col items-center w-16 text-center">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-md ring-4 ring-emerald-100">
                      ✓
                    </div>
                    <span className="text-[10px] font-black mt-1.5 text-stone-900 leading-tight">
                      Your Table
                    </span>
                    <span className="text-[9px] text-emerald-700 font-bold">Placed</span>
                  </div>

                  {/* Station 2: Captain */}
                  <div className="flex flex-col items-center w-16 text-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shadow-md transition-all ${
                        activeStage === "preparing" || activeStage === "served"
                          ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                          : isApprovalPending
                          ? "bg-amber-500 text-stone-900 ring-4 ring-amber-200 animate-pulse"
                          : "bg-emerald-600 text-white ring-4 ring-emerald-100"
                      }`}
                    >
                      {activeStage === "preparing" || activeStage === "served" || !isApprovalPending ? "✓" : "👨‍💼"}
                    </div>
                    <span className="text-[10px] font-black mt-1.5 text-stone-900 leading-tight">
                      Captain
                    </span>
                    <span
                      className={`text-[9px] font-bold ${
                        isApprovalPending ? "text-amber-700 animate-pulse" : "text-emerald-700"
                      }`}
                    >
                      {isApprovalPending ? "Verifying" : "Approved"}
                    </span>
                  </div>

                  {/* Station 3: Kitchen */}
                  <div className="flex flex-col items-center w-16 text-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shadow-md transition-all ${
                        activeStage === "served"
                          ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                          : activeStage === "preparing"
                          ? "bg-blue-600 text-white ring-4 ring-blue-200 animate-pulse"
                          : "bg-stone-200 text-stone-500 ring-2 ring-stone-100"
                      }`}
                    >
                      {activeStage === "served" ? "✓" : activeStage === "preparing" ? "🔥" : "👨‍🍳"}
                    </div>
                    <span className="text-[10px] font-black mt-1.5 text-stone-900 leading-tight">
                      Kitchen
                    </span>
                    <span
                      className={`text-[9px] font-bold ${
                        activeStage === "preparing"
                          ? "text-blue-700 font-bold"
                          : activeStage === "served"
                          ? "text-emerald-700"
                          : "text-stone-400"
                      }`}
                    >
                      {activeStage === "preparing"
                        ? remainingMinutesText
                          ? `${remainingMinutesText}`
                          : "Cooking"
                        : activeStage === "served"
                        ? "Cooked"
                        : "Pending"}
                    </span>
                  </div>

                  {/* Station 4: Served */}
                  <div className="flex flex-col items-center w-16 text-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shadow-md transition-all ${
                        activeStage === "served"
                          ? "bg-emerald-600 text-white ring-4 ring-emerald-200 animate-bounce"
                          : "bg-stone-200 text-stone-500 ring-2 ring-stone-100"
                      }`}
                    >
                      {activeStage === "served" ? "✨" : "🍽️"}
                    </div>
                    <span className="text-[10px] font-black mt-1.5 text-stone-900 leading-tight">
                      Served
                    </span>
                    <span
                      className={`text-[9px] font-bold ${
                        activeStage === "served" ? "text-emerald-700" : "text-stone-400"
                      }`}
                    >
                      {activeStage === "served" ? "At Table" : "Final"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Station Narrative Note (Ultra-Slim Compact Strip) */}
              <div
                className="px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs transition-all shadow-2xs"
                style={{
                  backgroundColor: isApprovalPending
                    ? "#FFFBEB"
                    : activeStage === "preparing"
                    ? "#EFF6FF"
                    : activeStage === "served"
                    ? "#F0FDF4"
                    : "#FAF8F5",
                  borderColor: isApprovalPending
                    ? "#FDE68A"
                    : activeStage === "preparing"
                    ? "#BFDBFE"
                    : activeStage === "served"
                    ? "#BBF7D0"
                    : "var(--hairline)",
                }}
              >
                <span className="text-base shrink-0">
                  {isApprovalPending ? "👨‍💼" : activeStage === "preparing" ? "🍳" : activeStage === "served" ? "🎉" : "📍"}
                </span>
                <div className="min-w-0 flex-1 leading-snug">
                  <span className="font-heading font-black text-xs text-stone-900">
                    {isApprovalPending
                      ? `Captain Verification (Table ${tableNumber}): `
                      : activeStage === "preparing"
                      ? `Kitchen Cooking: `
                      : activeStage === "served"
                      ? `Delivered to Table ${tableNumber}: `
                      : `Order Dispatched: `}
                  </span>
                  <span className="text-[11px] text-stone-600">
                    {isApprovalPending
                      ? "Reviewing items with you before kitchen fire."
                      : activeStage === "preparing"
                      ? `Preparing dishes fresh${remainingMinutesText ? ` (${remainingMinutesText} left)` : ""}.`
                      : activeStage === "served"
                      ? "Hope you enjoy your meal! Call waiter anytime."
                      : "Dispatched to service captain."}
                  </span>
                </div>
              </div>

              {/* Mystery Scratch Reward Card prompt when food is served */}
              {activeStage === "served" && features.loyaltyOffers !== false && (
                <div
                  onClick={() => {
                    triggerHaptic(18);
                    setIsScratchModalOpen(true);
                  }}
                  className="p-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 border border-amber-500 text-stone-900 shadow-md cursor-pointer active:scale-98 transition-transform flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl animate-bounce">🎁</span>
                    <div className="text-left">
                      <div className="text-xs font-black leading-tight">Scratch Mystery Voucher!</div>
                      <div className="text-[10px] font-medium text-amber-950">
                        {offerConfig.bounceBackReward || "Flat ₹100 OFF on your next visit"}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-black px-2.5 py-1.5 rounded-lg bg-stone-900 text-amber-300 shadow-xs flex items-center gap-1">
                    <span>Scratch</span>
                    <span>➔</span>
                  </span>
                </div>
              )}

              {/* Dishes In Ticket */}
              <div
                className="space-y-2 pt-2 border-t border-dashed"
                style={{ borderColor: "var(--hairline)" }}
              >
                <div className="text-[11px] font-mono font-bold text-stone-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Dishes in this order ({activeOrder.order_items.length}):</span>
                  <span className="text-stone-900 font-black font-receipt">Total: ₹{orderTotal}</span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {renderOrderItemCards()}
                  {renderCancelledDishesList()}
                </div>
              </div>
            </div>

            {/* Bottom Actions (Single-line guaranteed with iPhone spring touch) */}
            <div
              className="p-3 border-t bg-stone-50 flex items-center gap-2"
              style={{ borderColor: "var(--hairline)" }}
            >
              {features.callWaiter && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94, transition: { type: "spring", stiffness: 500, damping: 25 } }}
                  onClick={() => {
                    triggerHaptic(12);
                    setIsJourneySheetOpen(false);
                    setIsCallModalOpen(true);
                  }}
                  className="flex-1 min-w-0 py-2.5 px-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 font-bold text-xs text-stone-800 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors whitespace-nowrap"
                >
                  <span className="shrink-0 text-sm">🛎️</span>
                  <span className="whitespace-nowrap font-black truncate">Call Waiter</span>
                </motion.button>
              )}
              <motion.button
                type="button"
                whileTap={{ scale: 0.94, transition: { type: "spring", stiffness: 500, damping: 25 } }}
                onClick={() => {
                  triggerHaptic(12);
                  setIsJourneySheetOpen(false);
                  onAddFoodClick();
                }}
                className="flex-1 min-w-0 py-2.5 px-3 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors whitespace-nowrap"
                style={{ backgroundColor: "var(--rust)", color: "var(--rust-text)" }}
              >
                <span className="shrink-0 text-sm">🍲</span>
                <span className="whitespace-nowrap font-black truncate">+ Add More</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
