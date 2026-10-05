"use client";

import React, { useEffect, useState } from "react";
import { triggerHaptic } from "./tableUtils";

interface TableOrderHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  tableNumber: string;
  restaurantName: string;
}

interface MenuItem {
  name: string;
  is_veg: boolean;
}

interface OrderItem {
  id: string;
  menu_item_id: string;
  qty: number;
  unit_price: number;
  notes: string | null;
  item_status: string;
  created_at: string;
  menu_items: MenuItem;
}

interface Bill {
  id: string;
  subtotal: number;
  tax_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total: number;
  payment_mode: string;
  payment_status: string;
  paid_at: string | null;
  bill_number: string;
}

interface Order {
  id: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  order_items: OrderItem[];
  bill: Bill | null;
}

function formatOrderDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${time}`;
}

export default function TableOrderHistory({
  isOpen,
  onClose,
  token,
  tableNumber,
  restaurantName,
}: TableOrderHistoryProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/public/table/history?token=${token}`);
      const data = await res.json();
      if (data.ok) {
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to fetch order history", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen, token]);

  const handleClose = () => {
    triggerHaptic();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        onClick={handleClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 w-full rounded-t-2xl shadow-md transition-transform duration-300 transform translate-y-0 flex flex-col"
        style={{
          backgroundColor: "var(--paper)",
          color: "var(--ink)",
          maxHeight: "85vh",
        }}
      >
        <div className="sticky top-0 bg-inherit z-10 rounded-t-2xl px-4 py-3 border-b border-stone-200">
          <div className="w-12 h-1.5 rounded-full mx-auto mb-3" style={{ backgroundColor: "var(--paper-dim)" }} />
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-heading font-bold text-lg leading-none">Order History</h2>
              <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
                Table {tableNumber} • {restaurantName}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 active:scale-95 transition-transform"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse bg-stone-100 rounded-xl h-40 w-full border border-stone-200" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <i className="fa-solid fa-plate-wheat text-4xl mb-4" style={{ color: "var(--ink-soft)" }} />
              <p className="font-bold" style={{ color: "var(--ink)" }}>No orders yet</p>
              <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>Your past orders will appear here</p>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="rounded-xl border border-stone-200 bg-white p-3 shadow-xs">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: order.status === "open" ? "var(--sage)" : order.status === "cancelled" ? "var(--rust)" : "var(--brand-primary)",
                        color: "white"
                      }}
                    >
                      {order.status}
                    </span>
                    <span className="text-xs font-mono" style={{ color: "var(--ink-soft)" }}>
                      {formatOrderDate(order.opened_at)}
                    </span>
                  </div>
                  {order.bill && (
                    <span className="text-[11px] font-mono font-medium">
                      Bill #{order.bill.bill_number}
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-3">
                  {order.order_items.map((item) => {
                    const isCancelled = item.item_status === "cancelled";
                    return (
                      <div key={item.id} className="flex justify-between items-start text-sm">
                        <div className="flex items-start gap-2 max-w-[70%]">
                          <div className={`mt-1 flex-shrink-0 w-3 h-3 rounded-sm border ${item.menu_items.is_veg ? 'border-green-600' : 'border-red-600'} flex items-center justify-center`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${item.menu_items.is_veg ? 'bg-green-600' : 'bg-red-600'}`} />
                          </div>
                          <div>
                            <p className={`font-medium ${isCancelled ? 'line-through opacity-60' : ''}`}>
                              {item.qty}x {item.menu_items.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 font-medium capitalize" style={{ color: "var(--ink-soft)" }}>
                                {item.item_status}
                              </span>
                              {item.notes && (
                                <span className="text-[10px] italic truncate max-w-[120px]" style={{ color: "var(--ink-soft)" }}>
                                  Note: {item.notes}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={`font-mono text-xs ${isCancelled ? 'line-through opacity-60' : ''}`}>
                          ₹{item.qty * item.unit_price}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-stone-100 bg-stone-50 -mx-3 -mb-3 p-3 rounded-b-xl flex flex-col gap-1">
                  {order.bill ? (
                    <>
                      <div className="flex justify-between text-xs" style={{ color: "var(--ink-soft)" }}>
                        <span>Subtotal</span>
                        <span>₹{order.bill.subtotal}</span>
                      </div>
                      <div className="flex justify-between text-xs" style={{ color: "var(--ink-soft)" }}>
                        <span>Tax</span>
                        <span>₹{order.bill.tax_amount}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1 pt-1 border-t border-stone-200">
                        <div className="flex items-center gap-1 text-[11px] font-medium">
                          {order.bill.payment_status === 'paid' ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <i className="fa-solid fa-circle-check" /> Paid ({order.bill.payment_mode})
                            </span>
                          ) : (
                            <span style={{ color: "var(--rust-text)" }}>
                              <i className="fa-solid fa-clock" /> Unpaid
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-sm">₹{order.bill.total}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium" style={{ color: "var(--rust-text)" }}>
                        <i className="fa-solid fa-file-invoice" /> Billing Pending
                      </span>
                      <span className="font-bold text-sm">
                        ₹{order.order_items.filter(i => i.item_status !== 'cancelled').reduce((sum, item) => sum + (item.qty * item.unit_price), 0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
