"use client";

import React from "react";
import { RestaurantFeatures } from "./TableTypes";
import { triggerHaptic } from "./tableUtils";
import { RestaurantBrandingConfig, RestaurantThemeType } from "@/lib/types/offers";

interface TableHeroBannerProps {
  restaurantName: string;
  tableNumber: string;
  branding: RestaurantBrandingConfig | null;
  theme: RestaurantThemeType;
  setTheme: (theme: RestaurantThemeType) => void;
  features: RestaurantFeatures;
  waiterCooldown: number;
  onOpenCallModal: () => void;
  cartCount?: number;
  onOpenCart?: () => void;
}

export default function TableHeroBanner({
  restaurantName,
  tableNumber,
  branding,
  theme,
  setTheme,
  features,
  waiterCooldown,
  onOpenCallModal,
  cartCount = 0,
  onOpenCart,
}: TableHeroBannerProps) {
  return (
    <>
      {/* Sticky Table Header */}
      <header
        className="sticky top-0 z-30 px-4 py-3 border-b backdrop-blur-md bg-opacity-95 flex items-center justify-between"
        style={{
          backgroundColor: "var(--paper)",
          borderColor: "var(--hairline)",
          boxShadow: "0 2px 10px rgba(42, 35, 18, 0.05)",
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={restaurantName}
              className="w-9 h-9 rounded-xl object-cover shadow-xs border flex-shrink-0"
              style={{ borderColor: "var(--hairline)" }}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm font-heading flex-shrink-0"
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
              className="font-heading text-base font-bold tracking-tight block leading-tight truncate"
              style={{ color: "var(--ink)" }}
            >
              {restaurantName}
            </span>
            <div
              className="flex items-center gap-1.5 text-[11px] font-medium truncate"
              style={{ color: "var(--ink-soft)" }}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className="truncate">
                {branding?.tagline ? branding.tagline : `Table ${tableNumber} · Live Station`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Quick theme toggle */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              const themes: RestaurantThemeType[] = [
                "amber",
                "saffron",
                "crimson",
                "emerald",
                "charcoal",
              ];
              const nextIdx = (themes.indexOf(theme) + 1) % themes.length;
              setTheme(themes[nextIdx]);
            }}
            title={`Current theme: ${theme}. Click to switch theme palette.`}
            className="w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-xs"
            style={{
              backgroundColor: "var(--paper-dim)",
              borderColor: "var(--hairline)",
            }}
          >
            <i className="fa-solid fa-palette text-xs text-stone-700" />
          </button>

          {/* View Cart Icon with Live Badge Counter */}
          {onOpenCart && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(12);
                onOpenCart();
              }}
              title="View Cart / Review Order"
              className="relative w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-xs"
              style={{
                backgroundColor: cartCount > 0 ? "var(--rust)" : "var(--paper-dim)",
                borderColor: cartCount > 0 ? "var(--rust)" : "var(--hairline)",
                color: cartCount > 0 ? "var(--rust-text)" : "var(--ink)",
              }}
            >
              <i className="fa-solid fa-cart-shopping text-xs" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-amber-400 text-stone-950 font-mono text-[9px] font-black flex items-center justify-center shadow-xs border border-white">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Call Waiter Buzzer Button */}
          {features.callWaiter && (
            <button
              type="button"
              disabled={waiterCooldown > 0}
              onClick={() => {
                triggerHaptic(12);
                onOpenCallModal();
              }}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer border ${
                waiterCooldown > 0 ? "opacity-60 bg-stone-200" : ""
              }`}
              style={{
                backgroundColor: "var(--paper-dim)",
                borderColor: "var(--hairline)",
                color: "var(--ink)",
              }}
            >
              <i className={`fa-solid ${waiterCooldown > 0 ? "fa-hourglass-half" : "fa-bell"} text-xs`} />
              <span>{waiterCooldown > 0 ? `${waiterCooldown}s` : "Call"}</span>
            </button>
          )}

        </div>
      </header>
    </>
  );
}
