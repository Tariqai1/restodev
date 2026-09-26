import React, { useState } from "react";
import { triggerHaptic } from "./tableUtils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string;
  restaurantName: string;
  payableBillTotal: number;
};

export default function TableUpiModal({
  isOpen,
  onClose,
  tableNumber,
  restaurantName,
  payableBillTotal,
}: Props) {
  const [activePaymentTab, setActivePaymentTab] = useState<"app" | "qr">("app");
  const [upiCopied, setUpiCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const upiMerchantId = "orderdesk@icici";
  const upiPayload = `upi://pay?pa=${upiMerchantId}&pn=${encodeURIComponent(
    restaurantName || "Order Desk"
  )}&am=${payableBillTotal}&cu=INR&tn=${encodeURIComponent(`Table ${tableNumber} Bill`)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
    upiPayload
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(34, 29, 22, 0.65)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm p-5 rounded-3xl border shadow-2xl text-center bg-white animate-scale-in"
        style={{ borderColor: "var(--hairline)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Amount */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="text-left">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
              Table {tableNumber} Settlement
            </span>
            <span className="font-heading text-2xl font-extrabold text-stone-900">
              ₹{payableBillTotal}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-stone-200"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher: 1-Tap UPI Apps vs Scan QR */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 rounded-xl my-3.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setActivePaymentTab("app");
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activePaymentTab === "app"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <span>📱</span>
            <span>1-Tap UPI Apps</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setActivePaymentTab("qr");
            }}
            className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activePaymentTab === "qr"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <span>📷</span>
            <span>Scan QR</span>
          </button>
        </div>

        {/* TAB 1: Direct 1-Tap Native Mobile UPI Buttons */}
        {activePaymentTab === "app" && (
          <div className="space-y-2.5 my-2 text-left">
            <p className="text-[11px] text-stone-500 text-center mb-3">
              Tap your preferred UPI app to pay ₹{payableBillTotal} directly on this phone.
            </p>

            <div className="space-y-2">
              {/* PhonePe */}
              <a
                href={upiPayload}
                onClick={() => triggerHaptic(15)}
                className="w-full py-2.5 px-4 rounded-xl flex items-center justify-between text-white font-bold text-xs shadow-sm active:scale-98 transition-transform"
                style={{ backgroundColor: "#5f259f" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🟣</span>
                  <span>PhonePe</span>
                </div>
                <span className="text-[11px] opacity-90">Pay ₹{payableBillTotal} →</span>
              </a>

              {/* Google Pay */}
              <a
                href={upiPayload}
                onClick={() => triggerHaptic(15)}
                className="w-full py-2.5 px-4 rounded-xl flex items-center justify-between text-white font-bold text-xs shadow-sm active:scale-98 transition-transform"
                style={{ backgroundColor: "#0f9d58" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🟢</span>
                  <span>Google Pay (GPay)</span>
                </div>
                <span className="text-[11px] opacity-90">Pay ₹{payableBillTotal} →</span>
              </a>

              {/* Paytm */}
              <a
                href={upiPayload}
                onClick={() => triggerHaptic(15)}
                className="w-full py-2.5 px-4 rounded-xl flex items-center justify-between text-white font-bold text-xs shadow-sm active:scale-98 transition-transform"
                style={{ backgroundColor: "#00b9f5" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🔵</span>
                  <span>Paytm UPI</span>
                </div>
                <span className="text-[11px] opacity-90">Pay ₹{payableBillTotal} →</span>
              </a>

              {/* Any Other UPI App */}
              <a
                href={upiPayload}
                onClick={() => triggerHaptic(15)}
                className="w-full py-2.5 px-4 rounded-xl flex items-center justify-between bg-stone-900 text-white font-bold text-xs shadow-sm active:scale-98 transition-transform"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🇮🇳</span>
                  <span>Any UPI App (BHIM / Cred / Bank)</span>
                </div>
                <span className="text-[11px] opacity-90">Open →</span>
              </a>
            </div>

            {/* Copy UPI ID Chip */}
            <div className="pt-2">
              <div
                onClick={() => {
                  triggerHaptic(10);
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    navigator.clipboard.writeText(upiMerchantId);
                    setUpiCopied(true);
                    setTimeout(() => setUpiCopied(false), 2500);
                  }
                }}
                className="p-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 flex items-center justify-between text-xs cursor-pointer hover:bg-stone-100"
              >
                <div className="flex items-center gap-1.5 text-stone-600">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    UPI ID:
                  </span>
                  <span className="font-mono font-bold text-stone-800">{upiMerchantId}</span>
                </div>
                <span className="text-[11px] font-bold text-amber-700">
                  {upiCopied ? "✓ Copied!" : "📋 Copy"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Dynamic QR Code Scan */}
        {activePaymentTab === "qr" && (
          <div className="my-2 space-y-3">
            <p className="text-[11px] text-stone-500">
              Scan with GPay, PhonePe, Paytm or BHIM on any companion phone:
            </p>

            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 inline-block mx-auto shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt={`UPI QR Table ${tableNumber}`}
                className="w-44 h-44 object-contain rounded-xl mx-auto shadow-xs bg-white"
              />
              <div className="text-[10px] font-mono font-bold text-stone-600 mt-2">
                {upiMerchantId} · Table {tableNumber}
              </div>
            </div>

            <div className="text-[11px] text-stone-500">
              Total Bill: <strong className="text-stone-900 font-bold">₹{payableBillTotal}</strong>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-stone-100 text-[11px] text-stone-500">
          Waiter will bring stamped tax receipt upon payment.
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 py-2.5 text-xs font-bold rounded-xl cursor-pointer shadow-sm active:scale-98 transition-all"
          style={{ backgroundColor: "var(--rust)", color: "var(--rust-text)" }}
        >
          Done / Paid
        </button>
      </div>
    </div>
  );
}
