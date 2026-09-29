"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import AdminButton from "../ui/AdminButton";
import AdminBadge from "../ui/AdminBadge";

export interface SettledBillItem {
  id: string;
  order_id: string;
  table_number: string;
  bill_number: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  payment_mode: string;
  payment_status: "paid" | "unpaid";
  created_at: string;
}

interface Denominations {
  d500: number;
  d200: number;
  d100: number;
  d50: number;
  d20: number;
  d10: number;
  coins: number;
}

interface CashRegisterViewProps {
  invoices?: SettledBillItem[];
  onRefreshParent?: () => void;
}

export default function CashRegisterView({
  invoices: initialInvoices,
  onRefreshParent,
}: CashRegisterViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [bills, setBills] = useState<SettledBillItem[]>(initialInvoices || []);
  const [openingFloat, setOpeningFloat] = useState<number>(0);
  const [isRegisterClosed, setIsRegisterClosed] = useState(false);
  const [closedTimestamp, setClosedTimestamp] = useState<string | null>(null);
  const [closedBy, setClosedBy] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Real cash drawer count entered by cashier - defaults strictly to 0
  const [denominations, setDenominations] = useState<Denominations>({
    d500: 0,
    d200: 0,
    d100: 0,
    d50: 0,
    d20: 0,
    d10: 0,
    coins: 0,
  });

  // Fetch real dynamic register data from API
  const fetchRegisterData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/bills");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.todaySettledBills)) {
          setBills(data.todaySettledBills);
        } else if (Array.isArray(data.bills)) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          setBills(
            data.bills.filter(
              (b: SettledBillItem) =>
                b.payment_status === "paid" && new Date(b.created_at) >= todayStart
            )
          );
        }

        if (data.registerState) {
          setOpeningFloat(Number(data.registerState.openingFloat) || 0);
          setIsRegisterClosed(Boolean(data.registerState.isClosed));
          setClosedTimestamp(data.registerState.closedAt || null);
          setClosedBy(data.registerState.closedBy || null);
          if (data.registerState.denominations) {
            setDenominations({
              d500: Number(data.registerState.denominations.d500) || 0,
              d200: Number(data.registerState.denominations.d200) || 0,
              d100: Number(data.registerState.denominations.d100) || 0,
              d50: Number(data.registerState.denominations.d500) || 0,
              d20: Number(data.registerState.denominations.d20) || 0,
              d10: Number(data.registerState.denominations.d10) || 0,
              coins: Number(data.registerState.denominations.coins) || 0,
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to load cash register data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegisterData();
  }, [fetchRegisterData]);

  // Dynamic calculations from real settled bills
  const metrics = useMemo(() => {
    const cash = bills
      .filter((b) => b.payment_mode === "cash")
      .reduce((s, b) => s + (Number(b.total) || 0), 0);
    const upi = bills
      .filter(
        (b) =>
          b.payment_mode === "upi" ||
          b.payment_mode === "online" ||
          b.payment_mode === "qr"
      )
      .reduce((s, b) => s + (Number(b.total) || 0), 0);
    const card = bills
      .filter((b) => b.payment_mode === "card" || b.payment_mode === "pos")
      .reduce((s, b) => s + (Number(b.total) || 0), 0);
    const total = cash + upi + card;

    return {
      cashSales: Math.round(cash),
      upiSales: Math.round(upi),
      cardSales: Math.round(card),
      totalSales: Math.round(total),
      settledCount: bills.length,
    };
  }, [bills]);

  // Expected physical cash in drawer = Opening float + cash sales
  const expectedCashInDrawer = openingFloat + metrics.cashSales;

  // Real physical cash counted from denomination inputs
  const physicalCashCounted =
    denominations.d500 * 500 +
    denominations.d200 * 200 +
    denominations.d100 * 100 +
    denominations.d50 * 50 +
    denominations.d20 * 20 +
    denominations.d10 * 10 +
    denominations.coins;

  // Discrepancy (physical counted minus expected)
  const cashVariance = physicalCashCounted - expectedCashInDrawer;

  const handleDenomChange = (key: keyof Denominations, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setDenominations((prev) => ({ ...prev, [key]: num }));
  };

  const handleClearDenominations = () => {
    setDenominations({
      d500: 0,
      d200: 0,
      d100: 0,
      d50: 0,
      d20: 0,
      d10: 0,
      coins: 0,
    });
  };

  const handleSaveOpeningFloat = async (newVal: number) => {
    setOpeningFloat(newVal);
    try {
      await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_register",
          openingFloat: newVal,
          denominations,
        }),
      });
      setSyncMessage("Opening float updated.");
      setTimeout(() => setSyncMessage(null), 3000);
    } catch (err) {
      console.warn("Failed to persist opening float:", err);
    }
  };

  const handleCloseRegister = async () => {
    if (
      !confirm(
        `Finalize and close today's register?\n\n• Settled Bills: ${metrics.settledCount}\n• Total Revenue: ₹${metrics.totalSales}\n• Counted Cash: ₹${physicalCashCounted}\n• Variance: ₹${cashVariance}`
      )
    )
      return;

    setIsSaving(true);
    const nowIso = new Date().toISOString();
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_register",
          openingFloat,
          denominations,
          isClosed: true,
          closedAt: nowIso,
        }),
      });
      if (res.ok) {
        setIsRegisterClosed(true);
        setClosedTimestamp(nowIso);
        setSyncMessage("Day Register closed successfully and Z-Report recorded.");
      }
    } catch (err) {
      console.error("Failed to close register:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReopenRegister = async () => {
    if (!confirm("Re-open today's register for additional billing?")) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_register",
          isClosed: false,
          closedAt: null,
        }),
      });
      if (res.ok) {
        setIsRegisterClosed(false);
        setClosedTimestamp(null);
        setSyncMessage("Register re-opened for live transactions.");
      }
    } catch (err) {
      console.error("Failed to re-open register:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintZReport = () => {
    const reportText = [
      "==================================",
      "       ORDER DESK - Z-REPORT      ",
      "==================================",
      `Date: ${new Date().toLocaleDateString("en-IN")}`,
      `Time: ${new Date().toLocaleTimeString("en-IN")}`,
      `Status: ${isRegisterClosed ? "CLOSED" : "OPEN / IN-PROGRESS"}`,
      closedTimestamp ? `Closed At: ${new Date(closedTimestamp).toLocaleTimeString("en-IN")}` : "",
      "----------------------------------",
      "REVENUE BREAKDOWN:",
      `Settled Transactions: ${metrics.settledCount}`,
      `Cash Sales:           ₹${metrics.cashSales}`,
      `Digital (UPI/QR):     ₹${metrics.upiSales}`,
      `Card POS:             ₹${metrics.cardSales}`,
      "----------------------------------",
      `TOTAL DAY SALES:      ₹${metrics.totalSales}`,
      "----------------------------------",
      "CASH DRAWER RECONCILIATION:",
      `Opening Float:        ₹${openingFloat}`,
      `Cash Sales Added:     ₹${metrics.cashSales}`,
      `Expected in Drawer:   ₹${expectedCashInDrawer}`,
      `Counted Physical Cash:₹${physicalCashCounted}`,
      `VARIANCE / DISCREPANCY: ${cashVariance >= 0 ? `+₹${cashVariance}` : `-₹${Math.abs(cashVariance)}`}`,
      "----------------------------------",
      "DENOMINATION BREAKDOWN:",
      `500 x ${denominations.d500} = ₹${denominations.d500 * 500}`,
      `200 x ${denominations.d200} = ₹${denominations.d200 * 200}`,
      `100 x ${denominations.d100} = ₹${denominations.d100 * 100}`,
      ` 50 x ${denominations.d50}  = ₹${denominations.d50 * 50}`,
      ` 20 x ${denominations.d20}  = ₹${denominations.d20 * 20}`,
      ` 10 x ${denominations.d10}  = ₹${denominations.d10 * 10}`,
      `Coins Total       = ₹${denominations.coins}`,
      "==================================",
    ]
      .filter(Boolean)
      .join("\n");

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(
        `<pre style="font-family: monospace; font-size: 13px; line-height: 1.5; padding: 20px;">${reportText}</pre>`
      );
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } else {
      alert(reportText);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-2">
            <i className="fa-solid fa-cash-register text-[11px]" />
            <span>Realtime Shift &amp; Cash Reconciliation</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Day-End Cash Register &amp; Z-Report
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Balance physical cash drawer against live settled QR and POS bills. Enter physical counts to verify zero variance.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <AdminButton
            variant="outline"
            size="sm"
            leftIcon={isLoading ? "fa-spinner fa-spin" : "fa-rotate"}
            onClick={() => {
              fetchRegisterData();
              if (onRefreshParent) onRefreshParent();
            }}
            disabled={isLoading}
          >
            Sync Live
          </AdminButton>

          {isRegisterClosed ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
                <i className="fa-solid fa-lock text-slate-500" />
                <span>
                  Closed at{" "}
                  {closedTimestamp
                    ? new Date(closedTimestamp).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "End of Day"}
                </span>
              </span>
              <button
                type="button"
                onClick={handleReopenRegister}
                disabled={isSaving}
                className="text-xs font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
              >
                Re-open
              </button>
            </div>
          ) : (
            <AdminButton
              variant="primary"
              size="sm"
              leftIcon={isSaving ? "fa-spinner fa-spin" : "fa-lock"}
              className="bg-purple-700 hover:bg-purple-800"
              onClick={handleCloseRegister}
              disabled={isSaving}
            >
              Close Shift &amp; Finalize Z-Report
            </AdminButton>
          )}

          <AdminButton
            variant="outline"
            size="sm"
            leftIcon="fa-print"
            onClick={handlePrintZReport}
          >
            Print Z-Slip
          </AdminButton>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <i className="fa-solid fa-circle-check text-purple-600" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* KPI Cards: Dynamic Revenue Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Day Revenue */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">
            Total Day Revenue
          </span>
          <span className="text-2xl font-black text-slate-900 font-mono block">
            ₹{metrics.totalSales.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {metrics.settledCount > 0
              ? `Across ${metrics.settledCount} settled ${
                  metrics.settledCount === 1 ? "bill" : "bills"
                } today`
              : "0 bills settled today"}
          </span>
        </div>

        {/* Cash Sales */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-semibold block">
              Cash Collected
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <span className="text-2xl font-black text-emerald-600 font-mono block">
            ₹{metrics.cashSales.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {metrics.cashSales > 0
              ? "Expected in physical cash drawer"
              : "No cash sales recorded today"}
          </span>
        </div>

        {/* UPI / QR Digital */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-semibold block">
              Digital (UPI / QR)
            </span>
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
          </div>
          <span className="text-2xl font-black text-indigo-600 font-mono block">
            ₹{metrics.upiSales.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {metrics.upiSales > 0
              ? "Direct to merchant bank account"
              : "0 digital QR payments"}
          </span>
        </div>

        {/* Card POS */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-semibold block">
              Card POS Machine
            </span>
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          <span className="text-2xl font-black text-blue-600 font-mono block">
            ₹{metrics.cardSales.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {metrics.cardSales > 0 ? "Card swipe & tap settlements" : "0 card payments"}
          </span>
        </div>
      </div>

      {/* Dynamic Data Notice / Zero State */}
      {metrics.settledCount === 0 && (
        <div className="p-4 rounded-2xl border border-dashed border-slate-300 bg-white flex items-start gap-3 text-xs text-slate-600">
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 mt-0.5">
            <i className="fa-solid fa-receipt" />
          </div>
          <div>
            <span className="font-bold text-slate-900 block">
              No bills settled for today yet
            </span>
            <p className="text-slate-500 mt-0.5 leading-relaxed">
              When tables pay their running bills via Cash, QR, or Card, sales will automatically appear here in realtime. You can enter your morning opening float and physical denomination count below anytime.
            </p>
          </div>
        </div>
      )}

      {/* Main Reconciliation Section: Denomination Grid & Balance Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Physical Cash Denomination Calculator (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Physical Cash Drawer Denominations
              </h3>
              <p className="text-xs text-slate-500">
                Enter note count from the cash drawer tray to compute physical total
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClearDenominations}
                disabled={isRegisterClosed}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer disabled:opacity-40"
              >
                Clear Counts
              </button>

              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-600">Opening Float:</span>
                <span className="text-[11px] font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  disabled={isRegisterClosed}
                  value={openingFloat === 0 ? "" : openingFloat}
                  placeholder="0"
                  onChange={(e) => handleSaveOpeningFloat(Number(e.target.value) || 0)}
                  className="w-20 px-1 py-0.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-800 text-center focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* 500 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="font-bold text-slate-700 w-16">₹500 ×</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.d500 === 0 ? "" : denominations.d500}
                placeholder="0"
                onChange={(e) => handleDenomChange("d500", e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold focus:outline-none focus:border-purple-500"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{(denominations.d500 * 500).toLocaleString("en-IN")}
              </span>
            </div>

            {/* 200 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="font-bold text-slate-700 w-16">₹200 ×</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.d200 === 0 ? "" : denominations.d200}
                placeholder="0"
                onChange={(e) => handleDenomChange("d200", e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold focus:outline-none focus:border-purple-500"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{(denominations.d200 * 200).toLocaleString("en-IN")}
              </span>
            </div>

            {/* 100 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="font-bold text-slate-700 w-16">₹100 ×</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.d100 === 0 ? "" : denominations.d100}
                placeholder="0"
                onChange={(e) => handleDenomChange("d100", e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold focus:outline-none focus:border-purple-500"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{(denominations.d100 * 100).toLocaleString("en-IN")}
              </span>
            </div>

            {/* 50 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="font-bold text-slate-700 w-16">₹50 ×</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.d50 === 0 ? "" : denominations.d50}
                placeholder="0"
                onChange={(e) => handleDenomChange("d50", e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold focus:outline-none focus:border-purple-500"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{(denominations.d50 * 50).toLocaleString("en-IN")}
              </span>
            </div>

            {/* 20 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="font-bold text-slate-700 w-16">₹20 ×</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.d20 === 0 ? "" : denominations.d20}
                placeholder="0"
                onChange={(e) => handleDenomChange("d20", e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold focus:outline-none focus:border-purple-500"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{(denominations.d20 * 20).toLocaleString("en-IN")}
              </span>
            </div>

            {/* 10 */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="font-bold text-slate-700 w-16">₹10 ×</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.d10 === 0 ? "" : denominations.d10}
                placeholder="0"
                onChange={(e) => handleDenomChange("d10", e.target.value)}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold focus:outline-none focus:border-purple-500"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{(denominations.d10 * 10).toLocaleString("en-IN")}
              </span>
            </div>

            {/* Loose Coins */}
            <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <span className="font-bold text-slate-700">Loose Coins Total (₹)</span>
              <input
                type="number"
                min="0"
                disabled={isRegisterClosed}
                value={denominations.coins === 0 ? "" : denominations.coins}
                placeholder="0"
                onChange={(e) => handleDenomChange("coins", e.target.value)}
                className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold focus:outline-none focus:border-purple-500"
              />
              <span className="font-mono font-bold text-slate-900 w-24 text-right">
                ₹{denominations.coins.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Drawer Reconciliation Card */}
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
                <span>+ Actual Cash Sales:</span>
                <span className="font-mono font-bold text-slate-800">
                  ₹{metrics.cashSales.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900">
                <span>= Expected Drawer Cash:</span>
                <span className="font-mono">
                  ₹{expectedCashInDrawer.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-purple-900 bg-purple-50/80 p-2.5 rounded-xl border border-purple-100">
                <span>Counted Physical Cash:</span>
                <span className="font-mono text-sm">
                  ₹{physicalCashCounted.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Variance Indicator */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  expectedCashInDrawer === 0 && physicalCashCounted === 0
                    ? "bg-slate-50 text-slate-700 border-slate-200"
                    : cashVariance === 0
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : cashVariance > 0
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <i
                    className={`fa-solid ${
                      expectedCashInDrawer === 0 && physicalCashCounted === 0
                        ? "fa-circle-notch text-slate-400"
                        : cashVariance === 0
                        ? "fa-circle-check text-emerald-600"
                        : cashVariance > 0
                        ? "fa-circle-exclamation text-amber-600"
                        : "fa-triangle-exclamation text-rose-600"
                    }`}
                  />
                  <span className="font-bold text-xs">
                    {expectedCashInDrawer === 0 && physicalCashCounted === 0
                      ? "Drawer Empty (₹0) · Balanced"
                      : cashVariance === 0
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
              onClick={handlePrintZReport}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <i className="fa-solid fa-print" />
              <span>Print Day-End Z-Slip</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Settled Transactions Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Today&apos;s Settled Bills &amp; Payment Audit
            </h3>
            <span className="text-xs text-slate-500">
              {bills.length} bills settled today
            </span>
          </div>

          <AdminButton
            variant="outline"
            size="sm"
            leftIcon="fa-rotate"
            onClick={fetchRegisterData}
          >
            Refresh List
          </AdminButton>
        </div>

        {bills.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">Bill #</th>
                  <th className="p-3.5">Table</th>
                  <th className="p-3.5">Settled Time</th>
                  <th className="p-3.5">Payment Mode</th>
                  <th className="p-3.5 text-right">Subtotal</th>
                  <th className="p-3.5 text-right">GST (5%)</th>
                  <th className="p-3.5 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      {bill.bill_number}
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">
                      Table {bill.table_number}
                    </td>
                    <td className="p-3.5 text-slate-500">
                      {bill.created_at
                        ? new Date(bill.created_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--:--"}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          bill.payment_mode === "cash"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : bill.payment_mode === "upi" || bill.payment_mode === "online"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {bill.payment_mode}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-600">
                      ₹{bill.subtotal}
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-600">
                      ₹{bill.tax_amount}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                      ₹{bill.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center text-slate-400 space-y-2">
            <i className="fa-solid fa-receipt text-3xl text-slate-300 block mb-1" />
            <h4 className="text-xs font-bold text-slate-700">
              No bills settled for today&apos;s register yet
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Tables that complete their meals and pay via Cash, PhonePe/UPI, or Card will be listed here with timestamp and tax breakdown.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
