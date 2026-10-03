"use client";

import React, { useState, useMemo } from "react";
import AdminButton from "../ui/AdminButton";

interface MenuItemLike {
  id: string;
  name: string;
  price: number;
  category_id?: string;
  category?: string;
  is_veg?: boolean;
}

interface CategoryLike {
  id: string;
  name: string;
}

interface BulkPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItemLike[];
  categories: (string | CategoryLike)[];
  onPricesUpdated: () => Promise<void> | void;
}

export default function BulkPriceModal({
  isOpen,
  onClose,
  menuItems,
  categories,
  onPricesUpdated,
}: BulkPriceModalProps) {
  const [targetCategory, setTargetCategory] = useState<string>("all");
  const [mode, setMode] = useState<"percent" | "flat">("percent");
  const [direction, setDirection] = useState<"increase" | "decrease">("increase");
  const [adjustmentValue, setAdjustmentValue] = useState<number>(10);
  const [roundTo, setRoundTo] = useState<number>(5); // default round to ₹5
  const [isApplying, setIsApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Normalize category list
  const categoryList = useMemo(() => {
    return categories.map((c) => {
      if (typeof c === "string") return { id: c, name: c };
      return c;
    });
  }, [categories]);

  // Filter items based on category selection and search
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (targetCategory !== "all") {
        const matchesId = item.category_id === targetCategory;
        const matchesName = item.category?.toLowerCase() === targetCategory.toLowerCase();
        if (!matchesId && !matchesName) return false;
      }
      if (searchTerm) {
        if (!item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    });
  }, [menuItems, targetCategory, searchTerm]);

  // Compute live preview of new prices
  const previewItems = useMemo(() => {
    const val = Math.abs(Number(adjustmentValue) || 0);
    return filteredItems.map((item) => {
      const current = Number(item.price) || 0;
      let calculated = current;

      if (val > 0) {
        if (mode === "percent") {
          const delta = Math.round((current * val) / 100);
          calculated = direction === "increase" ? current + delta : Math.max(0, current - delta);
        } else {
          calculated = direction === "increase" ? current + val : Math.max(0, current - val);
        }

        if (roundTo > 1) {
          calculated = Math.round(calculated / roundTo) * roundTo;
          if (calculated <= 0 && current > 0) calculated = roundTo;
        }
      }

      const diff = calculated - current;
      return {
        ...item,
        currentPrice: current,
        newPrice: calculated,
        diff,
      };
    });
  }, [filteredItems, mode, direction, adjustmentValue, roundTo]);

  if (!isOpen) return null;

  const handleApply = async () => {
    if (adjustmentValue <= 0) {
      setErrorMsg("Kripya 0 se zyada rate/percent enter karein.");
      return;
    }
    if (previewItems.length === 0) {
      setErrorMsg("Koi item select nahi hua.");
      return;
    }

    const confirmMsg = `Kya aap ${previewItems.length} dishes ka rate ${
      direction === "increase" ? "badhana (+)" : "ghatana (-)"
    } ${adjustmentValue}${mode === "percent" ? "%" : "₹"} chahte hain?`;

    if (!confirm(confirmMsg)) return;

    setIsApplying(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/menu/bulk-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          direction,
          value: adjustmentValue,
          roundTo,
          itemIds: previewItems.map((p) => p.id),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Price update karne me error aaya");
      } else {
        await onPricesUpdated();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg("Error: " + (err?.message || err));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg shadow-xs">
              <i className="fa-solid fa-tags" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Bulk Price Adjustment Engine
              </h3>
              <p className="text-xs text-slate-500">
                Sabhi ya chuninda dishes ke rates ek sath % ya ₹ me badhayein/ghatayein
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Controls Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Target Scope & Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Target Category / Scope
              </label>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="all">Poora Menu (All {menuItems.length} Items)</option>
                {categoryList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Adjustment Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("percent")}
                  className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                    mode === "percent"
                      ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <i className="fa-solid fa-percent mr-1.5" />
                  Percentage (%)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("flat")}
                  className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                    mode === "flat"
                      ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <i className="fa-solid fa-indian-rupee-sign mr-1.5" />
                  Flat Amount (₹)
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Direction & Value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Action (Badhana / Ghatana)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("increase")}
                  className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                    direction === "increase"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <i className="fa-solid fa-arrow-up mr-1.5" />
                  Increase Rate (+)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("decrease")}
                  className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                    direction === "decrease"
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <i className="fa-solid fa-arrow-down mr-1.5" />
                  Decrease Rate (−)
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Value ({mode === "percent" ? "Percentage %" : "Rupees ₹"})
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    {direction === "increase" ? "+" : "−"}
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={mode === "percent" ? 100 : 5000}
                    value={adjustmentValue}
                    onChange={(e) => setAdjustmentValue(Number(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    {mode === "percent" ? "%" : "₹"}
                  </span>
                </div>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {[
                  { label: "+5%", mode: "percent", dir: "increase", val: 5 },
                  { label: "+10%", mode: "percent", dir: "increase", val: 10 },
                  { label: "+15%", mode: "percent", dir: "increase", val: 15 },
                  { label: "-10%", mode: "percent", dir: "decrease", val: 10 },
                  { label: "+₹10", mode: "flat", dir: "increase", val: 10 },
                  { label: "+₹20", mode: "flat", dir: "increase", val: 20 },
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setMode(chip.mode as any);
                      setDirection(chip.dir as any);
                      setAdjustmentValue(chip.val);
                    }}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-purple-100 hover:text-purple-900 border border-slate-200 text-[10px] font-bold text-slate-700 transition-colors cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 3: Smart Rounding Options */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-coins text-amber-600 text-sm" />
              <div>
                <span className="font-bold text-amber-950 block">Cash Rounding Convenience</span>
                <span className="text-[10px] text-amber-700">Rates ko change chutta ke jhanjhat se bachane ke liye round karein</span>
              </div>
            </div>
            <select
              value={roundTo}
              onChange={(e) => setRoundTo(Number(e.target.value))}
              className="px-2.5 py-1.5 border border-amber-300 rounded-lg text-xs font-bold text-amber-900 bg-white"
            >
              <option value="0">Exact (No Rounding)</option>
              <option value="5">Round to nearest ₹5 (e.g. ₹283 → ₹285)</option>
              <option value="10">Round to nearest ₹10 (e.g. ₹283 → ₹280)</option>
            </select>
          </div>

          {/* Row 4: Live Preview Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">
                Live Price Preview ({previewItems.length} Dishes Affected)
              </span>
              <input
                type="text"
                placeholder="Search dish in preview..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg text-[11px] w-48"
              />
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Dish Name</th>
                    <th className="py-2 px-3 text-right">Current Rate</th>
                    <th className="py-2 px-3 text-center">Change</th>
                    <th className="py-2 px-3 text-right">New Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewItems.slice(0, 100).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-medium text-slate-800 flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            item.is_veg ? "bg-emerald-600" : "bg-rose-600"
                          }`}
                        />
                        <span className="truncate max-w-[200px]">{item.name}</span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">
                        ₹{item.currentPrice}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-[11px]">
                        <span
                          className={
                            item.diff > 0
                              ? "text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded"
                              : item.diff < 0
                              ? "text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded"
                              : "text-slate-400"
                          }
                        >
                          {item.diff > 0 ? `+₹${item.diff}` : item.diff < 0 ? `−₹${Math.abs(item.diff)}` : "0"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-black font-mono text-slate-900">
                        ₹{item.newPrice}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="text-xs text-slate-500">
            Affects <strong className="text-slate-900">{previewItems.length}</strong> menu items
          </div>
          <div className="flex items-center gap-2">
            <AdminButton variant="outline" size="sm" onClick={onClose} disabled={isApplying}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              onClick={handleApply}
              disabled={isApplying || previewItems.length === 0}
              leftIcon={isApplying ? "fa-spinner fa-spin" : "fa-check"}
            >
              {isApplying
                ? "Updating Prices..."
                : `Apply to ${previewItems.length} Dishes`}
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}
