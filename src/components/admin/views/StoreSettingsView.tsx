"use client";

import React, { useState } from "react";
import AdminButton from "../ui/AdminButton";
import AdminBadge from "../ui/AdminBadge";

interface StoreSettingsViewProps {
  initialName?: string;
}

export default function StoreSettingsView({
  initialName = "Order Desk Restaurant",
}: StoreSettingsViewProps) {
  const [storeName, setStoreName] = useState(initialName);
  const [phone, setPhone] = useState("+91 98765 43210");
  const [address, setAddress] = useState("Shop 12-14, Food Street, Indiranagar, Bengaluru, KA 560038");
  const [gstin, setGstin] = useState("29ABCDE1234F1Z5");
  const [fssai, setFssai] = useState("11223344556677");
  const [serviceCharge, setServiceCharge] = useState(false);
  const [serviceChargePct, setServiceChargePct] = useState(5);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 mb-2">
            <i className="fa-solid fa-gears text-[11px]" />
            <span>Store Configuration &amp; Legal Profile</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Administration &amp; Store Profile
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure restaurant identity, statutory tax identifiers (GSTIN/FSSAI), and table ordering parameters.
          </p>
        </div>

        <AdminButton
          variant="primary"
          size="sm"
          leftIcon="fa-floppy-disk"
          onClick={handleSave}
        >
          Save Store Settings
        </AdminButton>
      </div>

      {isSaved && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600" />
          <span>Store settings and statutory identifiers saved successfully.</span>
        </div>
      )}

      {/* Store Identity */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
          Restaurant Identity &amp; Contact
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Restaurant Brand Name *
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-semibold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Store Support Phone *
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Physical Outlet Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Statutory & Tax IDs */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
          Statutory Compliance &amp; Tax Credentials
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              GSTIN (Goods &amp; Services Tax Identification #)
            </label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono font-bold"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Printed on thermal tax invoices
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              FSSAI Food Safety License Number
            </label>
            <input
              type="text"
              value={fssai}
              onChange={(e) => setFssai(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono font-bold"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Required on customer bills under FSSAI Act
            </span>
          </div>
        </div>
      </div>

      {/* Operational Features */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
          Dine-In Billing &amp; Service Charge
        </h3>

        <div className="space-y-3 text-xs">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 block">
                Discretionary Service Charge
              </span>
              <span className="text-[11px] text-slate-500">
                Optional gratuity levy added to food bills
              </span>
            </div>
            <div className="flex items-center gap-3">
              {serviceCharge && (
                <div className="flex items-center gap-1 font-mono font-bold">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={serviceChargePct}
                    onChange={(e) => setServiceChargePct(Number(e.target.value) || 5)}
                    className="w-14 px-2 py-1 border border-slate-300 rounded-lg text-center"
                  />
                  <span>%</span>
                </div>
              )}
              <input
                type="checkbox"
                checked={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
