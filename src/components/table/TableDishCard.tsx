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

function getSpiciness(name: string): "spicy" | "mild" | "medium" {
  const n = name.toLowerCase();
  if (
    n.includes("chilli") ||
    n.includes("chili") ||
    n.includes("spicy") ||
    n.includes("schezwan") ||
    n.includes("peri") ||
    n.includes("kolhapuri") ||
    n.includes("angara") ||
    n.includes("mirch") ||
    n.includes("hot")
  ) {
    return "spicy";
  }
  if (
    n.includes("sweet") ||
    n.includes("kheer") ||
    n.includes("gulab") ||
    n.includes("halwa") ||
    n.includes("shake") ||
    n.includes("lassi") ||
    n.includes("cream") ||
    n.includes("malai") ||
    n.includes("paneer butter masala") ||
    n.includes("dal makhani") ||
    n.includes("ice cream")
  ) {
    return "mild";
  }
  return "medium";
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
  const spiciness = getSpiciness(item.name);

  const fullPrice = Number(item.price);
  const halfPrice = Math.round(fullPrice * 0.6);
  const currentQty =
    hasPortions && activePortion === "half" ? halfQty : fullQty;

  return (
    <div
      className="py-3.5 flex gap-3 items-start border-b last:border-b-0"
      style={{ borderColor: "var(--hairline)" }}
    >
      {/* Left: Info */}
      <div className="flex-1 min-w-0 pr-1">
        {/* Veg / Non-veg indicator + Badges */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {item.is_veg ? (
            <span
              className="w-3.5 h-3.5 rounded-xs border-[1.5px] border-emerald-600 bg-white flex items-center justify-center shrink-0 shadow-2xs"
              title="Vegetarian"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            </span>
          ) : (
            <span
              className="w-3.5 h-3.5 rounded-xs border-[1.5px] border-rose-600 bg-white flex items-center justify-center shrink-0 shadow-2xs"
              title="Non-Vegetarian"
            >
              <span className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[6px] border-b-rose-600" />
            </span>
          )}

          {/* Bestseller Badge */}
          {item.is_bestseller && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wide inline-flex items-center gap-1 shadow-2xs">
              <span className="text-amber-600 font-bold">★</span>
              <span>Bestseller</span>
            </span>
          )}

          {/* Spiciness Indicator Badge */}
          {spiciness === "spicy" ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
              <span>🌶️</span>
              <span>Spicy</span>
            </span>
          ) : spiciness === "mild" ? (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>Mild</span>
            </span>
          ) : (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
              <span>🫑</span>
              <span>Medium</span>
            </span>
          )}
        </div>

        {/* Dish name */}
        <h3
          className="text-[14.5px] font-bold leading-snug cursor-pointer hover:text-amber-800 transition-colors text-stone-900"
          onClick={() => onPreviewDish(item)}
        >
          {item.name}
        </h3>

        {/* Price & Portions */}
        <div className="mt-1 flex items-center gap-2.5 flex-wrap">
          <span className="text-[15px] font-black text-stone-900">
            ₹{hasPortions && activePortion === "half" ? halfPrice : fullPrice}
          </span>
          {hasPortions && (
            <div className="inline-flex items-center p-0.5 rounded-lg bg-stone-100 border border-stone-200">
              <button
                type="button"
                onClick={() => setActivePortion("half")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  activePortion === "half"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Half ₹{halfPrice}
              </button>
              <button
                type="button"
                onClick={() => setActivePortion("full")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  activePortion === "full"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Full ₹{fullPrice}
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        {item.description && (
          <p
            className="text-[12px] leading-relaxed line-clamp-2 mt-1 text-stone-600"
          >
            {item.description}
          </p>
        )}
      </div>

      {/* Right: Photo + ADD */}
      <div className="relative w-[100px] h-[100px] shrink-0 pb-1">
        <div
          className="w-full h-full rounded-xl overflow-hidden border bg-gradient-to-br from-amber-50/60 to-orange-50/60 cursor-pointer shadow-2xs group relative"
          style={{ borderColor: "var(--hairline)" }}
          onClick={() => onPreviewDish(item)}
          title="Tap to preview dish"
        >
          {item.photo_url ? (
            <img
              src={item.photo_url}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl bg-amber-50/50">
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
              className="h-8 px-4 rounded-lg text-[12px] font-extrabold uppercase tracking-wider shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap border-2 border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50"
            >
              ADD <span className="text-base font-bold text-emerald-600 leading-none">+</span>
            </button>
          ) : (
            <div className="h-8 flex items-center rounded-lg border-2 border-emerald-600 shadow-sm overflow-hidden bg-emerald-600 text-white">
              <button
                type="button"
                onClick={() => onRemoveFromCart(item.id, activePortion)}
                className="w-7 h-full flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-emerald-700 transition-colors"
              >
                −
              </button>
              <span className="text-xs font-black px-1.5 min-w-[20px] text-center text-white bg-emerald-600">
                {currentQty}
              </span>
              <button
                type="button"
                onClick={(e) => onAddToCart(item.id, activePortion, e)}
                className="w-7 h-full flex items-center justify-center font-bold text-sm cursor-pointer hover:bg-emerald-700 transition-colors"
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
