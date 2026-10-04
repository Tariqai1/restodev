"use client";

import React from "react";
import { RestaurantFeatures } from "./TableTypes";
import { triggerHaptic } from "./tableUtils";
import { RestaurantBrandingConfig } from "@/lib/types/offers";

interface TableHeroBannerProps {
  restaurantName: string;
  tableNumber: string;
  branding: RestaurantBrandingConfig | null;
  features: RestaurantFeatures;
  waiterCooldown: number;
  onOpenCallModal: () => void;
}

/**
 * Returns 2-letter monogram initials for restaurant branding (e.g. "Order Desk Restaurant" -> "OD")
 */
function getRestaurantMonogram(name: string): string {
  if (!name) return "OD";
  const words = name
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (name.slice(0, 2) || "OD").toUpperCase();
}

export default function TableHeroBanner({
  restaurantName,
  tableNumber,
  branding,
  features,
  waiterCooldown,
  onOpenCallModal,
}: TableHeroBannerProps) {
  // Detect delivery/takeaway virtual tables vs physical dining tables
  const isDelivery = Boolean(
    tableNumber && (tableNumber.includes("DEL-") || tableNumber.startsWith("DEL"))
  );
  const isPickup = Boolean(
    tableNumber && (tableNumber.includes("PU-") || tableNumber.startsWith("PU"))
  );

  // Extract clean ticket or order number (e.g., "DEL-8852" or "OD-DEL-8852" -> "8852")
  const orderNum = tableNumber
    ? tableNumber.replace(/^.*(DEL|PU)-?/i, "") || tableNumber
    : "";

  // Show call waiter button for dine-in tables unless disabled
  const showCallWaiter = !isDelivery && !isPickup && features?.callWaiter !== false;

  const monogram = getRestaurantMonogram(restaurantName);

  return (
    <header
      className="sticky top-0 z-30 px-3.5 sm:px-4 py-2.5 border-b backdrop-blur-md flex items-center justify-between"
      style={{
        backgroundColor: "var(--paper)",
        borderColor: "var(--hairline)",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Restaurant Monogram Logo Avatar */}
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={restaurantName}
            className="w-9 h-9 rounded-xl object-cover shadow-2xs border shrink-0"
            style={{ borderColor: "var(--hairline)" }}
          />
        ) : (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs sm:text-sm shadow-2xs border shrink-0 tracking-wider select-none"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--rust-text)",
              borderColor: "var(--hairline)",
            }}
            title={restaurantName}
          >
            {monogram}
          </div>
        )}

        {/* Restaurant Name & Table / Order Badge */}
        <div className="min-w-0">
          <h1
            className="font-heading text-sm sm:text-base font-extrabold tracking-tight block leading-tight truncate"
            style={{ color: "var(--ink)" }}
          >
            {restaurantName}
          </h1>

          <div className="flex items-center gap-1.5 mt-0.5">
            {isDelivery ? (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-900 bg-amber-100/90 border border-amber-300 px-1.5 py-0.5 rounded-md leading-none">
                <i className="fa-solid fa-motorcycle text-[9px] text-amber-700" />
                <span>Delivery #{orderNum}</span>
              </span>
            ) : isPickup ? (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-blue-900 bg-blue-100/90 border border-blue-300 px-1.5 py-0.5 rounded-md leading-none">
                <i className="fa-solid fa-bag-shopping text-[9px] text-blue-700" />
                <span>Takeaway #{orderNum}</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold block truncate leading-none"
                style={{ color: "var(--ink-soft)" }}
              >
                <i className="fa-solid fa-utensils text-[9px] opacity-70" />
                <span>Table {tableNumber || "T"}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Action: Call Waiter (Dine-in) or Live Kitchen Badge (Delivery) */}
      {showCallWaiter ? (
        <button
          type="button"
          disabled={waiterCooldown > 0}
          onClick={() => {
            triggerHaptic(12);
            onOpenCallModal();
          }}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer shrink-0 shadow-2xs ${
            waiterCooldown > 0
              ? "opacity-60 bg-stone-100 text-stone-500 border-stone-200"
              : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border-amber-300"
          }`}
          style={
            waiterCooldown <= 0
              ? {
                  borderColor: "var(--rust)",
                  color: "var(--rust)",
                }
              : undefined
          }
          title="Call Waiter to Table"
        >
          <i
            className={`fa-solid ${
              waiterCooldown > 0 ? "fa-hourglass-half text-stone-500" : "fa-bell"
            } text-xs`}
          />
          <span>{waiterCooldown > 0 ? `${waiterCooldown}s` : "Call Waiter"}</span>
        </button>
      ) : (isDelivery || isPickup) ? (
        <div className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Kitchen</span>
        </div>
      ) : null}
    </header>
  );
}
