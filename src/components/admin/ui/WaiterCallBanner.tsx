"use client";

import React from "react";
import AdminButton from "./AdminButton";

export interface WaiterCall {
  id: string;
  tableNumber: string;
  restaurantId: string;
  createdAt: string;
  status: "active" | "resolved";
}

interface TableOrderContext {
  tableNumber: string;
  hasOrder: boolean;
  orderStatus?: string;
  elapsedMinutes?: number;
}

interface WaiterCallBannerProps {
  calls: WaiterCall[];
  orderContexts?: Record<string, TableOrderContext>;
  onAcknowledge: (callId: string) => void;
}

export default function WaiterCallBanner({
  calls,
  orderContexts = {},
  onAcknowledge,
}: WaiterCallBannerProps) {
  const activeCalls = calls.filter((c) => c.status === "active");

  if (activeCalls.length === 0) return null;

  return (
    <div className="space-y-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
      {activeCalls.map((call) => {
        const ctx = orderContexts[call.tableNumber];
        const elapsed = Math.floor(
          (Date.now() - new Date(call.createdAt).getTime()) / 1000
        );
        const elapsedFormatted =
          elapsed < 60
            ? `${elapsed}s ago`
            : `${Math.floor(elapsed / 60)}m ago`;

        let contextSubtitle = "Guest pressed Call Waiter";
        if (ctx) {
          if (ctx.hasOrder) {
            contextSubtitle = `Order active (${ctx.orderStatus || "Cooking"}) · Placed ${
              ctx.elapsedMinutes ?? 0
            }m ago`;
          } else {
            contextSubtitle = "No active order · New Table";
          }
        }

        return (
          <div
            key={call.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/25 border-2 border-rose-400"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
                <i className="fa-solid fa-bell-concierge text-lg text-white" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold tracking-tight">
                    Table {call.tableNumber} is Calling!
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/20 font-bold">
                    {elapsedFormatted}
                  </span>
                </div>
                <p className="text-xs text-rose-100 font-medium truncate mt-0.5">
                  {contextSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && navigator.vibrate) {
                    navigator.vibrate(15);
                  }
                  onAcknowledge(call.id);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-check text-xs" />
                <span>Acknowledge & Dismiss</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
