"use client";

import React, { useState } from "react";
import AdminButton from "../ui/AdminButton";
import AdminBadge from "../ui/AdminBadge";

interface MonthlyTaxRecord {
  month: string;
  taxableSales: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  status: "filed" | "due" | "upcoming";
}

const FY_DATA: Record<string, MonthlyTaxRecord[]> = {
  "2025-2026": [
    { month: "April 2025", taxableSales: 480000, cgst: 12000, sgst: 12000, totalGst: 24000, status: "filed" },
    { month: "May 2025", taxableSales: 520000, cgst: 13000, sgst: 13000, totalGst: 26000, status: "filed" },
    { month: "June 2025", taxableSales: 510000, cgst: 12750, sgst: 12750, totalGst: 25500, status: "filed" },
    { month: "July 2025", taxableSales: 590000, cgst: 14750, sgst: 14750, totalGst: 29500, status: "filed" },
    { month: "August 2025", taxableSales: 630000, cgst: 15750, sgst: 15750, totalGst: 31500, status: "filed" },
    { month: "September 2025", taxableSales: 610000, cgst: 15250, sgst: 15250, totalGst: 30500, status: "due" },
  ],
  "2024-2025": [
    { month: "March 2025", taxableSales: 450000, cgst: 11250, sgst: 11250, totalGst: 22500, status: "filed" },
    { month: "February 2025", taxableSales: 430000, cgst: 10750, sgst: 10750, totalGst: 21500, status: "filed" },
    { month: "January 2025", taxableSales: 470000, cgst: 11750, sgst: 11750, totalGst: 23500, status: "filed" },
  ],
};

export default function TaxesView() {
  const [selectedFY, setSelectedFY] = useState("2025-2026");

  const records = FY_DATA[selectedFY] || [];

  const totalTaxable = records.reduce((s, r) => s + r.taxableSales, 0);
  const totalCgst = records.reduce((s, r) => s + r.cgst, 0);
  const totalSgst = records.reduce((s, r) => s + r.sgst, 0);
  const totalGst = records.reduce((s, r) => s + r.totalGst, 0);

  const handleExportTaxReport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Month,Taxable Sales,CGST (2.5%),SGST (2.5%),Total GST (5%),Filing Status"]
        .concat(
          records.map(
            (r) =>
              `"${r.month}",${r.taxableSales},${r.cgst},${r.sgst},${r.totalGst},"${r.status}"`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GST-Report-${selectedFY}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200 mb-2">
            <i className="fa-solid fa-file-invoice text-[11px]" />
            <span>Statutory Goods &amp; Services Tax (GST)</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Taxes &amp; Financial Year Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            SAC Code 996331 · 5% Flat Restaurant GST (2.5% CGST + 2.5% SGST) · B2C Monthly Turnover &amp; GSTR-3B Computation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
          >
            <option value="2025-2026">Financial Year 2025-2026</option>
            <option value="2024-2025">Financial Year 2024-2025</option>
          </select>

          <AdminButton
            variant="outline"
            size="sm"
            leftIcon="fa-file-arrow-down"
            onClick={handleExportTaxReport}
          >
            Download GSTR-3B (CSV)
          </AdminButton>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">
            Total Taxable Turnover
          </span>
          <span className="text-2xl font-black text-slate-900 font-mono block">
            ₹{totalTaxable.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            FY {selectedFY} Net Sales
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">
            Central GST (CGST 2.5%)
          </span>
          <span className="text-2xl font-black text-blue-600 font-mono block">
            ₹{totalCgst.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Government of India Treasury
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">
            State GST (SGST 2.5%)
          </span>
          <span className="text-2xl font-black text-indigo-600 font-mono block">
            ₹{totalSgst.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            State Commercial Tax Dept
          </span>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block mb-1">
            Total GST Collected (5%)
          </span>
          <span className="text-2xl font-black text-emerald-600 font-mono block">
            ₹{totalGst.toLocaleString("en-IN")}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
            No ITC restriction applied
          </span>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Monthly Tax Collections &amp; GSTR Filing Summary
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            HSN/SAC: 996331 (Restaurant Food Services)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3.5">Tax Period</th>
                <th className="p-3.5 text-right">Taxable Turnover</th>
                <th className="p-3.5 text-right">CGST (2.5%)</th>
                <th className="p-3.5 text-right">SGST (2.5%)</th>
                <th className="p-3.5 text-right">Total Tax (5%)</th>
                <th className="p-3.5 text-center">Filing Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3.5 font-bold text-slate-900">{r.month}</td>
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
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        r.status === "filed"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          r.status === "filed" ? "fa-check" : "fa-clock"
                        } text-[9px]`}
                      />
                      <span>{r.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
