"use client";

import React, { useState } from "react";
import AdminButton from "../ui/AdminButton";
import AdminBadge from "../ui/AdminBadge";

interface Denominations {
  d500: number;
  d200: number;
  d100: number;
  d50: number;
  d20: number;
  d10: number;
  coins: number;
}

export default function CashRegisterView() {
  const [openingFloat, setOpeningFloat] = useState<number>(3000);
  const [isRegisterClosed, setIsRegisterClosed] = useState(false);
  const [closedTimestamp, setClosedTimestamp] = useState<string | null>(null);

  // Denomination quantities entered by cashier
  const [denominations, setDenominations] = useState<Denominations>({
    d500: 12,
    d200: 15,
    d100: 24,
    d50: 18,
    d20: 25,
    d10: 40,
    coins: 150,
  });

  // Simulated day sales figures from POS/Table orders
  const cashSales = 9850;
  const upiSales = 18420;
  const cardSales = 4500;
  const totalSales = cashSales + upiSales + cardSales;

  // Expected physical cash = opening float + cash collected during the day
  const expectedCashInDrawer = openingFloat + cashSales;

  // Calculated physical cash from denomination calculator
  const physicalCashCounted =
    denominations.d500 * 500 +
    denominations.d200 * 200 +
    denominations.d100 * 100 +
    denominations.d50 * 50 +
    denominations.d20 * 20 +
    denominations.d10 * 10 +
    denominations.coins;

  // Discrepancy
  const cashVariance = physicalCashCounted - expectedCashInDrawer;

  const handleDenomChange = (key: keyof Denominations, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setDenominations((prev) => ({ ...prev, [key]: num }));
  };

  const handleCloseRegister = () => {
    if (
      !confirm(
        "Are you sure you want to finalize Day Close? This will lock today's cash book and generate the official Z-Report."
      )
    )
      return;
    setIsRegisterClosed(true);
    setClosedTimestamp(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-2">
            <i className="fa-solid fa-cash-register text-[11px]" />
            <span>Day-End Shift &amp; Cash Reconciliation</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Day-End Cash Register &amp; Z-Report
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Balance cash drawer against QR and POS settlements. Enter denomination breakdown to verify zero variance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isRegisterClosed ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <i className="fa-solid fa-lock text-emerald-600" />
              <span>Shift Closed at {closedTimestamp}</span>
            </div>
          ) : (
            <AdminButton
              variant="primary"
              size="sm"
              leftIcon="fa-lock"
              className="bg-purple-700 hover:bg-purple-800"
              onClick={handleCloseRegister}
            >
              Close Register &amp; Print Z-Report
            </AdminButton>
          )}
        </div>
      </div>

      {/* KPI Cards: Revenue Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">
            Total Day Revenue
          </span>
          <span className="text-2xl font-black text-slate-900 font-mono block">
            ₹{totalSales.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Across 42 settled bills
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">
            Cash Sales Collected
          </span>
          <span className="text-2xl font-black text-emerald-600 font-mono block">
            ₹{cashSales.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Expected in physical drawer
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">
            Digital UPI / QR Collections
          </span>
          <span className="text-2xl font-black text-indigo-600 font-mono block">
            ₹{upiSales.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Direct to Merchant Bank A/C
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">
            Card POS Machine
          </span>
          <span className="text-2xl font-black text-blue-600 font-mono block">
            ₹{cardSales.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Batch settlement auto-queued
          </span>
        </div>
      </div>

      {/* Main Reconciliation Section: Denomination Grid & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Denomination Counter (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Physical Cash Denomination Calculator
              </h3>
              <p className="text-xs text-slate-500">
                Enter note count from the cash drawer tray at end of day
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Opening Float (₹):</span>
              <input
                type="number"
                disabled={isRegisterClosed}
                value={openingFloat}
                onChange={(e) => setOpeningFloat(Number(e.target.value) || 0)}
                className="w-24 px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* 500 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60">
              <span className="font-bold text-slate-700 w-16">₹500 ×</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.d500}
                onChange={(e) => handleDenomChange("d500", e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{(denominations.d500 * 500).toLocaleString("en-IN")}
              </span>
            </div>

            {/* 200 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60">
              <span className="font-bold text-slate-700 w-16">₹200 ×</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.d200}
                onChange={(e) => handleDenomChange("d200", e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{(denominations.d200 * 200).toLocaleString("en-IN")}
              </span>
            </div>

            {/* 100 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60">
              <span className="font-bold text-slate-700 w-16">₹100 ×</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.d100}
                onChange={(e) => handleDenomChange("d100", e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{(denominations.d100 * 100).toLocaleString("en-IN")}
              </span>
            </div>

            {/* 50 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60">
              <span className="font-bold text-slate-700 w-16">₹50 ×</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.d50}
                onChange={(e) => handleDenomChange("d50", e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{(denominations.d50 * 50).toLocaleString("en-IN")}
              </span>
            </div>

            {/* 20 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60">
              <span className="font-bold text-slate-700 w-16">₹20 ×</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.d20}
                onChange={(e) => handleDenomChange("d20", e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{(denominations.d20 * 20).toLocaleString("en-IN")}
              </span>
            </div>

            {/* 10 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60">
              <span className="font-bold text-slate-700 w-16">₹10 ×</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.d10}
                onChange={(e) => handleDenomChange("d10", e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{(denominations.d10 * 10).toLocaleString("en-IN")}
              </span>
            </div>

            {/* Coins */}
            <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60">
              <span className="font-bold text-slate-700">Loose Coins Total (₹)</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.coins}
                onChange={(e) => handleDenomChange("coins", e.target.value)}
                className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{denominations.coins.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Reconciliation Balance Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-100 pb-2">
              Drawer Balance Summary
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Opening Float:</span>
                <span className="font-mono font-bold text-slate-800">
                  ₹{openingFloat.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>+ Cash Sales Collected:</span>
                <span className="font-mono font-bold text-slate-800">
                  ₹{cashSales.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900">
                <span>= Expected Drawer Cash:</span>
                <span className="font-mono">
                  ₹{expectedCashInDrawer.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-purple-900 bg-purple-50 p-2 rounded-lg">
                <span>Counted Physical Cash:</span>
                <span className="font-mono">
                  ₹{physicalCashCounted.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Variance Indicator */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  cashVariance === 0
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : cashVariance > 0
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <i
                    className={`fa-solid ${
                      cashVariance === 0
                        ? "fa-circle-check text-emerald-600"
                        : cashVariance > 0
                        ? "fa-circle-exclamation text-amber-600"
                        : "fa-triangle-exclamation text-rose-600"
                    }`}
                  />
                  <span className="font-bold text-xs">
                    {cashVariance === 0
                      ? "Zero Discrepancy (Balanced)"
                      : cashVariance > 0
                      ? `Surplus Cash (+₹${cashVariance})`
                      : `Cash Shortage (-₹${Math.abs(cashVariance)})`}
                  </span>
                </div>
                <span className="font-mono font-black text-xs">
                  {cashVariance >= 0 ? `+₹${cashVariance}` : `-₹${Math.abs(cashVariance)}`}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                alert(
                  `Z-REPORT SUMMARY\n\nDate: ${new Date().toLocaleDateString("en-IN")}\nShift: Day Close\nTotal Revenue: ₹${totalSales}\nCash: ₹${cashSales}\nUPI: ₹${upiSales}\nCard: ₹${cardSales}\nPhysical Cash: ₹${physicalCashCounted}\nVariance: ₹${cashVariance}\nStatus: Verified`
                );
              }}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-print" />
              <span>Print Day-End Z-Slip</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
