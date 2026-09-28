"use client";

import React, { useState } from "react";
import { ActiveOrder, OrderStage } from "./TableTypes";
import { triggerHaptic } from "./tableUtils";

interface TableCompactStatusProps {
  activeOrder: ActiveOrder;
  activeStage: OrderStage;
  isApprovalPending: boolean;
  remainingMinutesText: string | null;
}

const STEPS = [
  { key: "placed", label: "Received", icon: "fa-check" },
  { key: "preparing", label: "Cooking", icon: "fa-fire" },
  { key: "served", label: "Ready", icon: "fa-utensils" },
] as const;

function getActiveIndex(stage: OrderStage, pending: boolean): number {
  if (pending) return 0;
  if (stage === "preparing") return 1;
  if (stage === "served") return 2;
  return 0;
}

export default function TableCompactStatus({
  activeOrder,
  activeStage,
  isApprovalPending,
  remainingMinutesText,
}: TableCompactStatusProps) {
  const [expanded, setExpanded] = useState(false);

  if (!activeOrder || !activeOrder.order_items?.length) return null;

  const activeIdx = getActiveIndex(activeStage, isApprovalPending);
  const itemCount = activeOrder.order_items.length;
  const total = activeOrder.order_items.reduce(
    (s, it) => s + Number(it.unit_price) * Number(it.qty),
    0
  );

  const statusText = isApprovalPending
    ? "Verifying with captain..."
    : activeStage === "preparing"
    ? remainingMinutesText
      ? `Cooking · ${remainingMinutesText}`
      : "Cooking your food..."
    : activeStage === "served"
    ? "Your food is ready!"
    : "Order received";

  return (
    <div className="mx-4 mt-3">
      <div
        className="rounded-xl border p-3 shadow-xs cursor-pointer transition-all active:scale-[0.99]"
        style={{
          backgroundColor: "var(--paper-dim)",
          borderColor: "var(--hairline)",
        }}
        onClick={() => {
          triggerHaptic(8);
          setExpanded((p) => !p);
        }}
      >
        {/* 3-Step Progress */}
        <div className="flex items-center justify-between mb-2.5">
          {STEPS.map((step, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done
                        ? "bg-emerald-500 text-white"
                        : active
                        ? "bg-amber-500 text-white shadow-md"
                        : "bg-stone-200 text-stone-400"
                    } ${active && activeStage === "preparing" ? "animate-pulse" : ""}`}
                  >
                    <i className={`fa-solid ${done ? "fa-check" : step.icon}`} />
                  </div>
                  <span
                    className={`text-[10px] font-semibold ${
                      done || active ? "text-stone-800" : "text-stone-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 mb-4">
                    <div
                      className={`h-0.5 rounded-full transition-colors ${
                        i < activeIdx ? "bg-emerald-400" : "bg-stone-200"
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Status summary line */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
            {statusText}
          </span>
          <span className="text-[11px] font-bold" style={{ color: "var(--ink)" }}>
            {itemCount} items · ₹{total}
          </span>
        </div>

        {/* Expand hint */}
        <div className="flex justify-center mt-1.5">
          <i
            className={`fa-solid fa-chevron-down text-[8px] text-stone-400 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Expanded items list */}
      {expanded && (
        <div
          className="mt-1 rounded-xl border p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            backgroundColor: "var(--paper)",
            borderColor: "var(--hairline)",
          }}
        >
          {activeOrder.order_items.map((it) => (
            <div key={it.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-sm border shrink-0 flex items-center justify-center ${
                    it.menu_items?.is_veg
                      ? "border-green-600"
                      : "border-red-600"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      it.menu_items?.is_veg ? "bg-green-600" : "bg-red-600"
                    }`}
                  />
                </span>
                <span className="font-medium truncate" style={{ color: "var(--ink)" }}>
                  {it.qty}× {it.menu_items?.name || "Dish"}
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                    it.item_status === "served"
                      ? "bg-emerald-100 text-emerald-700"
                      : it.item_status === "preparing"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {it.item_status}
                </span>
              </div>
              <span className="font-mono text-[11px] shrink-0" style={{ color: "var(--ink-soft)" }}>
                ₹{Number(it.unit_price) * Number(it.qty)}
              </span>
            </div>
          ))}
          <div
            className="pt-2 mt-1 border-t flex justify-between text-xs font-bold"
            style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}
          >
            <span>Total</span>
            <span>₹{total}</span>
          </div>
        </div>
      )}
    </div>
  );
}
