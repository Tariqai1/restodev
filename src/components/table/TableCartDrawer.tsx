import React from "react";
import { MenuItem, RestaurantFeatures, CartItem, ScoredUpsell } from "./TableTypes";
import { RestaurantOfferConfig, SmartUpsellConfig } from "@/lib/types/offers";
import { getFoodEmoji } from "./tableUtils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string;
  restaurantName: string;
  cartEntries: [string, CartItem][];
  items: MenuItem[];
  features: RestaurantFeatures;
  upsellConfig: SmartUpsellConfig;
  offerConfig: RestaurantOfferConfig;
  upsellCandidates: ScoredUpsell[];
  subtotalCart: number;
  discountAmount: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  isSubmitting: boolean;
  onAddToCart: (id: string, e?: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => void;
  onRemoveFromCart: (id: string) => void;
  onSetItemNotes?: (id: string, notes: string) => void;
  onPlaceOrder: () => void;
};

export default function TableCartDrawer({
  isOpen,
  onClose,
  tableNumber,
  restaurantName,
  cartEntries,
  items,
  features,
  upsellConfig,
  offerConfig,
  upsellCandidates,
  subtotalCart,
  discountAmount,
  cgst,
  sgst,
  grandTotal,
  isSubmitting,
  onAddToCart,
  onRemoveFromCart,
  onSetItemNotes,
  onPlaceOrder,
}: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center backdrop-blur-sm"
      style={{ backgroundColor: "rgba(34, 29, 22, 0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] p-6 rounded-t-3xl flex flex-col justify-between overflow-y-auto shadow-2xl border-t-2 animate-slide-up"
        style={{
          backgroundColor: "var(--paper)",
          borderColor: "var(--hairline)",
          color: "var(--ink)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-4" />

          <div
            className="flex justify-between items-start pb-3 border-b border-dashed"
            style={{ borderColor: "var(--hairline)" }}
          >
            <div>
              <h3 className="font-heading text-2xl font-extrabold" style={{ color: "var(--ink)" }}>
                Cart Review
              </h3>
              <span className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
                Table {tableNumber} · {restaurantName}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold p-1 cursor-pointer hover:bg-black/5"
              style={{ color: "var(--ink-soft)" }}
            >
              ✕
            </button>
          </div>

          {/* Cart Items List */}
          <div className="space-y-3 my-4">
            {cartEntries.map(([key, val]) => {
              const [id, portion] = key.split("__");
              const item = items.find((i) => i.id === id);
              if (!item) return null;
              const isHalf = portion === "half";
              const unitPrice = isHalf ? Math.round(Number(item.price) * 0.6) : Number(item.price);

              return (
                <div
                  key={key}
                  className="p-3 rounded-xl border bg-white shadow-xs space-y-1.5"
                  style={{ borderColor: "var(--hairline)" }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={item.is_veg ? "veg-indicator" : "nonveg-indicator"} />
                        <span className="font-bold text-xs" style={{ color: "var(--ink)" }}>
                          {item.name}
                        </span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                            isHalf
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : "bg-stone-100 text-stone-700 border-stone-300"
                          }`}
                        >
                          {isHalf ? "Half" : "Full"}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-stone-400 mt-0.5">
                        ₹{unitPrice} each
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-receipt text-xs font-extrabold" style={{ color: "var(--ink)" }}>
                        ₹{unitPrice * val.qty}
                      </span>

                      <div
                        className="flex items-center bg-stone-100 rounded-lg border"
                        style={{ borderColor: "var(--hairline)" }}
                      >
                        <button
                          type="button"
                          onClick={() => onRemoveFromCart(key)}
                          className="w-6 h-6 flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-white"
                        >
                          -
                        </button>
                        <span className="font-receipt text-xs font-bold px-1.5">{val.qty}</span>
                        <button
                          type="button"
                          onClick={() => onAddToCart(key)}
                          className="w-6 h-6 flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-white"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Spend Goal Proximity Progress Nudge */}
          {upsellConfig.showSpendGoalNudge && offerConfig.active && (
            <div className="my-3 p-3 rounded-2xl border bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border-amber-500/30">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold flex items-center gap-1.5 text-amber-900">
                  <span>🎯</span>
                  {subtotalCart >= offerConfig.minOrderValue ? (
                    <span className="text-emerald-700 font-extrabold">
                      🎉 FLAT {offerConfig.discountPercent}% OFF Unlocked!
                    </span>
                  ) : (
                    <span>
                      Add{" "}
                      <strong className="text-amber-950 font-receipt">
                        ₹{Math.max(0, offerConfig.minOrderValue - subtotalCart)}
                      </strong>{" "}
                      to unlock <strong>{offerConfig.discountPercent}% OFF</strong>
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-mono font-bold text-amber-800">
                  ₹{subtotalCart}/₹{offerConfig.minOrderValue}
                </span>
              </div>
              <div className="w-full h-2 bg-stone-200/80 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    subtotalCart >= offerConfig.minOrderValue
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                      : "bg-gradient-to-r from-amber-500 to-orange-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((subtotalCart / (offerConfig.minOrderValue || 1)) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Smart Upsell & Basket Pairing Recommendations */}
          {features.smartUpsell && upsellConfig.enabled && upsellCandidates.length > 0 && (
            <div
              className="my-3 p-3 rounded-2xl border bg-stone-50/90 shadow-xs"
              style={{ borderColor: "var(--hairline)" }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">💡</span>
                  <div>
                    <div className="text-xs font-bold" style={{ color: "var(--ink)" }}>
                      {upsellConfig.headline || "Frequently Ordered Together"}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--ink-soft)" }}>
                      Intelligent pairings based on your selections
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                  Smart AI
                </span>
              </div>

              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x">
                {upsellCandidates.map((upsell) => (
                  <div
                    key={upsell.id}
                    className="p-2.5 rounded-xl bg-white border flex flex-col justify-between shadow-xs shrink-0 w-36 snap-start transition-all hover:border-amber-400"
                    style={{ borderColor: "var(--hairline)" }}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={upsell.is_veg ? "veg-indicator" : "nonveg-indicator"} />
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-700 truncate max-w-[95px] flex items-center gap-0.5">
                          <span>{upsell.reasonIcon}</span>
                          <span className="truncate">{upsell.reasonTag}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {upsell.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={upsell.photo_url}
                            alt={upsell.name}
                            className="w-8 h-8 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <span className="text-xl shrink-0">
                            {getFoodEmoji(upsell.name, upsell.is_veg)}
                          </span>
                        )}
                        <div className="text-[11px] font-bold leading-tight line-clamp-2 text-stone-900">
                          {upsell.name}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 mt-1.5 border-t border-dashed border-stone-200 flex items-center justify-between">
                      <span className="font-receipt font-extrabold text-xs text-stone-900">
                        ₹{upsell.price}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => onAddToCart(upsell.id, e)}
                        className="px-2 py-1 rounded-lg flex items-center gap-1 font-bold text-[10px] cursor-pointer shadow-xs active:scale-95 transition-all"
                        style={{ backgroundColor: "var(--rust)", color: "var(--rust-text)" }}
                      >
                        <span>+</span>
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Indian Tax Breakdown & Offer Discount */}
          <div
            className="pt-3.5 border-t border-dashed space-y-1.5 font-receipt text-xs"
            style={{ borderColor: "var(--hairline)" }}
          >
            <div className="flex justify-between" style={{ color: "var(--ink-soft)" }}>
              <span>Items Subtotal</span>
              <span>₹{subtotalCart.toLocaleString("en-IN")}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between items-center py-1.5 px-2.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                <span className="flex items-center gap-1.5">
                  <span>🎁</span>
                  <span>Table Offer ({offerConfig.discountPercent}% OFF)</span>
                </span>
                <span className="font-extrabold">-₹{discountAmount.toLocaleString("en-IN")}</span>
              </div>
            )}

            <div className="flex justify-between" style={{ color: "var(--ink-soft)" }}>
              <span>CGST (2.5%)</span>
              <span>₹{cgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between" style={{ color: "var(--ink-soft)" }}>
              <span>SGST (2.5%)</span>
              <span>₹{sgst.toFixed(2)}</span>
            </div>
            <div className="pt-2.5 flex justify-between items-baseline border-t border-stone-300">
              <div>
                <span
                  className="font-heading text-sm font-extrabold block"
                  style={{ color: "var(--ink)" }}
                >
                  Total Payable
                </span>
                {discountAmount > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 block">
                    🎉 Total savings: ₹{discountAmount}
                  </span>
                )}
              </div>
              <span className="font-heading text-2xl font-extrabold" style={{ color: "var(--rust)" }}>
                ₹{grandTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <p className="text-[11px] mt-3 font-medium text-center" style={{ color: "var(--ink-soft)" }}>
            ℹ Orders are dispatched straight to the kitchen display terminal.
          </p>
        </div>

        {/* Place Order CTA Button */}
        <div className="pt-4 border-t border-dashed" style={{ borderColor: "var(--hairline)" }}>
          <button
            type="button"
            onClick={onPlaceOrder}
            disabled={isSubmitting || cartEntries.length === 0}
            className="w-full h-14 rounded-2xl text-sm font-extrabold shadow-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              backgroundColor: "var(--rust)",
              color: "var(--rust-text)",
            }}
          >
            <span>{isSubmitting ? "Dispatching to Kitchen..." : "Confirm & Send to Kitchen"}</span>
            <span>👨‍🍳</span>
          </button>
        </div>
      </div>
    </div>
  );
}
