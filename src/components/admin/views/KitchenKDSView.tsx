"use client";

import React, { useState } from "react";
import AdminButton from "../ui/AdminButton";
import AdminBadge from "../ui/AdminBadge";

export interface KdsOrder {
  id: string;
  table_number: string;
  customer_name?: string;
  status: "placed" | "pending" | "preparing" | "served" | "completed" | "cancelled";
  items_count?: number;
  item_count?: number;
  total_amount: number;
  created_at: string;
  notes?: string;
  order_items?: Array<{
    id: string;
    name: string;
    qty: number;
    is_veg: boolean;
    notes?: string;
    status: "pending" | "preparing" | "ready";
  }>;
}

interface KitchenKDSViewProps {
  orders: KdsOrder[];
  onUpdateOrderStatus: (orderId: string, newStatus: "preparing" | "served" | "completed") => void;
  onRefresh?: () => void;
}

export default function KitchenKDSView({
  orders,
  onUpdateOrderStatus,
  onRefresh,
}: KitchenKDSViewProps) {
  const [stationFilter, setStationFilter] = useState<"all" | "veg" | "nonveg">("all");
  const [search, setSearch] = useState("");

  // Filter only active orders for KDS (placed/pending, preparing, served)
  const activeOrders = orders.filter(
    (o) => o.status === "placed" || o.status === "pending" || o.status === "preparing" || o.status === "served"
  );

  const pendingOrders = activeOrders.filter((o) => o.status === "placed" || o.status === "pending");
  const preparingOrders = activeOrders.filter((o) => o.status === "preparing");
  const readyOrders = activeOrders.filter((o) => o.status === "served");

  const getElapsedTime = (isoString: string) => {
    const elapsedSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    const mins = Math.floor(elapsedSec / 60);
    return `${mins}m ago`;
  };

  const isOrderLate = (isoString: string) => {
    const elapsedSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    return elapsedSec > 900; // > 15 mins
  };

  const filterOrder = (order: KdsOrder) => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        order.table_number.toLowerCase().includes(q) ||
        (order.customer_name && order.customer_name.toLowerCase().includes(q)) ||
        order.id.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  };

  return (
    <div className="space-y-5">
      {/* KDS Header Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 mb-2">
            <i className="fa-solid fa-fire text-[11px]" />
            <span>Live Kitchen Display Rail (KDS)</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Kitchen Order Tickets</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Realtime order dispatch for chefs, line cooks and food runners.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 gap-2">
            <i className="fa-solid fa-clock text-amber-400" />
            <span className="font-mono font-semibold">
              Active Tickets: {activeOrders.length}
            </span>
          </div>

          <AdminButton
            variant="outline"
            size="sm"
            leftIcon="fa-rotate"
            onClick={onRefresh}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            Refresh
          </AdminButton>
        </div>
      </div>

      {/* Control Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">Station Filter:</span>
          <button
            type="button"
            onClick={() => setStationFilter("all")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              stationFilter === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Items
          </button>
          <button
            type="button"
            onClick={() => setStationFilter("veg")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              stationFilter === "veg"
                ? "bg-emerald-700 text-white"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Veg Only
          </button>
          <button
            type="button"
            onClick={() => setStationFilter("nonveg")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              stationFilter === "nonveg"
                ? "bg-rose-700 text-white"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Non-Veg Only
          </button>
        </div>

        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Search table or ticket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* 3-Column Ticket Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Column 1: New / Queued Orders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-bell" />
              <span>New / Queued</span>
            </span>
            <span className="bg-slate-950 text-white px-2 py-0.5 rounded-full text-[11px] font-mono">
              {pendingOrders.filter(filterOrder).length}
            </span>
          </div>

          <div className="space-y-3">
            {pendingOrders.filter(filterOrder).map((order) => {
              const late = isOrderLate(order.created_at);
              return (
                <div
                  key={order.id}
                  className={`bg-white border rounded-2xl p-4 shadow-xs space-y-3 transition-all ${
                    late ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-extrabold text-base text-slate-900 block">
                        Table {order.table_number}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs font-mono font-bold block ${
                          late ? "text-rose-600 animate-pulse" : "text-amber-600"
                        }`}
                      >
                        {getElapsedTime(order.created_at)}
                      </span>
                      {order.customer_name && (
                        <span className="text-[10px] text-slate-500 block truncate max-w-[100px]">
                          {order.customer_name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {order.order_items && order.order_items.length > 0 ? (
                      order.order_items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                it.is_veg ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            <span className="font-bold text-slate-800 truncate">
                              {it.name}
                            </span>
                          </div>
                          <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs shrink-0">
                            ×{it.qty}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-600 text-xs py-1">
                        {order.items_count} items ordered (₹{order.total_amount})
                      </div>
                    )}
                  </div>

                  {order.notes && (
                    <div className="p-2 rounded-lg bg-amber-50 text-amber-900 text-[11px] border border-amber-200/60 flex items-start gap-1.5">
                      <i className="fa-solid fa-note-sticky text-amber-600 mt-0.5 text-[10px]" />
                      <span>{order.notes}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100">
                    <AdminButton
                      variant="primary"
                      size="sm"
                      leftIcon="fa-fire"
                      className="w-full bg-amber-600 hover:bg-amber-700"
                      onClick={() => onUpdateOrderStatus(order.id, "preparing")}
                    >
                      Start Cooking
                    </AdminButton>
                  </div>
                </div>
              );
            })}

            {pendingOrders.filter(filterOrder).length === 0 && (
              <div className="p-8 text-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl">
                <i className="fa-solid fa-circle-check text-2xl text-slate-300 mb-2 block" />
                <span className="text-xs font-semibold">No pending tickets</span>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: In Preparation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-fire-burner" />
              <span>In Preparation</span>
            </span>
            <span className="bg-white text-blue-900 px-2 py-0.5 rounded-full text-[11px] font-mono">
              {preparingOrders.filter(filterOrder).length}
            </span>
          </div>

          <div className="space-y-3">
            {preparingOrders.filter(filterOrder).map((order) => {
              const late = isOrderLate(order.created_at);
              return (
                <div
                  key={order.id}
                  className={`bg-white border rounded-2xl p-4 shadow-xs space-y-3 transition-all ${
                    late ? "border-rose-400 ring-2 ring-rose-100" : "border-blue-200"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-extrabold text-base text-slate-900 block">
                        Table {order.table_number}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        #{order.id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs font-mono font-bold block ${
                          late ? "text-rose-600 animate-pulse" : "text-blue-600"
                        }`}
                      >
                        {getElapsedTime(order.created_at)}
                      </span>
                      <span className="text-[10px] text-slate-500">Cooking</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {order.order_items && order.order_items.length > 0 ? (
                      order.order_items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                it.is_veg ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            <span className="font-bold text-slate-800 truncate">
                              {it.name}
                            </span>
                          </div>
                          <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs shrink-0">
                            ×{it.qty}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-600 text-xs py-1">
                        {order.items_count} items cooking
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <AdminButton
                      variant="primary"
                      size="sm"
                      leftIcon="fa-check-double"
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => onUpdateOrderStatus(order.id, "served")}
                    >
                      Food Ready for Pickup
                    </AdminButton>
                  </div>
                </div>
              );
            })}

            {preparingOrders.filter(filterOrder).length === 0 && (
              <div className="p-8 text-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl">
                <i className="fa-solid fa-fire-burner text-2xl text-slate-300 mb-2 block" />
                <span className="text-xs font-semibold">No active cooking tickets</span>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Food Ready / Calling Runner */}
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-utensils" />
              <span>Ready for Service</span>
            </span>
            <span className="bg-white text-emerald-900 px-2 py-0.5 rounded-full text-[11px] font-mono">
              {readyOrders.filter(filterOrder).length}
            </span>
          </div>

          <div className="space-y-3">
            {readyOrders.filter(filterOrder).map((order) => (
              <div
                key={order.id}
                className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-extrabold text-base text-slate-900 block">
                      Table {order.table_number}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      #{order.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <AdminBadge variant="served" size="sm">
                      Ready
                    </AdminBadge>
                  </div>
                </div>

                <div className="text-xs text-slate-600">
                  {order.items_count} items ready on pass counter
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <AdminButton
                    variant="outline"
                    size="sm"
                    leftIcon="fa-circle-check"
                    className="w-full text-slate-700 border-slate-300 hover:bg-slate-50"
                    onClick={() => onUpdateOrderStatus(order.id, "completed")}
                  >
                    Served to Table
                  </AdminButton>
                </div>
              </div>
            ))}

            {readyOrders.filter(filterOrder).length === 0 && (
              <div className="p-8 text-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl">
                <i className="fa-solid fa-bell-concierge text-2xl text-slate-300 mb-2 block" />
                <span className="text-xs font-semibold">Pass counter is clear</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
