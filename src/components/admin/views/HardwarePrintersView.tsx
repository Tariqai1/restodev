"use client";

import React, { useState } from "react";
import AdminButton from "../ui/AdminButton";
import AdminBadge from "../ui/AdminBadge";

interface PrinterDevice {
  id: string;
  name: string;
  role: "kot" | "bill" | "bar";
  interfaceType: "network" | "usb" | "bluetooth";
  paperWidth: "80mm" | "58mm";
  ipAddress?: string;
  isOnline: boolean;
  autoCut: boolean;
}

const DEFAULT_PRINTERS: PrinterDevice[] = [
  {
    id: "prn-1",
    name: "Main Kitchen KOT (Epson TM-T82X)",
    role: "kot",
    interfaceType: "network",
    paperWidth: "80mm",
    ipAddress: "192.168.1.201",
    isOnline: true,
    autoCut: true,
  },
  {
    id: "prn-2",
    name: "Billing Counter Receipt (TVS RP-3200)",
    role: "bill",
    interfaceType: "usb",
    paperWidth: "80mm",
    ipAddress: "COM4 / USB001",
    isOnline: true,
    autoCut: true,
  },
  {
    id: "prn-3",
    name: "Bar & Beverages Slip (Everycom 58mm)",
    role: "bar",
    interfaceType: "bluetooth",
    paperWidth: "58mm",
    isOnline: false,
    autoCut: false,
  },
];

export default function HardwarePrintersView() {
  const [printers, setPrinters] = useState<PrinterDevice[]>(DEFAULT_PRINTERS);
  const [testPrintSuccess, setTestPrintSuccess] = useState<string | null>(null);

  const handleTestPrint = (printer: PrinterDevice) => {
    setTestPrintSuccess(`Sent test slip to "${printer.name}" (${printer.paperWidth} ESC/POS)`);
    setTimeout(() => {
      setTestPrintSuccess(null);
    }, 4000);
  };

  const handleToggleOnline = (id: string) => {
    setPrinters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isOnline: !p.isOnline } : p))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 mb-2">
            <i className="fa-solid fa-print text-[11px]" />
            <span>ESC/POS Hardware Terminal</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Hardware &amp; Thermal Printers
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure 80mm &amp; 58mm thermal printers for automatic KOT routing, invoice receipts, and cash drawer kick.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <AdminButton
            variant="outline"
            size="sm"
            leftIcon="fa-plus"
            onClick={() => alert("Add Printer wizard ready. Select network IP or USB port.")}
          >
            Add New Printer
          </AdminButton>
        </div>
      </div>

      {testPrintSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600" />
          <span>{testPrintSuccess}</span>
        </div>
      )}

      {/* Printer Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {printers.map((prn) => (
          <div
            key={prn.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    prn.isOnline
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      prn.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  <span>{prn.isOnline ? "Online" : "Offline"}</span>
                </span>

                <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                  {prn.paperWidth} ESC/POS
                </span>
              </div>

              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 text-base">
                  <i className="fa-solid fa-print" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm truncate">{prn.name}</h3>
                  <span className="text-xs text-slate-500 capitalize block">
                    Role: {prn.role === "kot" ? "Kitchen KOT" : prn.role === "bill" ? "Bill Receipt" : "Bar KOT"}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1.5 border-t border-slate-100 pt-3">
                <div className="flex justify-between">
                  <span>Interface:</span>
                  <span className="font-semibold capitalize text-slate-800">
                    {prn.interfaceType}
                  </span>
                </div>
                {prn.ipAddress && (
                  <div className="flex justify-between">
                    <span>Address / Port:</span>
                    <span className="font-mono text-slate-700">{prn.ipAddress}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Auto-Cutter:</span>
                  <span className="font-semibold text-slate-800">
                    {prn.autoCut ? "Enabled" : "Manual Tear"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
              <AdminButton
                variant="primary"
                size="sm"
                leftIcon="fa-paper-plane"
                onClick={() => handleTestPrint(prn)}
                className="flex-1 text-xs"
              >
                Test Print
              </AdminButton>
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => handleToggleOnline(prn.id)}
                className="text-xs"
              >
                {prn.isOnline ? "Disable" : "Enable"}
              </AdminButton>
            </div>
          </div>
        ))}
      </div>

      {/* Hardware Station Rules */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Hardware Automation Rules
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 block">
                Auto-print KOT on Captain Approval
              </span>
              <span className="text-[11px] text-slate-500">
                Immediately dispatches ticket to Kitchen printer upon captain order check
              </span>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 block">
                Open Electronic Cash Drawer on Bill Settle
              </span>
              <span className="text-[11px] text-slate-500">
                Sends RJ11 pulse to kick open cash drawer when payment mode is Cash
              </span>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
