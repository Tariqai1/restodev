import React from "react";
import { triggerHaptic } from "./tableUtils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string;
  onTrackJourney: () => void;
};

export default function TableDispatchModal({
  isOpen,
  onClose,
  tableNumber,
  onTrackJourney,
}: Props) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
    >
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-2xl p-6 text-center border border-amber-200 relative overflow-hidden animate-spring-bounce">
        {/* Top Glowing Beam Icon */}
        <div className="relative mx-auto w-20 h-20 mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center text-3xl shadow-lg">
            🚀
          </div>
        </div>

        {/* Title & Tagline */}
        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 inline-block mb-2">
          Order Beamed Successfully
        </span>
        <h3 className="text-lg font-black text-stone-900 leading-tight">
          Order Dispatched from Table {tableNumber}!
        </h3>
        <p className="text-xs text-stone-600 mt-2 leading-relaxed">
          Your order has been wirelessly beamed to your Floor Captain and Kitchen terminal.
        </p>

        {/* Visual Dispatch Beam Track */}
        <div className="my-5 p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-left">
          <div className="text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span>Dispatch Routing Path</span>
            <span className="text-emerald-700 font-black">Live ⚡</span>
          </div>
          <div className="flex items-center justify-between relative">
            {/* Connecting Track Line */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-gradient-to-r from-emerald-500 via-amber-400 to-stone-200 -z-0" />

            {/* Node 1: Table */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black shadow-xs ring-4 ring-emerald-100">
                ✓
              </div>
              <span className="text-[10px] font-bold text-stone-800 mt-1">Table {tableNumber}</span>
              <span className="text-[8px] text-emerald-600 font-semibold">Sent</span>
            </div>

            {/* Node 2: Captain */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs shadow-xs ring-4 ring-amber-100 animate-pulse">
                👨‍💼
              </div>
              <span className="text-[10px] font-bold text-stone-800 mt-1">Captain</span>
              <span className="text-[8px] text-amber-600 font-semibold">Verifying</span>
            </div>

            {/* Node 3: Kitchen */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center text-xs shadow-xs">
                👨‍🍳
              </div>
              <span className="text-[10px] font-bold text-stone-500 mt-1">Kitchen</span>
              <span className="text-[8px] text-stone-400 font-semibold">Queued</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(12);
              onTrackJourney();
            }}
            className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-md active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            style={{
              backgroundColor: "var(--rust)",
              color: "var(--rust-text)",
            }}
          >
            <span>Track Live Order Journey</span>
            <span>&rarr;</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(6);
              onClose();
            }}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            Browse Menu &amp; Add More Dishes
          </button>
        </div>
      </div>
    </div>
  );
}
