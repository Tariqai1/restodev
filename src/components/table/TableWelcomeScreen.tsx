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
  setTheme: (theme: RestaurantThemeType) => void;
  branding: RestaurantBrandingConfig | null;
  restaurantName: string;
  tableNumber: string;
  offerConfig?: RestaurantOfferConfig;
  onExplore: () => void;
}

export default function TableWelcomeScreen({
  theme,
  setTheme,
  branding,
  restaurantName,
  tableNumber,
  offerConfig,
  onExplore,
}: TableWelcomeScreenProps) {
  return (
    <main
      data-theme={theme}
      className="h-[100dvh] max-h-[100dvh] w-full max-w-md mx-auto flex flex-col justify-between p-4 sm:p-5 overflow-hidden select-none"
      style={{ backgroundColor: "var(--paper)", color: "var(--ink)" }}
    >
      {/* Top Header Section */}
      <div className="flex-shrink-0 space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <div
            className="text-[10px] font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 shadow-xs uppercase tracking-wider"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--rust-text)",
            }}
          >
            <span>Table Service</span>
          </div>

          <div
            className="flex items-center gap-1 bg-white/80 backdrop-blur px-2 py-1 rounded-lg border shadow-xs"
            style={{ borderColor: "var(--hairline)" }}
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setTheme("saffron");
              }}
              title="Punjab Saffron Theme"
              className={`w-3.5 h-3.5 rounded-md border cursor-pointer ${
                theme === "saffron" ? "ring-2 ring-orange-500 scale-110" : "opacity-50"
              }`}
              style={{ backgroundColor: "#EA580C", borderColor: "#2C1810" }}
            />
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setTheme("amber");
              }}
              title="Amber Gold Theme"
              className={`w-3.5 h-3.5 rounded-md border cursor-pointer ${
                theme === "amber" ? "ring-2 ring-amber-500 scale-110" : "opacity-50"
              }`}
              style={{ backgroundColor: "#FFBE0B", borderColor: "#2A2312" }}
            />
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setTheme("crimson");
              }}
              title="Velvet Crimson Theme"
              className={`w-3.5 h-3.5 rounded-md border cursor-pointer ${
                theme === "crimson" ? "ring-2 ring-rose-700 scale-110" : "opacity-50"
              }`}
              style={{ backgroundColor: "#741A2F", borderColor: "#FFC6A8" }}
            />
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setTheme("emerald");
              }}
              title="Pure Emerald Theme"
              className={`w-3.5 h-3.5 rounded-md border cursor-pointer ${
                theme === "emerald" ? "ring-2 ring-emerald-500 scale-110" : "opacity-50"
              }`}
              style={{ backgroundColor: "#059669", borderColor: "#022C22" }}
            />
            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setTheme("charcoal");
              }}
              title="Midnight Charcoal Theme"
              className={`w-3.5 h-3.5 rounded-md border cursor-pointer ${
                theme === "charcoal" ? "ring-2 ring-amber-400 scale-110" : "opacity-50"
              }`}
              style={{ backgroundColor: "#18181B", borderColor: "#F59E0B" }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={restaurantName}
              className="w-12 h-12 rounded-xl object-cover shadow-sm border flex-shrink-0"
              style={{ borderColor: "var(--hairline)" }}
            />
          ) : null}
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
                {branding?.tagline || "Direct Kitchen Ordering & Table Service"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Centerpiece: Luxury Confirmed Table Card */}
      {/* Centerpiece: Confirmed Table Card */}
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
              <span>CONFIRMED TABLE</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div
              className="font-heading text-5xl sm:text-6xl font-black tracking-tight mt-1 leading-none"
              style={{ color: "var(--ink)" }}
            >
              {tableNumber || "T--"}
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
      {offerConfig && offerConfig.active && (
        <div
          className="my-auto p-3.5 rounded-xl border bg-amber-50/80 border-amber-200/80 flex items-center justify-between shadow-xs select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 text-sm">
              <i className="fa-solid fa-tag" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-stone-900 truncate">
                {offerConfig.bannerText || `FLAT ${offerConfig.discountPercent}% OFF Today`}
              </div>
              <div className="text-[10px] text-stone-500 font-medium leading-tight truncate">
                Available on orders above ₹{offerConfig.minOrderValue}
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-amber-500 text-stone-900 font-bold text-[10px] tracking-wider uppercase shrink-0">
            Available
          </span>
        </div>
      )}

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
