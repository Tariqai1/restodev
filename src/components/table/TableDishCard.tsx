"use client";

import React, { useState } from "react";
import { MenuItem, PortionType } from "./TableTypes";
import { getFoodEmoji } from "./tableUtils";

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
  onAddToCart: (
    dishId: string,
    portion: PortionType,
    e?: React.MouseEvent<any> | React.TouchEvent<any>
  ) => void;
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
  const hasPortions = showPortions && isPortionEligible(item);
  const [activePortion, setActivePortion] = useState<PortionType>("full");

  const fullPrice = Number(item.price);
  const halfPrice = Math.round(fullPrice * 0.6);
  const currentQty =
    hasPortions && activePortion === "half" ? halfQty : fullQty;
  const totalQty = halfQty + fullQty;

  return (
    <div
      className="py-3 flex gap-3 items-start border-b last:border-b-0"
      style={{ borderColor: "var(--hairline)" }}
    >
      {/* Left: Info */}
      <div className="flex-1 min-w-0">
        {/* Veg / Non-veg indicator */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className={item.is_veg ? "veg-indicator" : "nonveg-indicator"} />
          {item.is_bestseller && (
            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
              ★ Bestseller
            </span>
          )}
        </div>

        {/* Dish name */}
        <h3
          className="text-[14px] font-bold leading-snug cursor-pointer"
          style={{ color: "var(--ink)" }}
          onClick={() => onPreviewDish(item)}
        >
          {item.name}
        </h3>

        {/* Price */}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-sm font-bold" style={{ color: "var(--ink)" }}>
            ₹{hasPortions && activePortion === "half" ? halfPrice : fullPrice}
          </span>
          {hasPortions && (
            <div className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--ink-soft)" }}>
              <button
                type="button"
                onClick={() => setActivePortion("half")}
                className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  activePortion === "half"
                    ? "bg-stone-800 text-white"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Half
              </button>
              <span className="text-stone-300">|</span>
              <button
                type="button"
                onClick={() => setActivePortion("full")}
                className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  activePortion === "full"
                    ? "bg-stone-800 text-white"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Full
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        {item.description && (
          <p
            className="text-[12px] leading-relaxed line-clamp-2 mt-1"
            style={{ color: "var(--ink-soft)" }}
          >
            {item.description}
          </p>
        )}
      </div>

      {/* Right: Photo + ADD */}
      <div className="relative w-[100px] h-[100px] shrink-0">
        <div
          className="w-full h-full rounded-xl overflow-hidden border bg-stone-50 cursor-pointer"
          style={{ borderColor: "var(--hairline)" }}
          onClick={() => onPreviewDish(item)}
        >
          {item.photo_url ? (
            <img
              src={item.photo_url}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl bg-stone-50">
              {foodEmoji}
            </div>
          )}
        </div>

        {/* ADD / Stepper overlapping bottom */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10">
          {currentQty === 0 ? (
            <button
              type="button"
              onClick={(e) => onAddToCart(item.id, activePortion, e)}
              className="h-8 px-5 rounded-lg text-[12px] font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap border-2 bg-white"
              style={{
                borderColor: "var(--rust)",
                color: "var(--rust)",
              }}
            >
              ADD <span className="text-lg leading-none">+</span>
            </button>
          ) : (
            <div
              className="h-8 flex items-center rounded-lg border-2 shadow-md overflow-hidden bg-white"
              style={{ borderColor: "var(--rust)" }}
            >
              <button
                type="button"
                onClick={() => onRemoveFromCart(item.id, activePortion)}
                className="w-8 h-full flex items-center justify-center font-bold text-base cursor-pointer hover:bg-stone-50 transition-colors"
                style={{ color: "var(--rust)" }}
              >
                −
              </button>
              <span
                className="text-sm font-bold px-2 min-w-[20px] text-center"
                style={{ color: "var(--ink)" }}
              >
                {currentQty}
              </span>
              <button
                type="button"
                onClick={(e) => onAddToCart(item.id, activePortion, e)}
                className="w-8 h-full flex items-center justify-center font-bold text-base cursor-pointer hover:bg-stone-50 transition-colors"
                style={{ color: "var(--rust)" }}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
