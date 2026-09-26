"use client";

import React, { useState } from "react";
import { MenuItem, PortionType } from "./TableTypes";
import { getFoodEmoji, getSpiciness } from "./tableUtils";

export function isPortionEligible(item: MenuItem): boolean {
  if (item.has_half_portion !== undefined) {
    return Boolean(item.has_half_portion);
  }
  if (Number(item.price) < 60) return false;
  const n = item.name.toLowerCase();
  if (
    n.includes("water") ||
    n.includes("coke") ||
    n.includes("pepsi") ||
    n.includes("soda") ||
    n.includes("beverage") ||
    n.includes("sprite") ||
    n.includes("thums up") ||
    n.includes("papad") ||
    n === "roti" ||
    n === "tandoori roti" ||
    n === "butter roti" ||
    n === "plain roti" ||
    n === "garlic naan" ||
    n === "butter naan" ||
    n === "plain naan"
  ) {
    return false;
  }
  return true;
}

interface TableDishCardProps {
  item: MenuItem;
  halfQty: number;
  fullQty: number;
  showPortions?: boolean;
  onPreviewDish: (dish: MenuItem) => void;
  onAddToCart: (dishId: string, portion: PortionType, e?: React.MouseEvent<any> | React.TouchEvent<any>) => void;
  onRemoveFromCart: (dishId: string, portion: PortionType) => void;
}

export default function TableDishCard({
  item,
  halfQty,
  fullQty,
  showPortions = true,
  onPreviewDish,
  onAddToCart,
  onRemoveFromCart,
}: TableDishCardProps) {
  const foodEmoji = getFoodEmoji(item.name, item.is_veg);
  const spiciness = getSpiciness(item.name, item.description);
  const hasPortions = showPortions && isPortionEligible(item);

  const [activePortion, setActivePortion] = useState<PortionType>("full");

  const fullPrice = Number(item.price);
  const halfPrice = Math.round(fullPrice * 0.6);
  const currentPrice = hasPortions && activePortion === "half" ? halfPrice : fullPrice;
  const currentPortionQty = hasPortions && activePortion === "half" ? halfQty : fullQty;
  const totalItemCartCount = halfQty + fullQty;

  return (
    <div
      className="p-2 sm:p-2.5 rounded-xl border bg-white/95 transition-all hover:shadow-md flex flex-col gap-1.5"
      style={{
        borderColor: totalItemCartCount > 0 ? "var(--rust)" : "var(--hairline)",
        boxShadow:
          totalItemCartCount > 0
            ? "0 4px 14px -2px rgba(255, 190, 11, 0.16)"
            : "var(--shadow-sm)",
      }}
    >
      <div className="flex justify-between gap-2.5 items-center">
        {/* Left Info: Name, Badges, Micro Portion Selector, Price */}
        <div className="flex-1 min-w-0 pr-1 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={item.is_veg ? "veg-indicator" : "nonveg-indicator"} />

            {/* Spiciness Indicator Badge */}
            {spiciness === "spicy" ? (
              <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-0.5">
                <i className="fa-solid fa-fire-flame-curved text-[7.5px]" />
                <span>Spicy</span>
              </span>
            ) : spiciness === "mild" ? (
              <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                <span>Mild</span>
              </span>
            ) : (
              <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-0.5">
                <i className="fa-solid fa-pepper-hot text-[7.5px]" />
                <span>Medium</span>
              </span>
            )}

            {/* Bestseller Badge */}
            {item.is_bestseller && (
              <span className="text-[8.5px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider inline-flex items-center gap-0.5">
                <i className="fa-solid fa-star text-[7.5px] text-amber-600" />
                <span>Bestseller</span>
              </span>
            )}

            <span
              onClick={() => onPreviewDish(item)}
              className="font-bold text-[13px] leading-tight text-stone-900 cursor-pointer hover:underline block w-full"
            >
              {item.name}
            </span>
          </div>

          {/* Micro Half / Full Segmented Pill */}
          {hasPortions && (
            <div className="inline-flex items-center p-0.5 rounded-md bg-stone-100 border border-stone-200 mt-0.5">
              <button
                type="button"
                onClick={() => setActivePortion("half")}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activePortion === "half"
                    ? "bg-stone-900 text-white shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <span>Half ₹{halfPrice}</span>
                {halfQty > 0 && (
                  <span className="px-1 rounded bg-amber-400 text-stone-950 font-mono text-[8px] font-black">
                    {halfQty}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActivePortion("full")}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activePortion === "full"
                    ? "bg-stone-900 text-white shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <span>Full ₹{fullPrice}</span>
                {fullQty > 0 && (
                  <span className="px-1 rounded bg-amber-400 text-stone-950 font-mono text-[8px] font-black">
                    {fullQty}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Active Price display */}
          <div className="font-receipt text-xs font-black text-stone-900 flex items-baseline gap-1 pt-0.5">
            <span className="text-[13px]">₹{currentPrice}</span>
            <span className="text-[9.5px] font-normal text-stone-400">
              {hasPortions ? `(${activePortion === "half" ? "Half" : "Full"})` : ""} + GST
            </span>
          </div>

          {item.description && (
            <p className="text-[10px] leading-snug line-clamp-1 text-stone-500">
              {item.description}
            </p>
          )}
        </div>

        {/* Right: Slim Compact Image Box with Overlapping ADD Button */}
        <div className="relative w-18 h-18 sm:w-20 sm:h-20 flex-shrink-0 flex items-center justify-center pb-1">
          {/* Clickable Image Box with Zoom Hint */}
          <div
            onClick={() => onPreviewDish(item)}
            className="w-full h-full rounded-xl overflow-hidden cursor-pointer relative group border shadow-2xs bg-stone-50"
            style={{ borderColor: "var(--hairline)" }}
            title="Tap to zoom dish photo"
          >
            {item.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.photo_url}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl bg-amber-50/50">
                {foodEmoji}
              </div>
            )}

            {/* Tap to View Zoom Icon */}
            <div className="absolute top-1 right-1 px-1 py-0.2 rounded bg-black/60 backdrop-blur-xs flex items-center justify-center text-[8px] text-white">
              <i className="fa-solid fa-magnifying-glass text-[7px]" />
            </div>
          </div>

          {/* Overlapping Bottom ADD / Stepper Button */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10">
            {currentPortionQty === 0 ? (
              <button
                type="button"
                onClick={(e) => onAddToCart(item.id, activePortion, e)}
                className="h-6 px-2.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap"
                style={{
                  backgroundColor: "var(--rust)",
                  color: "var(--rust-text)",
                }}
              >
                <span>ADD</span>
                <span className="text-[9px] font-normal">+</span>
              </button>
            ) : (
              <div
                className="h-6 flex items-center rounded-md border shadow-md overflow-hidden bg-white animate-spring-bounce"
                style={{ borderColor: "var(--rust)" }}
              >
                <button
                  type="button"
                  onClick={() => onRemoveFromCart(item.id, activePortion)}
                  className="w-5 h-full flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-stone-100 transition-colors active:scale-90"
                  style={{ color: "var(--rust)" }}
                >
                  -
                </button>
                <span
                  className="font-receipt text-[11px] font-black px-1 min-w-[14px] text-center"
                  style={{ color: "var(--ink)" }}
                >
                  {currentPortionQty}
                </span>
                <button
                  type="button"
                  onClick={(e) => onAddToCart(item.id, activePortion, e)}
                  className="w-5 h-full flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-stone-100 transition-colors active:scale-90"
                  style={{ color: "var(--rust)" }}
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
