"use client";

import React, { useState, useEffect, useMemo } from "react";
import AdminModal from "../ui/AdminModal";
import AdminButton from "../ui/AdminButton";
import AdminBadge from "../ui/AdminBadge";

export interface MenuItemRef {
  id: string;
  name: string;
  category: string;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  has_half_portion?: boolean;
  half_price?: number;
}

export interface RunningOrderItem {
  id: string;
  menu_item_id: string;
  qty: number;
  unit_price: number;
  notes?: string | null;
  item_status: string;
  menu_items?: {
    id: string;
    name: string;
    is_veg: boolean;
    price: number;
  } | null;
}

interface EditRunningOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  tableNumber: string;
  menuItems: MenuItemRef[];
  onOrderUpdated: () => void;
  onTriggerUndoToast: (item: {
    id: string;
    orderId: string;
    menuItemId: string;
    dishName: string;
    qty: number;
    unitPrice: number;
    notes?: string | null;
  }) => void;
}

const COMMON_REASONS = [
  "Guest changed mind",
  "Mistake punch",
  "Kitchen delay",
  "Item unavailable",
];

export default function EditRunningOrderModal({
  isOpen,
  onClose,
  orderId,
  tableNumber,
  menuItems,
  onOrderUpdated,
  onTriggerUndoToast,
}: EditRunningOrderModalProps) {
  const [items, setItems] = useState<RunningOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingRemoveItem, setPendingRemoveItem] = useState<RunningOrderItem | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Staged new items to add to order
  const [stagedAdds, setStagedAdds] = useState<
    Array<{
      menuItemId: string;
      name: string;
      qty: number;
      portion: "full" | "half";
      unitPrice: number;
      notes: string;
      is_veg: boolean;
    }>
  >([]);

  // Fetch running order details
  useEffect(() => {
    if (!isOpen || !orderId) return;

    let isMounted = true;
    setIsLoading(true);
    setErrorMsg("");
    setStagedAdds([]);
    setPendingRemoveItem(null);
    setSearchQuery("");

    fetch(`/api/orders/manage?orderId=${encodeURIComponent(orderId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        if (data.order && Array.isArray(data.order.order_items)) {
          setItems(data.order.order_items);
        }
      })
      .catch(() => {
        if (isMounted) setErrorMsg("Could not load running order.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, orderId]);

  // Frequently / recently added items (first 5 available items, prioritized by breads/beverages)
  const quickItems = useMemo(() => {
    const priorityKeywords = ["roti", "naan", "water", "coke", "papad", "rice", "dal", "soda"];
    const prioritized = menuItems.filter(
      (m) =>
        m.is_available &&
        priorityKeywords.some((kw) => m.name.toLowerCase().includes(kw))
    );
    const others = menuItems.filter((m) => m.is_available && !prioritized.includes(m));
    return [...prioritized, ...others].slice(0, 6);
  }, [menuItems]);

  // Search filtered catalog
  const filteredDishes = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return menuItems
      .filter((m) => m.is_available && (m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [searchQuery, menuItems]);

  // Stage an item to be added
  const handleStageDish = (dish: MenuItemRef, portion: "full" | "half" = "full") => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
    const unitPrice =
      portion === "half" && dish.half_price
        ? dish.half_price
        : portion === "half"
        ? Math.round(dish.price * 0.6)
        : dish.price;

    setStagedAdds((prev) => {
      const existingIdx = prev.findIndex(
        (p) => p.menuItemId === dish.id && p.portion === portion
      );
      if (existingIdx >= 0) {
        return prev.map((p, idx) =>
          idx === existingIdx ? { ...p, qty: p.qty + 1 } : p
        );
      }
      return [
        ...prev,
        {
          menuItemId: dish.id,
          name: dish.name,
          qty: 1,
          portion,
          unitPrice,
          notes: "",
          is_veg: dish.is_veg,
        },
      ];
    });
  };

  const handleUpdateStagedQty = (idx: number, delta: number) => {
    setStagedAdds((prev) => {
      const target = prev[idx];
      if (!target) return prev;
      const nextQty = target.qty + delta;
      if (nextQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      return prev.map((p, i) => (i === idx ? { ...p, qty: nextQty } : p));
    });
  };

  // Submit all staged additions to backend and fire to KDS
  const handleFireStagedItems = async () => {
    if (stagedAdds.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      if (typeof window !== "undefined" && navigator.vibrate) {
        navigator.vibrate(15);
      }

      const res = await fetch("/api/orders/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_items",
          orderId,
          items: stagedAdds.map((s) => ({
            menuItemId: s.menuItemId,
            qty: s.qty,
            portion: s.portion,
            notes: s.notes || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to add items to running order");
      }

      setStagedAdds([]);
      // Reload order items
      const refRes = await fetch(`/api/orders/manage?orderId=${encodeURIComponent(orderId)}`);
      if (refRes.ok) {
        const refData = await refRes.json();
        if (refData.order?.order_items) {
          setItems(refData.order.order_items);
        }
      }
      onOrderUpdated();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error saving items");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update existing running item quantity
  const handleUpdateItemQty = async (itemId: string, newQty: number) => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(8);
    }
    // Optimistic update
    setItems((prev) =>
      prev
        .map((it) => (it.id === itemId ? { ...it, qty: newQty } : it))
        .filter((it) => it.qty > 0)
    );

    try {
      await fetch("/api/orders/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_qty",
          orderId,
          itemId,
          qty: newQty,
        }),
      });
      onOrderUpdated();
    } catch {
      // rollback if failed
    }
  };

  // Perform item removal (with optional reason & 5s Undo)
  const handleExecuteRemoval = async (item: RunningOrderItem, reason?: string) => {
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate(12);
    }

    // Immediately remove from UI
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    setPendingRemoveItem(null);

    // Trigger the 5s Undo Toast in parent
    onTriggerUndoToast({
      id: item.id,
      orderId,
      menuItemId: item.menu_item_id,
      dishName: item.menu_items?.name || "Dish",
      qty: item.qty,
      unitPrice: item.unit_price,
      notes: item.notes,
    });

    try {
      await fetch("/api/orders/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_item",
          orderId,
          itemId: item.id,
          reason: reason || undefined,
        }),
      });
      onOrderUpdated();
    } catch {
      // handled
    }
  };

  const totalRunningAmount = items.reduce(
    (sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.qty) || 0),
    0
  );
  const totalStagedAmount = stagedAdds.reduce(
    (sum, it) => sum + (Number(it.unitPrice) || 0) * (Number(it.qty) || 0),
    0
  );

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Running Order — Table ${tableNumber}`}
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Error notification banner if any */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg("")}
              className="text-rose-500 hover:text-rose-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* SECTION 1: SEARCH & QUICK-ADD SECTION */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <i className="fa-solid fa-plus-circle text-purple-600" />
              <span>Punch New Items</span>
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Fires directly to Kitchen KDS
            </span>
          </div>

          {/* Autocomplete Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <i className="fa-solid fa-search text-xs" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dish name (e.g. Butter Naan, Biryani, Roti)..."
              className="w-full pl-8 pr-8 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-hidden focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-slate-800 placeholder-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Autocomplete Results Dropdown */}
          {filteredDishes.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 shadow-md max-h-48 overflow-y-auto">
              {filteredDishes.map((dish) => (
                <div
                  key={dish.id}
                  className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-xs border shrink-0 flex items-center justify-center ${
                        dish.is_veg ? "border-emerald-600" : "border-rose-600"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          dish.is_veg ? "bg-emerald-600" : "bg-rose-600"
                        }`}
                      />
                    </span>
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {dish.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      ₹{dish.price}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {dish.has_half_portion && (
                      <button
                        type="button"
                        onClick={() => handleStageDish(dish, "half")}
                        className="px-2 py-1 text-[10px] font-bold rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors cursor-pointer"
                      >
                        + Half (₹{dish.half_price || Math.round(dish.price * 0.6)})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStageDish(dish, "full")}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Top 5 Frequently Punched Items Strip */}
          {!searchQuery && quickItems.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                ⚡ Quick 1-Tap Adds:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quickItems.map((dish) => (
                  <button
                    key={dish.id}
                    type="button"
                    onClick={() => handleStageDish(dish, "full")}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/50 text-[11px] font-medium text-slate-700 transition-all active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        dish.is_veg ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    <span>{dish.name}</span>
                    <span className="font-bold text-slate-900">₹{dish.price}</span>
                    <i className="fa-solid fa-plus text-[9px] text-purple-600 ml-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Staged Items To Be Dispatched */}
          {stagedAdds.length > 0 && (
            <div className="pt-2 border-t border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                <span>Staged to Add ({stagedAdds.length}):</span>
                <span>₹{totalStagedAmount}</span>
              </div>

              <div className="space-y-1.5">
                {stagedAdds.map((staged, idx) => (
                  <div
                    key={`${staged.menuItemId}_${staged.portion}_${idx}`}
                    className="flex items-center justify-between bg-white border border-purple-200 rounded-xl px-3 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-slate-800 truncate">
                        {staged.name}{" "}
                        {staged.portion === "half" ? (
                          <span className="text-[10px] text-purple-600 font-bold">(Half)</span>
                        ) : null}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        ₹{staged.unitPrice * staged.qty}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateStagedQty(idx, -1)}
                        className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-bold font-mono text-xs text-slate-800">
                        {staged.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateStagedQty(idx, 1)}
                        className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <AdminButton
                variant="primary"
                size="sm"
                leftIcon="fa-fire"
                isLoading={isSubmitting}
                onClick={handleFireStagedItems}
                className="w-full justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                Fire {stagedAdds.length} New Item(s) to Kitchen (₹{totalStagedAmount})
              </AdminButton>
            </div>
          )}
        </div>

        {/* SECTION 2: RUNNING ORDER ITEMS LIST */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Active Table Items ({items.length})
            </h4>
            <span className="text-xs font-bold text-slate-900 font-mono">
              Running Subtotal: ₹{totalRunningAmount}
            </span>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <i className="fa-solid fa-spinner fa-spin text-base mr-2 text-purple-600" />
              Loading current order dishes...
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-2xl">
              No items currently active in this table order.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white">
              {items.map((it) => {
                const dishName = it.menu_items?.name || "Dish";
                const isVeg = it.menu_items?.is_veg ?? true;
                const isPreparing = it.item_status === "preparing";
                const isServed = it.item_status === "served";

                return (
                  <div key={it.id} className="p-3 flex items-center justify-between gap-3">
                    {/* Item info */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-xs border shrink-0 flex items-center justify-center ${
                          isVeg ? "border-emerald-600" : "border-rose-600"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isVeg ? "bg-emerald-600" : "bg-rose-600"
                          }`}
                        />
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {dishName}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                              isServed
                                ? "bg-emerald-100 text-emerald-700"
                                : isPreparing
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {it.item_status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          ₹{it.unit_price} × {it.qty} = ₹{Number(it.unit_price) * Number(it.qty)}
                          {it.notes ? (
                            <span className="text-amber-700 ml-2 font-sans font-medium">
                              📝 {it.notes}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Qty and Remove Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Qty +/- Stepper */}
                      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (it.qty <= 1) {
                              setPendingRemoveItem(it);
                            } else {
                              handleUpdateItemQty(it.id, it.qty - 1);
                            }
                          }}
                          className="w-6 h-6 rounded-md hover:bg-white text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
                          title="Decrease Quantity"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-bold font-mono text-xs text-slate-900">
                          {it.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(it.id, it.qty + 1)}
                          className="w-6 h-6 rounded-md hover:bg-white text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
                          title="Increase Quantity"
                        >
                          +
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => setPendingRemoveItem(it)}
                        className="w-7 h-7 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <i className="fa-solid fa-trash-can text-xs" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* OPTIONAL REMOVAL REASON MODAL / OVERLAY */}
        {pendingRemoveItem && (
          <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/90 p-3.5 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <i className="fa-solid fa-triangle-exclamation text-rose-600" />
                <span>Remove &ldquo;{pendingRemoveItem.menu_items?.name || "Dish"}&rdquo;?</span>
              </span>
              <button
                type="button"
                onClick={() => setPendingRemoveItem(null)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                Cancel
              </button>
            </div>

            <p className="text-[11px] text-rose-700 leading-snug">
              Select an optional reason for restaurant audit logs, or skip directly:
            </p>

            <div className="flex flex-wrap gap-1.5">
              {COMMON_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleExecuteRemoval(pendingRemoveItem, r)}
                  className="px-2.5 py-1 rounded-lg border border-rose-200 bg-white hover:bg-rose-100 text-[11px] font-medium text-rose-800 transition-colors cursor-pointer"
                >
                  {r}
                </button>
              ))}

              <button
                type="button"
                onClick={() => handleExecuteRemoval(pendingRemoveItem)}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-[11px] font-bold text-white transition-colors cursor-pointer"
              >
                Skip & Remove
              </button>
            </div>
          </div>
        )}

        {/* MODAL FOOTER */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Table total: <strong className="text-slate-900 font-mono">₹{totalRunningAmount}</strong>
          </div>

          <AdminButton variant="outline" size="sm" onClick={onClose}>
            Done
          </AdminButton>
        </div>
      </div>
    </AdminModal>
  );
}
