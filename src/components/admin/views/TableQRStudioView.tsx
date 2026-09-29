"use client";

import React, { useState } from "react";
import AdminButton from "../ui/AdminButton";
import AdminBadge from "../ui/AdminBadge";

export interface TableItem {
  id: string;
  table_number: string;
  qr_token: string;
  status: "available" | "occupied" | "reserved" | "billing";
  active_bill_amount?: number;
}

interface TableQRStudioViewProps {
  tables: TableItem[];
  restaurantName?: string;
}

export default function TableQRStudioView({
  tables,
  restaurantName = "Order Desk",
}: TableQRStudioViewProps) {
  const [selectedTable, setSelectedTable] = useState<TableItem>(tables[0] || {
    id: "t-1",
    table_number: "1",
    qr_token: "tbl_demo_1",
    status: "available",
  });
  const [accentColor, setAccentColor] = useState<string>("#7c3aed"); // Purple

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://orderdesk.app";
  const tableUrl = `${baseUrl}/table/${selectedTable.qr_token}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
    tableUrl
  )}&margin=10`;

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-50 text-purple-800 text-xs font-bold border border-purple-200 mb-2">
            <i className="fa-solid fa-qrcode text-[11px]" />
            <span>Table Standee &amp; QR Design Studio</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Table QR Studio
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate high-resolution acrylic tent cards, stickers, and digital QR codes for all dining tables.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <AdminButton
            variant="primary"
            size="sm"
            leftIcon="fa-print"
            onClick={() => window.print()}
          >
            Print All Table Stands
          </AdminButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Table List & Controls */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Select Table</h3>
            <span className="text-xs font-mono text-slate-500">
              {tables.length} tables registered
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto">
            {tables.map((tbl) => (
              <button
                key={tbl.id}
                type="button"
                onClick={() => setSelectedTable(tbl)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedTable.id === tbl.id
                    ? "border-purple-600 bg-purple-50 text-purple-900 font-extrabold ring-2 ring-purple-200"
                    : "border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50"
                }`}
              >
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">
                  Table
                </span>
                <span className="text-lg font-black block leading-none my-1 font-mono">
                  {tbl.table_number}
                </span>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    tbl.status === "occupied" ? "bg-purple-500" : "bg-emerald-500"
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Target URL
              </label>
              <input
                type="text"
                readOnly
                value={tableUrl}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 font-mono text-[11px] text-slate-600 truncate"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Accent Theme:</span>
              <div className="flex items-center gap-1.5">
                {["#7c3aed", "#b91c1c", "#0284c7", "#059669", "#d97706"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAccentColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                      accentColor === c ? "ring-2 ring-offset-2 ring-slate-800 scale-110" : ""
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Acrylic Table Card Live Mockup */}
        <div className="lg:col-span-2 bg-slate-100 border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center">
          <div className="w-[300px] bg-white rounded-2xl p-6 shadow-xl border border-slate-200 text-center space-y-4 relative overflow-hidden">
            {/* Top decorative stripe */}
            <div
              className="absolute top-0 left-0 right-0 h-2.5"
              style={{ backgroundColor: accentColor }}
            />

            <div>
              <span className="text-[11px] uppercase tracking-widest text-slate-400 font-bold block">
                Welcome To
              </span>
              <h4 className="text-base font-extrabold text-slate-900 tracking-tight">
                {restaurantName}
              </h4>
            </div>

            {/* Table Number Pill */}
            <div className="inline-block px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200">
              <span className="text-xs uppercase font-bold text-slate-600 tracking-wider">
                Table <strong className="text-slate-900 font-black text-sm">{selectedTable.table_number}</strong>
              </span>
            </div>

            {/* QR Image */}
            <div className="p-3 bg-white border-2 border-slate-900 rounded-2xl inline-block shadow-inner">
              <img
                src={qrApiUrl}
                alt={`QR code for Table ${selectedTable.table_number}`}
                className="w-48 h-48 object-contain rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1.5 font-bold text-xs text-slate-800">
                <i className="fa-solid fa-mobile-screen-button text-purple-600" />
                <span>Scan with Camera to Order</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Browse Live Menu · Custom Portions · Instant Service
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <a
              href={qrApiUrl}
              download={`Table-${selectedTable.table_number}-QR.png`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-2"
            >
              <i className="fa-solid fa-download" />
              <span>Download PNG</span>
            </a>
            <button
              type="button"
              onClick={() => alert(`Copied table QR link: ${tableUrl}`)}
              className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-link" />
              <span>Copy Link</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
