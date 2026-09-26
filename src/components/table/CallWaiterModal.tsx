import React from "react";
import { RestaurantFeatures, WaiterCallType } from "./TableTypes";
import { triggerHaptic } from "./tableUtils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string;
  isCallingWaiter: boolean;
  waiterCooldown: number;
  features: RestaurantFeatures;
  billPaymentMode: "upi" | "cash" | "card";
  setBillPaymentMode: (mode: "upi" | "cash" | "card") => void;
  customCallNote: string;
  setCustomCallNote: (note: string) => void;
  onCallWaiter: (type: WaiterCallType, customNote?: string, paymentMode?: "upi" | "cash" | "card") => void;
};

export default function CallWaiterModal({
  isOpen,
  onClose,
  tableNumber,
  isCallingWaiter,
  waiterCooldown,
  features,
  billPaymentMode,
  setBillPaymentMode,
  customCallNote,
  setCustomCallNote,
  onCallWaiter,
}: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(34, 29, 22, 0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm p-5 rounded-2xl border shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "var(--paper)",
          borderColor: "var(--hairline)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex justify-between items-start pb-2.5 mb-3 border-b border-dashed"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div>
            <span
              className="font-heading text-[11px] uppercase tracking-wider font-bold"
              style={{ color: "var(--rust)" }}
            >
              Station {tableNumber}
            </span>
            <h3 className="font-heading text-xl font-bold" style={{ color: "var(--ink)" }}>
              Call Restaurant Staff
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer hover:bg-black/5"
            style={{ color: "var(--ink-soft)" }}
          >
            ✕
          </button>
        </div>

        <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>
          Tap your need. The staff counter buzzer rings immediately.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            disabled={isCallingWaiter || waiterCooldown > 0}
            onClick={() => onCallWaiter("waiter")}
            className="p-3 rounded-xl text-left border flex flex-col items-start gap-1 cursor-pointer transition-all hover:shadow-xs active:scale-95 bg-white/80"
            style={{ borderColor: "var(--hairline)" }}
          >
            <i className="fa-solid fa-bell text-amber-600 text-lg mb-1" />
            <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>
              Call Captain
            </span>
            <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>
              Order assistance
            </span>
          </button>

          <button
            type="button"
            disabled={isCallingWaiter || waiterCooldown > 0}
            onClick={() => onCallWaiter("water")}
            className="p-3 rounded-xl text-left border flex flex-col items-start gap-1 cursor-pointer transition-all hover:shadow-xs active:scale-95 bg-white/80"
            style={{ borderColor: "var(--hairline)" }}
          >
            <i className="fa-solid fa-droplet text-blue-500 text-lg mb-1" />
            <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>
              Need Water
            </span>
            <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>
              Glasses &amp; jug
            </span>
          </button>

          <button
            type="button"
            disabled={isCallingWaiter || waiterCooldown > 0}
            onClick={() => onCallWaiter("bill", undefined, billPaymentMode)}
            className="p-3 rounded-xl text-left border flex flex-col items-start gap-1 cursor-pointer transition-all hover:shadow-xs active:scale-95 bg-white/80"
            style={{ borderColor: "var(--hairline)" }}
          >
            <i className="fa-solid fa-receipt text-stone-700 text-lg mb-1" />
            <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>
              Request Bill
            </span>
            <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>
              {features.tablePayUpi && billPaymentMode === "upi" ? "Via UPI QR" : "Cash / Card"}
            </span>
          </button>

          <button
            type="button"
            disabled={isCallingWaiter || waiterCooldown > 0}
            onClick={() => onCallWaiter("clean")}
            className="p-3 rounded-xl text-left border flex flex-col items-start gap-1 cursor-pointer transition-all hover:shadow-xs active:scale-95 bg-white/80"
            style={{ borderColor: "var(--hairline)" }}
          >
            <i className="fa-solid fa-broom text-stone-600 text-lg mb-1" />
            <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>
              Clear Table
            </span>
            <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>
              Plates &amp; tissues
            </span>
          </button>
        </div>

        {features.tablePayUpi && (
          <div
            className="p-2.5 rounded-xl border bg-stone-50/80 mb-3"
            style={{ borderColor: "var(--hairline)" }}
          >
            <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Bill Payment Preference</span>
              <span className="text-emerald-700 font-bold">Fastest</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setBillPaymentMode("upi");
                }}
                className={`py-1.5 px-2 rounded-lg border text-center cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                  billPaymentMode === "upi"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-white text-stone-700 border-stone-300"
                }`}
              >
                <i className="fa-solid fa-qrcode text-xs" />
                <span>Instant UPI QR</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setBillPaymentMode("cash");
                }}
                className={`py-1.5 px-2 rounded-lg border text-center cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                  billPaymentMode === "cash"
                    ? "bg-stone-800 text-white border-stone-800 shadow-xs"
                    : "bg-white text-stone-700 border-stone-300"
                }`}
              >
                <i className="fa-solid fa-money-bill-wave text-xs" />
                <span>Cash / Card</span>
              </button>
            </div>
          </div>
        )}

        {features.customRequests && (
          <div className="mb-3 space-y-2">
            <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              Specific Requests (1-Tap)
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button
                type="button"
                disabled={waiterCooldown > 0}
                onClick={() => onCallWaiter("cutlery")}
                className="px-2.5 py-1.5 rounded-lg border bg-white hover:bg-stone-50 cursor-pointer font-medium flex items-center gap-1.5"
                style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}
              >
                <i className="fa-solid fa-utensils text-[10px] text-stone-600" />
                <span>Extra Cutlery &amp; Napkins</span>
              </button>
              <button
                type="button"
                disabled={waiterCooldown > 0}
                onClick={() => onCallWaiter("condiments")}
                className="px-2.5 py-1.5 rounded-lg border bg-white hover:bg-stone-50 cursor-pointer font-medium flex items-center gap-1.5"
                style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}
              >
                <i className="fa-solid fa-pepper-hot text-[10px] text-emerald-600" />
                <span>Green Chutney / Dips</span>
              </button>
              <button
                type="button"
                disabled={waiterCooldown > 0}
                onClick={() => onCallWaiter("chair")}
                className="px-2.5 py-1.5 rounded-lg border bg-white hover:bg-stone-50 cursor-pointer font-medium flex items-center gap-1.5"
                style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}
              >
                <i className="fa-solid fa-chair text-[10px] text-amber-700" />
                <span>Baby High Chair</span>
              </button>
              <button
                type="button"
                disabled={waiterCooldown > 0}
                onClick={() => onCallWaiter("ac")}
                className="px-2.5 py-1.5 rounded-lg border bg-white hover:bg-stone-50 cursor-pointer font-medium flex items-center gap-1.5"
                style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}
              >
                <i className="fa-solid fa-snowflake text-[10px] text-blue-500" />
                <span>Adjust AC / Fan</span>
              </button>
            </div>

            <div className="pt-2">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Special request (e.g. warm water)..."
                  value={customCallNote}
                  onChange={(e) => setCustomCallNote(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border bg-white focus:outline-none"
                  style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}
                />
                <button
                  type="button"
                  disabled={!customCallNote.trim() || waiterCooldown > 0}
                  onClick={() => onCallWaiter("custom", customCallNote.trim())}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-40"
                  style={{ backgroundColor: "var(--rust)", color: "var(--rust-text)" }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2 py-2 text-xs font-medium cursor-pointer text-center rounded-lg hover:bg-black/5"
          style={{ color: "var(--ink-soft)" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
