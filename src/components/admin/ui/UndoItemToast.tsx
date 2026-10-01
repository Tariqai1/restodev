"use client";

import React, { useEffect, useState } from "react";

export interface RemovedItemPayload {
  id: string;
  orderId: string;
  menuItemId: string;
  dishName: string;
  qty: number;
  unitPrice: number;
  notes?: string | null;
}

interface UndoItemToastProps {
  item: RemovedItemPayload | null;
  onUndo: (item: RemovedItemPayload) => void;
  onDismiss: () => void;
}

export default function UndoItemToast({
  item,
  onUndo,
  onDismiss,
}: UndoItemToastProps) {
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    if (!item) return;

    setSecondsLeft(5);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [item, onDismiss]);

  if (!item) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-2xl border border-slate-700 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
          <i className="fa-solid fa-trash-can text-xs" />
        </div>

        <div className="min-w-0 pr-2">
          <p className="text-xs font-bold truncate">
            Removed {item.qty}× {item.dishName}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            Auto-confirming in {secondsLeft}s...
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && navigator.vibrate) {
                navigator.vibrate(10);
              }
              onUndo(item);
            }}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
          >
            <i className="fa-solid fa-rotate-left text-xs" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="w-7 h-7 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-xs"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
