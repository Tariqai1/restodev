"use client";

import React, { useState } from "react";
import AdminButton from "../ui/AdminButton";

export interface StockoutDish {
  id: string;
  name: string;
  category: string;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  description?: string;
  photo_url?: string | null;
}

interface StockoutViewProps {
  dishes: StockoutDish[];
  onToggleStock: (dishId: string) => void;
  onRestockAll: () => void;
  isLoading?: boolean;
}

export default function StockoutView({
  dishes,
  onToggleStock,
  onRestockAll,
  isLoading = false,
}: StockoutViewProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "out" | "in">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = Array.from(new Set(dishes.map((d) => d.category)));

  const outOfStockCount = dishes.filter((d) => !d.is_available).length;
  const inStockCount = dishes.filter((d) => d.is_available).length;

  const filtered = dishes.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || d.category === categoryFilter;
    const matchesStock =
      filter === "all"
        ? true
        : filter === "out"
        ? !d.is_available
        : d.is_available;
    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <div className="space-y-5">
      {/* 86 Station Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/70 to-slate-900 rounded-2xl p-6 text-white border border-rose-900/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30 mb-2">
            <i className="fa-solid fa-ban text-[11px]" />
            <span>Instant Kitchen 86 Station</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            86 / Stock Out Controller
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-lg leading-relaxed">
            1-Click toggles to immediately stop customer orders for sold-out dishes.
            Dishes marked 86 are hidden or marked sold-out across all QR table menus in realtime.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-white/10 text-center">
            <span className="block text-2xl font-black text-rose-400 font-mono leading-none">
              {outOfStockCount}
            </span>
            <span className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
              Sold Out (86&apos;d)
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-white/10 text-center">
            <span className="block text-2xl font-black text-emerald-400 font-mono leading-none">
              {inStockCount}
            </span>
            <span className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">
              In Stock
            </span>
          </div>

          {outOfStockCount > 0 && (
            <AdminButton
              variant="outline"
              size="md"
              onClick={onRestockAll}
              className="bg-white text-slate-900 hover:bg-slate-100 border-none font-bold"
            >
              <i className="fa-solid fa-rotate-left mr-1.5" />
              Restock All ({outOfStockCount})
            </AdminButton>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              type="text"
              placeholder="Search dishes to 86 or restock..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Status Segmented Buttons */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              filter === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Items ({dishes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("out")}
            className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
              filter === "out"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-rose-700 hover:text-rose-900"
            }`}
          >
            <i className="fa-solid fa-ban text-[10px]" />
            <span>86&apos;d Out ({outOfStockCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("in")}
            className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
              filter === "in"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-emerald-700 hover:text-emerald-900"
            }`}
          >
            <i className="fa-solid fa-check text-[10px]" />
            <span>In Stock ({inStockCount})</span>
          </button>
        </div>
      </div>

      {/* Grid of Dishes with 1-Click Toggles */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400">
          <i className="fa-solid fa-spinner fa-spin text-2xl mb-2" />
          <p className="text-xs font-semibold">Loading stock catalog...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <i className="fa-solid fa-circle-check text-xl text-emerald-500" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">
            {filter === "out"
              ? "All Dishes In Stock!"
              : "No dishes matching search criteria"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {filter === "out"
              ? "None of your dishes are currently 86'd. All items are active on the live QR menu."
              : "Try clearing search or filters to see dishes."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((dish) => {
            const isAvailable = dish.is_available;
            return (
              <div
                key={dish.id}
                className={`rounded-2xl border p-4 transition-all duration-150 flex flex-col justify-between ${
                  isAvailable
                    ? "bg-white border-slate-200/90 shadow-2xs hover:shadow-xs"
                    : "bg-rose-50/40 border-rose-200 shadow-2xs"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Photo or placeholder */}
                  {dish.photo_url ? (
                    <img
                      src={dish.photo_url}
                      alt={dish.name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <i className="fa-solid fa-utensils text-sm" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-xs border flex items-center justify-center shrink-0 ${
                          dish.is_veg ? "border-green-600" : "border-red-600"
                        }`}
                      >
                        <span
                          className={`w-1 h-1 rounded-full ${
                            dish.is_veg ? "bg-green-600" : "bg-red-600"
                          }`}
                        />
                      </span>
                      <h4
                        className={`font-bold text-xs truncate ${
                          isAvailable
                            ? "text-slate-900"
                            : "text-slate-500 line-through"
                        }`}
                      >
                        {dish.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-semibold">{dish.category}</span>
                      <span>•</span>
                      <span className="font-mono font-bold text-slate-800">
                        ₹{dish.price}
                      </span>
                    </div>

                    {dish.description && (
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {dish.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* 1-Click Toggle Button */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span
                    className={`text-[11px] font-bold flex items-center gap-1.5 ${
                      isAvailable ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    <i
                      className={`fa-solid ${
                        isAvailable ? "fa-circle-check" : "fa-ban"
                      } text-[10px]`}
                    />
                    <span>{isAvailable ? "Available on Menu" : "86'd / Sold Out"}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => onToggleStock(dish.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 ${
                      isAvailable
                        ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    }`}
                    title={
                      isAvailable
                        ? "1-Click to 86 this item"
                        : "1-Click to restore this item"
                    }
                  >
                    <i
                      className={`fa-solid ${
                        isAvailable ? "fa-ban" : "fa-rotate-left"
                      } text-[11px]`}
                    />
                    <span>{isAvailable ? "86 This Dish" : "Mark In Stock"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
