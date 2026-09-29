"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminButton from "../ui/AdminButton";

export type GstFilingStatusValue = "filed" | "due" | "upcoming" | "no_liability";

interface MonthlyTaxRecord {
  monthKey: string;
  month: string;
  year: number;
  monthIndex: number;
  taxableSales: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  billCount: number;
  status: GstFilingStatusValue;
  isCurrentOrFuture: boolean;
}

interface TaxReportData {
  ok: boolean;
  selectedFY: string;
  availableFYs: string[];
  gstin: string | null;
  restaurantName: string;
  totals: {
    totalTaxable: number;
    totalCgst: number;
    totalSgst: number;
    totalGst: number;
    totalBills: number;
  };
  records: MonthlyTaxRecord[];
}

export default function TaxesView() {
  const [selectedFY, setSelectedFY] = useState<string>("");
  const [reportData, setReportData] = useState<TaxReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [updatingMonthKey, setUpdatingMonthKey] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Fetch tax data from server
  const fetchTaxData = useCallback(async (fy?: string) => {
    try {
      const url = fy ? `/api/taxes?fy=${encodeURIComponent(fy)}` : "/api/taxes";
      const res = await fetch(url);
      if (res.ok) {
        const data: TaxReportData = await res.json();
        setReportData(data);
        if (!selectedFY || (fy && fy !== selectedFY)) {
          setSelectedFY(data.selectedFY);
        }
      }
    } catch (err) {
      console.error("Failed to fetch tax reports:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedFY]);

  useEffect(() => {
    fetchTaxData(selectedFY || undefined);
  }, [fetchTaxData, selectedFY]);

  // Handle FY change
  const handleFYChange = (newFY: string) => {
    setSelectedFY(newFY);
    setIsLoading(true);
    fetchTaxData(newFY);
  };

  // Toggle or change filing status
  const handleUpdateStatus = async (monthKey: string, newStatus: GstFilingStatusValue) => {
    setUpdatingMonthKey(monthKey);
    try {
      const res = await fetch("/api/taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthKey, status: newStatus }),
      });
      if (res.ok) {
        // Optimistically update local state
        setReportData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            records: prev.records.map((r) =>
              r.monthKey === monthKey ? { ...r, status: newStatus } : r
            ),
          };
        });
      }
    } catch (err) {
      console.error("Failed to update GST filing status:", err);
    } finally {
      setUpdatingMonthKey(null);
    }
  };

  // Export GSTR-3B CSV
  const handleExportTaxReport = () => {
    if (!reportData) return;
    const records = reportData.records || [];
    const fy = reportData.selectedFY || selectedFY || "FY";

    const rows = [
      "Financial Year,Tax Period (Month),SAC Code,Category,Taxable Turnover (INR),CGST 2.5% (INR),SGST 2.5% (INR),Total GST 5% (INR),Settled Bill Count,GSTR Filing Status",
    ];

    records.forEach((r) => {
      rows.push(
        `"${fy}","${r.month}","996331","Restaurant Services - 5% B2C",${r.taxableSales},${r.cgst},${r.sgst},${r.totalGst},${r.billCount},"${r.status.toUpperCase()}"`
      );
    });

    // Add totals row
    rows.push(
      `"${fy}","TOTAL FY SUMMARY","996331","Restaurant Services",${reportData.totals.totalTaxable},${reportData.totals.totalCgst},${reportData.totals.totalSgst},${reportData.totals.totalGst},${reportData.totals.totalBills},"SUMMARY"`
    );

    const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GSTR-3B-Summary-${fy}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const records = reportData?.records || [];
  const totals = reportData?.totals || {
    totalTaxable: 0,
    totalCgst: 0,
    totalSgst: 0,
    totalGst: 0,
    totalBills: 0,
  };
  const availableFYs = reportData?.availableFYs || [selectedFY || "2025-2026"];
  const hasAnySales = totals.totalTaxable > 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200 mb-2">
            <i className="fa-solid fa-file-invoice text-[11px]" />
            <span>Statutory Goods &amp; Services Tax (GST) · Real-Time Dynamic</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Taxes &amp; Financial Year Management</span>
            {isRefreshing && (
              <i className="fa-solid fa-arrows-rotate fa-spin text-sm text-slate-400" />
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            SAC Code 996331 · 5% Flat Restaurant GST (2.5% CGST + 2.5% SGST) · B2C Monthly Turnover &amp; GSTR-3B Computation
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-slate-700">
              GSTIN:{" "}
              {reportData?.gstin ? (
                <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {reportData.gstin}
                </span>
              ) : (
                <span className="font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Not Registered / Composition B2C
                </span>
              )}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 font-medium">
              Tax Basis: <strong className="text-slate-800">5% without ITC</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">FY:</span>
            <select
              value={selectedFY || reportData?.selectedFY || ""}
              onChange={(e) => handleFYChange(e.target.value)}
              disabled={isLoading}
              className="px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs"
            >
              {availableFYs.map((fy) => (
                <option key={fy} value={fy}>
                  Financial Year {fy}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              fetchTaxData(selectedFY);
            }}
            disabled={isRefreshing}
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors text-xs font-semibold flex items-center justify-center cursor-pointer shadow-2xs"
            title="Refresh Tax Data"
          >
            <i className={`fa-solid fa-arrows-rotate ${isRefreshing ? "fa-spin" : ""}`} />
          </button>

          <AdminButton
            variant="outline"
            size="sm"
            leftIcon="fa-print"
            onClick={() => setShowPrintModal(true)}
            disabled={isLoading}
          >
            Print Statement
          </AdminButton>

          <AdminButton
            variant="outline"
            size="sm"
            leftIcon="fa-file-arrow-down"
            onClick={handleExportTaxReport}
            disabled={isLoading}
          >
            Download GSTR-3B (CSV)
          </AdminButton>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Taxable Turnover */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-semibold">
              Total Taxable Turnover
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-1.5 py-0.5 rounded font-bold">
              {totals.totalBills} Bills
            </span>
          </div>
          <span className="text-2xl font-black text-slate-900 font-mono block">
            {isLoading ? (
              <span className="inline-block w-24 h-7 bg-slate-100 rounded animate-pulse" />
            ) : (
              `₹${totals.totalTaxable.toLocaleString("en-IN")}`
            )}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            FY {selectedFY || reportData?.selectedFY} Net Sales (excl. GST)
          </span>
        </div>

        {/* Central GST */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-semibold">
              Central GST (CGST 2.5%)
            </span>
            <i className="fa-solid fa-landmark text-xs text-blue-500" />
          </div>
          <span className="text-2xl font-black text-blue-600 font-mono block">
            {isLoading ? (
              <span className="inline-block w-20 h-7 bg-blue-50 rounded animate-pulse" />
            ) : (
              `₹${totals.totalCgst.toLocaleString("en-IN")}`
            )}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Central Govt Commercial Tax
          </span>
        </div>

        {/* State GST */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-semibold">
              State GST (SGST 2.5%)
            </span>
            <i className="fa-solid fa-building-columns text-xs text-indigo-500" />
          </div>
          <span className="text-2xl font-black text-indigo-600 font-mono block">
            {isLoading ? (
              <span className="inline-block w-20 h-7 bg-indigo-50 rounded animate-pulse" />
            ) : (
              `₹${totals.totalSgst.toLocaleString("en-IN")}`
            )}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            State Commercial Tax Dept
          </span>
        </div>

        {/* Total GST Collected */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 font-semibold">
              Total GST Liability (5%)
            </span>
            <i className="fa-solid fa-receipt text-xs text-emerald-500" />
          </div>
          <span className="text-2xl font-black text-emerald-600 font-mono block">
            {isLoading ? (
              <span className="inline-block w-20 h-7 bg-emerald-50 rounded animate-pulse" />
            ) : (
              `₹${totals.totalGst.toLocaleString("en-IN")}`
            )}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
            {hasAnySales ? "Calculated on paid bills" : "No liability recorded"}
          </span>
        </div>
      </div>

      {/* Zero / Null State Notice if no bills settled in this FY */}
      {!isLoading && !hasAnySales && (
        <div className="p-4 bg-amber-50/70 border border-dashed border-amber-200 rounded-2xl flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 mt-0.5">
            <i className="fa-solid fa-circle-info text-sm" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-900">
              No Settled Bills for Financial Year {selectedFY || reportData?.selectedFY}
            </h4>
            <p className="text-[11px] text-amber-800/80 mt-0.5 leading-relaxed">
              Taxes are computed strictly from real settled customer invoices in the database.
              As orders are completed and marked as paid via QR, UPI, Cash or Card, their SAC 996331 5% GST
              breakdown (2.5% CGST + 2.5% SGST) will be logged into their respective calendar months below automatically.
            </p>
          </div>
        </div>
      )}

      {/* Monthly Breakdown Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Monthly Tax Collections &amp; GSTR-3B Computation Summary
            </h3>
            <p className="text-[11px] text-slate-500">
              Click on the filing status badge to update return submission status.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200 self-start sm:self-auto">
            HSN/SAC: 996331 (Food &amp; Beverage)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3.5">Tax Period</th>
                <th className="p-3.5 text-center">Settled Bills</th>
                <th className="p-3.5 text-right">Taxable Turnover</th>
                <th className="p-3.5 text-right">CGST (2.5%)</th>
                <th className="p-3.5 text-right">SGST (2.5%)</th>
                <th className="p-3.5 text-right">Total Tax (5%)</th>
                <th className="p-3.5 text-center">Filing Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <i className="fa-solid fa-circle-notch fa-spin text-lg mb-2 block" />
                    <span>Loading GST records for FY {selectedFY}...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <span>No records available.</span>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isUpdating = updatingMonthKey === r.monthKey;
                  const isZeroMonth = r.taxableSales === 0;

                  return (
                    <tr
                      key={r.monthKey}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isZeroMonth ? "opacity-75" : ""
                      }`}
                    >
                      <td className="p-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{r.month}</span>
                          {r.isCurrentOrFuture && (
                            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold">
                              Current
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-center font-mono">
                        {r.billCount > 0 ? (
                          <span className="font-semibold text-slate-800">
                            {r.billCount}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">0</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right font-mono font-semibold text-slate-800">
                        ₹{r.taxableSales.toLocaleString("en-IN")}
                      </td>

                      <td className="p-3.5 text-right font-mono text-slate-600">
                        ₹{r.cgst.toLocaleString("en-IN")}
                      </td>

                      <td className="p-3.5 text-right font-mono text-slate-600">
                        ₹{r.sgst.toLocaleString("en-IN")}
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                        ₹{r.totalGst.toLocaleString("en-IN")}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {r.status === "filed" ? (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleUpdateStatus(r.monthKey, "due")}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="Click to toggle to Due"
                            >
                              <i className="fa-solid fa-check text-[9px]" />
                              <span>Filed</span>
                            </button>
                          ) : r.status === "due" ? (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleUpdateStatus(r.monthKey, "filed")}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                              title="Click to mark as Filed"
                            >
                              <i className="fa-solid fa-clock text-[9px]" />
                              <span>Due</span>
                            </button>
                          ) : r.status === "upcoming" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-500 border border-slate-200">
                              <i className="fa-solid fa-calendar text-[9px]" />
                              <span>Upcoming</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-400 border border-slate-200">
                              <i className="fa-solid fa-minus text-[9px]" />
                              <span>Nil</span>
                            </span>
                          )}

                          {isUpdating && (
                            <i className="fa-solid fa-circle-notch fa-spin text-[10px] text-purple-600" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer: Totals */}
            {!isLoading && records.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/80 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                  <td className="p-3.5 uppercase tracking-wide">
                    FY {selectedFY || reportData?.selectedFY} TOTAL
                  </td>
                  <td className="p-3.5 text-center font-mono">
                    {totals.totalBills} bills
                  </td>
                  <td className="p-3.5 text-right font-mono">
                    ₹{totals.totalTaxable.toLocaleString("en-IN")}
                  </td>
                  <td className="p-3.5 text-right font-mono text-blue-700">
                    ₹{totals.totalCgst.toLocaleString("en-IN")}
                  </td>
                  <td className="p-3.5 text-right font-mono text-indigo-700">
                    ₹{totals.totalSgst.toLocaleString("en-IN")}
                  </td>
                  <td className="p-3.5 text-right font-mono text-emerald-700 font-black">
                    ₹{totals.totalGst.toLocaleString("en-IN")}
                  </td>
                  <td className="p-3.5 text-center text-slate-500 text-[10px] uppercase font-mono">
                    GST-Compliant
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Printable Statement Modal */}
      {showPrintModal && reportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-file-invoice text-purple-600 text-base" />
                <h3 className="font-bold text-sm text-slate-900">
                  GSTR-3B Tax Statement · FY {reportData.selectedFY}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Printable Content */}
            <div className="p-6 overflow-y-auto space-y-4 print:p-0" id="printable-tax-statement">
              <div className="text-center border-b pb-4">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                  {reportData.restaurantName}
                </h2>
                <p className="text-xs font-semibold text-slate-600 mt-0.5">
                  Goods &amp; Services Tax (GST) · GSTR-3B Computation Statement
                </p>
                <div className="mt-2 text-xs font-mono text-slate-500">
                  GSTIN: {reportData.gstin || "Unregistered / Composition B2C"} | SAC: 996331
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Financial Year: {reportData.selectedFY} | Generated on: {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}
                </div>
              </div>

              {/* Summary Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Taxable Turnover</span>
                  <span className="font-mono font-bold text-slate-900">₹{totals.totalTaxable.toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">CGST (2.5%)</span>
                  <span className="font-mono font-bold text-blue-700">₹{totals.totalCgst.toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">SGST (2.5%)</span>
                  <span className="font-mono font-bold text-indigo-700">₹{totals.totalSgst.toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Total GST (5%)</span>
                  <span className="font-mono font-black text-emerald-700">₹{totals.totalGst.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Statement Table */}
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 font-bold text-slate-700 bg-slate-100">
                    <th className="p-2">Period</th>
                    <th className="p-2 text-center">Bills</th>
                    <th className="p-2 text-right">Taxable (₹)</th>
                    <th className="p-2 text-right">CGST (₹)</th>
                    <th className="p-2 text-right">SGST (₹)</th>
                    <th className="p-2 text-right">Total GST (₹)</th>
                    <th className="p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {records.map((r) => (
                    <tr key={r.monthKey}>
                      <td className="p-2 font-medium">{r.month}</td>
                      <td className="p-2 text-center font-mono">{r.billCount}</td>
                      <td className="p-2 text-right font-mono">₹{r.taxableSales.toLocaleString("en-IN")}</td>
                      <td className="p-2 text-right font-mono">₹{r.cgst.toLocaleString("en-IN")}</td>
                      <td className="p-2 text-right font-mono">₹{r.sgst.toLocaleString("en-IN")}</td>
                      <td className="p-2 text-right font-mono font-bold">₹{r.totalGst.toLocaleString("en-IN")}</td>
                      <td className="p-2 text-center uppercase font-mono text-[10px]">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-400 font-bold text-slate-900 bg-slate-50">
                    <td className="p-2 uppercase">TOTAL</td>
                    <td className="p-2 text-center font-mono">{totals.totalBills}</td>
                    <td className="p-2 text-right font-mono">₹{totals.totalTaxable.toLocaleString("en-IN")}</td>
                    <td className="p-2 text-right font-mono">₹{totals.totalCgst.toLocaleString("en-IN")}</td>
                    <td className="p-2 text-right font-mono">₹{totals.totalSgst.toLocaleString("en-IN")}</td>
                    <td className="p-2 text-right font-mono">₹{totals.totalGst.toLocaleString("en-IN")}</td>
                    <td className="p-2 text-center">-</td>
                  </tr>
                </tfoot>
              </table>

              <div className="pt-4 border-t text-[10px] text-slate-400 leading-normal">
                * Note: Food service supplies under Section 9(1) of CGST Act at 5% rate without ITC restriction under SAC 996331.
                This document is a computer-generated summary statement of electronic point-of-sale settlements.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setShowPrintModal(false)}
              >
                Close
              </AdminButton>
              <AdminButton
                variant="primary"
                size="sm"
                leftIcon="fa-print"
                onClick={() => {
                  window.print();
                }}
              >
                Print / Save PDF
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
