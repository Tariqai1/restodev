"use client";

import React from "react";
import { triggerHaptic } from "./tableUtils";
import {
  RestaurantBrandingConfig,
  RestaurantThemeType,
  RestaurantOfferConfig,
} from "@/lib/types/offers";

interface TableWelcomeScreenProps {
  theme: RestaurantThemeType;
  branding: RestaurantBrandingConfig | null;
  restaurantName: string;
  tableNumber: string;
  offerConfig?: RestaurantOfferConfig;
  onExplore: () => void;
}

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

export default function TableWelcomeScreen({
  theme,
  branding,
  restaurantName,
  tableNumber,
  offerConfig,
  onExplore,
}: TableWelcomeScreenProps) {
  const isDelivery = Boolean(
    tableNumber && (tableNumber.includes("DEL-") || tableNumber.startsWith("DEL"))
  );
  const isPickup = Boolean(
    tableNumber && (tableNumber.includes("PU-") || tableNumber.startsWith("PU"))
  );
  const orderNum = tableNumber
    ? tableNumber.replace(/^.*(DEL|PU)-?/i, "") || tableNumber
    : "";
  const monogram = getRestaurantMonogram(restaurantName);

  return (
    <main
      data-theme={theme}
      className="h-[100dvh] max-h-[100dvh] w-full max-w-md mx-auto flex flex-col justify-between p-4 sm:p-5 overflow-hidden select-none"
      style={{ backgroundColor: "var(--paper)", color: "var(--ink)" }}
    >
      {/* Top Header Section */}
      <div className="flex-shrink-0 space-y-1.5 pt-1">
        <div
          className="text-[10px] font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 shadow-xs uppercase tracking-wider"
          style={{
            backgroundColor: "var(--brand-primary)",
            color: "var(--rust-text)",
          }}
        >
          <span>{isDelivery ? "Home Delivery" : isPickup ? "Takeaway Pickup" : "Table Service"}</span>
        </div>

        <div className="flex items-center gap-3 pt-1">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={restaurantName}
              className="w-12 h-12 rounded-xl object-cover shadow-sm border shrink-0"
              style={{ borderColor: "var(--hairline)" }}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-sm border shrink-0 tracking-wider select-none"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--rust-text)",
                borderColor: "var(--hairline)",
              }}
            >
              {monogram}
            </div>
          )}
          <div className="min-w-0">
            <h1
              className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight line-clamp-1 leading-tight"
              style={{ color: "var(--ink)" }}
            >
              {restaurantName}
            </h1>
            <div
              className="flex items-center gap-1.5 text-xs font-medium mt-0.5"
              style={{ color: "var(--ink-soft)" }}
            >
              <span className="line-clamp-1">
                {branding?.tagline || (isDelivery ? "Direct Kitchen Delivery • 0% Commission" : "Direct Kitchen Ordering & Table Service")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Centerpiece: Luxury Confirmed Table / Order Card */}
      <div
        className="my-auto p-4 sm:p-5 rounded-2xl border shadow-sm relative overflow-hidden flex flex-col justify-between"
        style={{
          backgroundColor: "var(--card-bg, #FFFFFF)",
          borderColor: "var(--hairline)",
        }}
      >
        <div className="flex justify-between items-start relative z-10">
          <div>
            <div
              className="text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5"
              style={{ color: "var(--ink-soft)" }}
            >
              <span>{isDelivery ? "CONFIRMED DELIVERY ORDER" : isPickup ? "CONFIRMED TAKEAWAY" : "CONFIRMED TABLE"}</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div
              className="font-heading text-4xl sm:text-5xl font-black tracking-tight mt-1 leading-none"
              style={{ color: "var(--ink)" }}
            >
              {isDelivery ? `Delivery #${orderNum}` : isPickup ? `Takeaway #${orderNum}` : (tableNumber || "T--")}
            </div>
          </div>

          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-xs border"
            style={{
              backgroundColor: "var(--paper-dim)",
              borderColor: "var(--hairline)",
            }}
          >
            <i className="fa-solid fa-bell text-stone-700 text-lg" />
          </div>
        </div>

        <div
          className="mt-4 pt-3 border-t flex items-center justify-between text-[11px] font-medium"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div className="flex items-center gap-2" style={{ color: "var(--sage)" }}>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-600" />
            <span>Kitchen Connection Active</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
            Live Sync
          </span>
        </div>
      </div>

      {/* First-Scan Welcome Offer Card */}
      {offerConfig && offerConfig.active && (() => {
        const rawBanner = offerConfig.bannerText || "";
        const parts = rawBanner.split("·");
        const offerHeadline = parts[0]?.trim() || `FLAT ${offerConfig.discountPercent}% OFF TODAY`;
        const offerSubtext = parts[1]?.trim() || `Auto-applied on orders above ₹${offerConfig.minOrderValue}`;

        return (
          <div
            className="my-auto p-3.5 rounded-xl border bg-amber-50/80 border-amber-200/80 flex items-center justify-between shadow-xs select-none gap-2.5"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 text-sm">
                <i className="fa-solid fa-tag" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-stone-900 leading-snug">
                  {offerHeadline}
                </div>
                <div className="text-[10px] text-amber-900/80 font-medium leading-tight mt-0.5">
                  {offerSubtext}
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-amber-500 text-stone-900 font-bold text-[10px] tracking-wider uppercase shrink-0">
              Available
            </span>
          </div>
        );
      })()}

      {/* 3-Column Feature Grid */}
      <div className="grid grid-cols-3 gap-2 my-auto">
        <div
          className="p-3 rounded-xl border bg-white text-center flex flex-col items-center justify-center shadow-xs"
          style={{ borderColor: "var(--hairline)" }}
        >
          <i className="fa-solid fa-bolt text-amber-600 text-sm mb-1.5" />
          <span className="text-[11px] font-bold leading-tight" style={{ color: "var(--ink)" }}>
            Quick Order
          </span>
          <span className="text-[9px] font-medium text-stone-400 mt-0.5">
            Instant Catalog
          </span>
        </div>

        <div
          className="p-3 rounded-xl border bg-white text-center flex flex-col items-center justify-center shadow-xs"
          style={{ borderColor: "var(--hairline)" }}
        >
          <i className="fa-solid fa-clock text-blue-600 text-sm mb-1.5" />
          <span className="text-[11px] font-bold leading-tight" style={{ color: "var(--ink)" }}>
            Live Prep
          </span>
          <span className="text-[9px] font-medium text-stone-400 mt-0.5">
            Kitchen Tracker
          </span>
        </div>

        <div
          className="p-3 rounded-xl border bg-white text-center flex flex-col items-center justify-center shadow-xs"
          style={{ borderColor: "var(--hairline)" }}
        >
          <i className="fa-solid fa-bell text-emerald-600 text-sm mb-1.5" />
          <span className="text-[11px] font-bold leading-tight" style={{ color: "var(--ink)" }}>
            Staff Call
          </span>
          <span className="text-[9px] font-medium text-stone-400 mt-0.5">
            Direct Buzzer
          </span>
        </div>
      </div>

      {/* Bottom CTA Area */}
      <div className="flex-shrink-0 pt-2 pb-1 space-y-2">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(15);
            onExplore();
          }}
          className="w-full h-12 sm:h-13 rounded-xl text-sm font-bold shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
          style={{
            backgroundColor: "var(--rust)",
            color: "var(--rust-text)",
          }}
        >
          <span className="tracking-wide">Explore Menu &amp; Order</span>
          <i className="fa-solid fa-arrow-right text-xs" />
        </button>
        <p className="text-center text-[11px] text-stone-500 font-medium">
          Direct kitchen dispatch • No app download required
        </p>
      </div>
    </main>
  );
}
