"use client";

import React from "react";
import { MenuItem, CartMap } from "./TableTypes";
import { triggerHaptic } from "./tableUtils";

interface TableStarHighlightsProps {
  topBestsellers: MenuItem[];
  cart: CartMap;
  tableNumber: string;
  onPreviewDish: (dish: MenuItem) => void;
  onAddToCart: (dishId: string, e?: React.MouseEvent<any> | React.TouchEvent<any>) => void;
  onRemoveFromCart: (dishId: string) => void;
}

export default function TableStarHighlights({
  topBestsellers,
  cart,
  tableNumber,
  onPreviewDish,
  onAddToCart,
  onRemoveFromCart,
}: TableStarHighlightsProps) {
  if (!topBestsellers || topBestsellers.length === 0) return null;

  return (
    <div className="mt-4 pt-1 border-t border-stone-200/60">
      <div className="px-4 flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base animate-bounce">⭐</span>
          <h2 className="text-xs font-black uppercase tracking-wider text-stone-900">
            Top Star Highlights
          </h2>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
            Most Loved
          </span>
        </div>
        <span className="text-[10px] font-bold text-stone-600">
          Table {tableNumber} Favorites
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none px-4 pb-2">
        {topBestsellers.map((starDish) => {
          const inCartCount = cart[starDish.id]?.qty || 0;
          return (
            <div
              key={`star-${starDish.id}`}
              className="w-40 shrink-0 snap-start rounded-2xl border border-stone-200/90 bg-white p-2.5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between select-none relative"
            >
              <div
                onClick={() => {
                  triggerHaptic(6);
                  onPreviewDish(starDish);
                }}
                className="cursor-pointer group"
              >
                <div className="w-full h-24 rounded-xl overflow-hidden relative bg-stone-100 mb-2">
                  {starDish.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={starDish.photo_url}
                      alt={starDish.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 text-2xl">
                      <span>{starDish.is_veg ? "🥗" : "🍗"}</span>
                    </div>
                  )}
                  <div className="absolute top-1 left-1">
                    <span
                      className={
                        starDish.is_veg
                          ? "veg-indicator"
                          : "nonveg-indicator"
                      }
                    />
                  </div>
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[9px] font-black text-amber-300 flex items-center gap-0.5">
                    <span>★</span>
                    <span>4.8</span>
                  </div>
                </div>

                <h3 className="text-xs font-bold text-stone-900 leading-snug line-clamp-1">
                  {starDish.name}
                </h3>
                <p className="text-[11px] font-black text-stone-900 mt-0.5">
                  ₹{starDish.price}
                </p>
              </div>

              <div className="mt-2 pt-1.5 border-t border-stone-100 flex items-center justify-between">
                {inCartCount === 0 ? (
                  <button
                    type="button"
                    onClick={(e) => onAddToCart(starDish.id, e)}
                    className="w-full py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                    style={{
                      backgroundColor: "var(--rust)",
                      color: "var(--rust-text)",
                    }}
                  >
                    <span>ADD</span>
                    <span>+</span>
                  </button>
                ) : (
                  <div
                    className="w-full h-7 flex items-center justify-between rounded-lg border shadow-xs overflow-hidden bg-white animate-spring-bounce"
                    style={{ borderColor: "var(--rust)" }}
                  >
                    <button
                      type="button"
                      onClick={() => onRemoveFromCart(starDish.id)}
                      className="w-6 h-full flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-stone-100 transition-colors"
                      style={{ color: "var(--rust)" }}
                    >
                      -
                    </button>
                    <span
                      className="font-receipt text-xs font-black px-1 min-w-[16px] text-center"
                      style={{ color: "var(--ink)" }}
                    >
                      {inCartCount}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => onAddToCart(starDish.id, e)}
                      className="w-6 h-full flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-stone-100 transition-colors"
                      style={{ color: "var(--rust)" }}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
