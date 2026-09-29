"use client";

import React from "react";
import AdminButton from "../ui/AdminButton";
import AdminBadge from "../ui/AdminBadge";

export interface ApprovalOrder {
  id: string;
  table_number: string;
  customer_name?: string;
  total_amount: number;
  created_at: string;
  notes?: string;
  items_count?: number;
  item_count?: number;
  order_items?: Array<{
    id: string;
    name: string;
    qty: number;
    is_veg: boolean;
    portion?: "half" | "full";
    unit_price?: number;
  }>;
}

interface ApprovalsViewProps {
  pendingOrders: ApprovalOrder[];
  onApproveOrder: (orderId: string) => void;
  onRejectOrder: (orderId: string) => void;
}

export default function ApprovalsView({
  pendingOrders,
  onApproveOrder,
  onRejectOrder,
}: ApprovalsViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 mb-2">
            <i className="fa-solid fa-stamp text-[11px]" />
            <span>Floor Captain Verification Gate</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Captain Order Approvals
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review guest digital QR orders, confirm availability, and route verified tickets to Kitchen KDS and Thermal Printer.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            Pending Queue: <strong className="text-amber-600 font-mono text-sm">{pendingOrders.length}</strong>
          </span>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {pendingOrders.map((ord) => (
          <div
            key={ord.id}
            className="bg-white border border-amber-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <div>
                  <span className="text-base font-extrabold text-slate-900 block">
                    Table {ord.table_number}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    #{ord.id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-slate-900 text-base block">
                    ₹{ord.total_amount}
                  </span>
                  <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Awaiting Approval
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto">
                {ord.order_items && ord.order_items.length > 0 ? (
                  ord.order_items.map((it) => (
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
                        {it.portion && (
                          <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded font-semibold capitalize">
                            {it.portion}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        ×{it.qty}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 py-1">
                    {ord.item_count ?? ord.items_count ?? 1} items placed by guest
                  </div>
                )}
              </div>

              {ord.notes && (
                <div className="mt-3 p-2 rounded-lg bg-amber-50 text-amber-900 text-[11px] border border-amber-200/60 flex items-start gap-1.5">
                  <i className="fa-solid fa-message text-amber-600 mt-0.5 text-[10px]" />
                  <span>{ord.notes}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
              <AdminButton
                variant="primary"
                size="sm"
                leftIcon="fa-check"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onApproveOrder(ord.id)}
              >
                Approve &amp; Send to KDS
              </AdminButton>
              <AdminButton
                variant="outline"
                size="sm"
                leftIcon="fa-xmark"
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={() => onRejectOrder(ord.id)}
              >
                Reject
              </AdminButton>
            </div>
          </div>
        ))}

        {pendingOrders.length === 0 && (
          <div className="col-span-full py-16 bg-white border border-dashed border-slate-200 rounded-2xl text-center text-slate-400">
            <i className="fa-solid fa-circle-check text-4xl text-emerald-400 mb-3 block" />
            <h3 className="text-sm font-bold text-slate-700 mb-1">
              All Orders Approved
            </h3>
            <p className="text-xs text-slate-400">
              There are no pending table orders awaiting captain review at this moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
