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

export default function TableHeroBanner({
  restaurantName,
  tableNumber,
  branding,
  features,
  waiterCooldown,
  onOpenCallModal,
}: TableHeroBannerProps) {
  return (
    <header
      className="sticky top-0 z-30 px-4 py-2.5 border-b backdrop-blur-md flex items-center justify-between"
      style={{
        backgroundColor: "var(--paper)",
        borderColor: "var(--hairline)",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={restaurantName}
            className="w-8 h-8 rounded-lg object-cover shadow-xs border shrink-0"
            style={{ borderColor: "var(--hairline)" }}
          />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-sm shrink-0"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--rust-text)",
            }}
          >
            {tableNumber || "T"}
          </div>
        )}
        <div className="min-w-0">
          <span
            className="font-heading text-sm font-bold tracking-tight block leading-tight truncate"
            style={{ color: "var(--ink)" }}
          >
            {restaurantName}
          </span>
          <span
            className="text-[10px] font-medium block truncate"
            style={{ color: "var(--ink-soft)" }}
          >
            Table {tableNumber}
          </span>
        </div>
      </div>

      {features.callWaiter && (
        <button
          type="button"
          disabled={waiterCooldown > 0}
          onClick={() => {
            triggerHaptic(12);
            onOpenCallModal();
          }}
          className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all active:scale-95 cursor-pointer shrink-0 ${
            waiterCooldown > 0 ? "opacity-50" : ""
          }`}
          style={{
            backgroundColor: "var(--paper-dim)",
            borderColor: "var(--hairline)",
            color: "var(--ink)",
          }}
        >
          <i
            className={`fa-solid ${waiterCooldown > 0 ? "fa-hourglass-half" : "fa-bell"} text-[10px]`}
          />
          <span>{waiterCooldown > 0 ? `${waiterCooldown}s` : "Call"}</span>
        </button>
      )}
    </header>
  );
}
