"use client";

import React, { useState, useEffect, useRef } from "react";
import AdminButton from "./AdminButton";

export interface PendingBatch {
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

interface FloorApprovalsStripProps {
  batches: PendingBatch[];
  autoApproveSeconds?: number; // default 30
  onApprove: (batch: PendingBatch) => void;
  onReject: (batch: PendingBatch, reason?: string) => void;
}

export default function FloorApprovalsStrip({
  batches,
  autoApproveSeconds = 30,
  onApprove,
  onReject,
}: FloorApprovalsStripProps) {
  // Sort oldest first (FIFO)
  const sortedBatches = [...batches]
    .filter((b) => b.status === "awaiting_approval")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [rejectPromptBatchId, setRejectPromptBatchId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Auto-approve countdowns per batch: batchId -> seconds remaining
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (sortedBatches.length > 0 && !activeBatchId) {
      setActiveBatchId(sortedBatches[0].id);
    }
  }, [sortedBatches, activeBatchId]);

  // Manage 1-second interval timer for FIFO oldest batch auto-approve & timers
  useEffect(() => {
    if (sortedBatches.length === 0) return;

    timerRef.current = setInterval(() => {
      setCountdowns((prev) => {
        const next: Record<string, number> = { ...prev };

        sortedBatches.forEach((batch) => {
          const elapsedSec = Math.floor(
            (Date.now() - new Date(batch.createdAt).getTime()) / 1000
          );
          const remaining = Math.max(0, autoApproveSeconds - elapsedSec);
          next[batch.id] = remaining;

          // Auto-approve triggered if countdown hits 0
          if (remaining === 0 && prev[batch.id] !== 0) {
            onApprove(batch);
          }
        });

        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sortedBatches, autoApproveSeconds, onApprove]);

  if (sortedBatches.length === 0) return null;

  return (
    <div className="mb-5 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900">
            Pending Orders Awaiting Waiter Approval ({sortedBatches.length})
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          Oldest-first (FIFO) · 30s Smart Auto-Fire
        </span>
      </div>

      {/* Batch Cards Grid */}
      <div className="space-y-2">
        {sortedBatches.map((batch, idx) => {
          const elapsedSec = Math.floor(
            (Date.now() - new Date(batch.createdAt).getTime()) / 1000
          );
          const isUrgent = elapsedSec > 45;
          const isCritical = elapsedSec > 90;
          const remainingAuto = countdowns[batch.id] ?? Math.max(0, autoApproveSeconds - elapsedSec);

          const isOldest = idx === 0;

          return (
            <div
              key={batch.id}
              className={`rounded-2xl border-2 p-3 sm:p-4 shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isCritical
                  ? "bg-rose-50/95 border-rose-400"
                  : isUrgent
                  ? "bg-amber-50/95 border-amber-400"
                  : "bg-white border-amber-300"
              }`}
            >
              {/* Left Details */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-bold ${
                    isCritical
                      ? "bg-rose-600 text-white"
                      : isUrgent
                      ? "bg-amber-500 text-white"
                      : "bg-amber-100 text-amber-900 border border-amber-300"
                  }`}
                >
                  <span className="text-[10px] uppercase font-mono leading-none">Table</span>
                  <span className="text-base font-black leading-tight">
                    {batch.tableNumber}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900">
                      Table {batch.tableNumber}
                    </span>
                    {batch.customerName && (
                      <span className="text-xs text-slate-500 font-medium">
                        ({batch.customerName})
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        isCritical
                          ? "bg-rose-200 text-rose-800"
                          : isUrgent
                          ? "bg-amber-200 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      ⏱️ Waiting {elapsedSec}s
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                    <span className="font-bold text-slate-800">
                      {batch.totalItems} item{batch.totalItems > 1 ? "s" : ""}
                    </span>
                    <span>•</span>
                    <span className="font-bold text-slate-900 font-mono">
                      ₹{batch.totalAmount}
                    </span>
                    {isOldest && remainingAuto > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-[11px] font-mono text-amber-700 font-semibold flex items-center gap-1">
                          <i className="fa-solid fa-clock-rotate-left text-[10px] animate-spin" />
                          Auto-fire in {remainingAuto}s
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setRejectPromptBatchId(
                      rejectPromptBatchId === batch.id ? null : batch.id
                    );
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Reject
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined" && navigator.vibrate) {
                      navigator.vibrate(15);
                    }
                    onApprove(batch);
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-fire text-xs" />
                  <span>Approve & Fire to KDS</span>
                </button>
              </div>

              {/* Optional Reject Reason Sub-Bar */}
              {rejectPromptBatchId === batch.id && (
                <div className="w-full mt-2 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2 animate-in fade-in">
                  <span className="text-[11px] font-medium text-slate-500">
                    Reason (optional):
                  </span>
                  {["Guest changed mind", "Kitchen sold out", "Duplicate"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        onReject(batch, r);
                        setRejectPromptBatchId(null);
                      }}
                      className="px-2 py-1 text-[10px] rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium"
                    >
                      {r}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      onReject(batch);
                      setRejectPromptBatchId(null);
                    }}
                    className="px-2 py-1 text-[10px] rounded-lg bg-rose-600 text-white font-bold"
                  >
                    Confirm Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
