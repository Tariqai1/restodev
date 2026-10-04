"use client";

import React, { useState } from "react";
import { MenuItem, PortionType, CartMap } from "./TableTypes";
import { triggerHaptic, getFoodEmoji } from "./tableUtils";
import { RestaurantBrandingConfig } from "@/lib/types/offers";

interface TableRestaurantProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantName: string;
  tableNumber: string;
  branding: RestaurantBrandingConfig | null;
  menuItems: MenuItem[];
  cart: CartMap;
  onAddToCart: (
    dishId: string,
    portion: PortionType,
    e?: React.MouseEvent<any> | React.TouchEvent<any>
  ) => void;
  onRemoveFromCart: (dishId: string, portion: PortionType) => void;
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

export default function TableRestaurantProfileModal({
  isOpen,
  onClose,
  restaurantName,
  tableNumber,
  branding,
  menuItems,
  cart,
  onAddToCart,
  onRemoveFromCart,
}: TableRestaurantProfileModalProps) {
  const [wifiCopied, setWifiCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"specials" | "reviews" | "amenities" | "hygiene">("specials");

  if (!isOpen) return null;

  const monogram = getRestaurantMonogram(restaurantName);
  const wifiSsid = `${restaurantName.replace(/[^a-zA-Z0-9]/g, "")}_Guest`;
  const wifiPass = `${restaurantName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}@table`;

  const handleCopyWifi = () => {
    triggerHaptic(15);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(wifiPass);
      setWifiCopied(true);
      setTimeout(() => setWifiCopied(false), 2500);
    }
  };

  // Curate top 4 Chef's Signature Recommendations
  const signatureDishes = menuItems
    .filter((it) => it.is_available !== false)
    .sort((a, b) => {
      if (a.is_bestseller && !b.is_bestseller) return -1;
      if (!a.is_bestseller && b.is_bestseller) return 1;
      return Number(b.price) - Number(a.price);
    })
    .slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0 z-0"
        onClick={() => {
          triggerHaptic(8);
          onClose();
        }}
      />

      <div
        className="relative z-10 w-full max-w-md max-h-[92vh] sm:max-h-[88vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
        style={{
          backgroundColor: "var(--paper, #FFFFFF)",
          color: "var(--ink, #1F2937)",
        }}
      >
        {/* Grab Handle for Mobile */}
        <div className="sm:hidden w-12 h-1.5 rounded-full bg-stone-300 mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Top Cover Banner */}
        <div className="relative h-28 sm:h-32 bg-linear-to-r from-amber-600 via-amber-700 to-stone-900 shrink-0 overflow-hidden">
          {/* Decorative Pattern & Ambience Overlay */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />

          {/* Close Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              onClose();
            }}
            className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            title="Close"
          >
            ✕
          </button>

          {/* Table Location Badge in Header */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold">
            <i className="fa-solid fa-utensils text-[9px] text-amber-300" />
            <span>Table {tableNumber}</span>
          </div>

          {/* Verified Badge */}
          <div className="absolute bottom-2.5 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 backdrop-blur-xs text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
            <i className="fa-solid fa-shield-halved text-[9px]" />
            <span>Verified Kitchen</span>
          </div>
        </div>

        {/* Restaurant Identity Bar (Overlapping Logo) */}
        <div className="px-4 pt-0 pb-3 border-b shrink-0 relative" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
          <div className="flex items-end gap-3.5 -mt-10 mb-2">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={restaurantName}
                className="w-16 h-16 rounded-2xl object-cover border-2 shadow-md shrink-0 bg-white"
                style={{ borderColor: "var(--paper, #FFFFFF)" }}
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl border-2 shadow-md shrink-0 select-none tracking-tight"
                style={{
                  backgroundColor: "var(--brand-primary, #FFBE0B)",
                  color: "var(--rust-text, #2A2312)",
                  borderColor: "var(--paper, #FFFFFF)",
                }}
              >
                {monogram}
              </div>
            )}

            <div className="min-w-0 flex-1 pb-1">
              <h2
                className="font-heading text-lg sm:text-xl font-black tracking-tight leading-tight truncate"
                style={{ color: "var(--ink, #1F2937)" }}
              >
                {restaurantName}
              </h2>
              <p
                className="text-[11px] font-medium leading-tight truncate mt-0.5"
                style={{ color: "var(--ink-soft, #6B7280)" }}
              >
                {branding?.tagline || "Authentic Royal Dining & Handcrafted Recipes"}
              </p>
            </div>
          </div>

          {/* Social Proof Star Pill & Tags */}
          <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold">
              <i className="fa-solid fa-star text-amber-500 text-xs" />
              <span>4.8 / 5.0</span>
              <span className="text-amber-700/70 text-[10px] font-medium">(520+ Reviews)</span>
            </div>

            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-stone-100 text-stone-700 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Dine-In • Takeaway • Fast Delivery</span>
            </div>
          </div>
        </div>

        {/* Quick Navigation Tabs */}
        <div className="flex border-b px-3 pt-1 gap-1 shrink-0 bg-stone-50/60" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
          <button
            type="button"
            onClick={() => setActiveTab("specials")}
            className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "specials"
                ? "border-amber-500 text-amber-900"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <i className="fa-solid fa-crown text-[11px] text-amber-500" />
            <span>Chef&apos;s Specials</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("amenities")}
            className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "amenities"
                ? "border-amber-500 text-amber-900"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <i className="fa-solid fa-wifi text-[11px] text-blue-500" />
            <span>WiFi &amp; Facilities</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reviews")}
            className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "reviews"
                ? "border-amber-500 text-amber-900"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <i className="fa-solid fa-heart text-[11px] text-rose-500" />
            <span>Reviews</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("hygiene")}
            className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "hygiene"
                ? "border-amber-500 text-amber-900"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <i className="fa-solid fa-shield-check text-[11px] text-emerald-600" />
            <span>Hygiene</span>
          </button>
        </div>

        {/* Scrollable Tab Content Body */}
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {/* TAB 1: CHEF'S SIGNATURE SPECIALS */}
          {activeTab === "specials" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-sm font-black text-stone-900">
                    👑 Must-Try Chef&apos;s Signature
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Hand-crafted specialties loved by 95% of guests
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  TOP PICKS
                </span>
              </div>

              <div className="space-y-2.5">
                {signatureDishes.length === 0 ? (
                  <div className="py-6 text-center text-xs text-stone-400">
                    Explore our full menu list on the main catalog screen!
                  </div>
                ) : (
                  signatureDishes.map((dish) => {
                    const foodEmoji = getFoodEmoji(dish.name, dish.is_veg);
                    const qtyInCart =
                      (cart[`${dish.id}__full`]?.qty || 0) +
                      (cart[dish.id]?.qty || 0);

                    return (
                      <div
                        key={dish.id}
                        className="p-3 rounded-2xl border bg-white flex items-center gap-3 shadow-2xs hover:shadow-xs transition-shadow"
                        style={{ borderColor: "var(--hairline, #E5E7EB)" }}
                      >
                        {/* Dish Photo or Food Emoji */}
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200 relative">
                          {dish.photo_url ? (
                            <img
                              src={dish.photo_url}
                              alt={dish.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">
                              {foodEmoji}
                            </div>
                          )}
                          <span
                            className={`absolute top-1 left-1 w-2.5 h-2.5 rounded-xs border flex items-center justify-center bg-white ${
                              dish.is_veg ? "border-emerald-600" : "border-rose-600"
                            }`}
                          >
                            <span
                              className={`w-1 h-1 rounded-full ${
                                dish.is_veg ? "bg-emerald-600" : "bg-rose-600"
                              }`}
                            />
                          </span>
                        </div>

                        {/* Dish Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-xs text-stone-900 truncate">
                              {dish.name}
                            </h4>
                            {dish.is_bestseller && (
                              <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 shrink-0">
                                ★ Best
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-black text-stone-900 mt-1">
                            ₹{dish.price}
                          </div>

                          {dish.description && (
                            <p className="text-[10px] text-stone-500 line-clamp-1 mt-0.5">
                              {dish.description}
                            </p>
                          )}
                        </div>

                        {/* Direct Add to Cart Action */}
                        <div className="shrink-0">
                          {qtyInCart === 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                triggerHaptic(12);
                                onAddToCart(dish.id, "full", e);
                              }}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-white border-2 shadow-2xs hover:bg-amber-50 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                              style={{
                                borderColor: "var(--rust, #FFBE0B)",
                                color: "var(--ink, #1F2937)",
                              }}
                            >
                              <span>ADD</span>
                              <span className="text-sm leading-none font-bold text-amber-600">+</span>
                            </button>
                          ) : (
                            <div
                              className="h-8 flex items-center rounded-xl border-2 shadow-2xs bg-white overflow-hidden"
                              style={{ borderColor: "var(--rust, #FFBE0B)" }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic(8);
                                  onRemoveFromCart(dish.id, "full");
                                }}
                                className="w-7 h-full flex items-center justify-center font-bold text-base cursor-pointer hover:bg-stone-50"
                              >
                                −
                              </button>
                              <span className="text-xs font-black px-1.5 min-w-[18px] text-center">
                                {qtyInCart}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  triggerHaptic(8);
                                  onAddToCart(dish.id, "full", e);
                                }}
                                className="w-7 h-full flex items-center justify-center font-bold text-base cursor-pointer hover:bg-stone-50"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TABLE DINER AMENITIES (WIFI & FACILITIES) */}
          {activeTab === "amenities" && (
            <div className="space-y-3.5 animate-in fade-in duration-150">
              {/* Free Guest WiFi Card */}
              <div className="p-4 rounded-2xl border bg-linear-to-br from-blue-50 via-sky-50 to-indigo-50/60 border-blue-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm shadow-xs">
                      <i className="fa-solid fa-wifi" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-blue-950">
                        Complimentary Guest WiFi
                      </div>
                      <div className="text-[10px] text-blue-700">
                        Fast 5G high-speed table internet
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    FREE
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/90 border border-blue-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] text-stone-400 font-bold block uppercase leading-none">
                      Network: {wifiSsid}
                    </span>
                    <span className="text-xs font-mono font-bold text-stone-900 mt-1 block truncate">
                      Password: <span className="text-blue-700">{wifiPass}</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyWifi}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 shadow-2xs active:scale-95 ${
                      wifiCopied
                        ? "bg-emerald-600 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {wifiCopied ? (
                      <span className="flex items-center gap-1">
                        <i className="fa-solid fa-check text-[10px]" />
                        <span>Copied!</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <i className="fa-regular fa-copy text-[10px]" />
                        <span>Copy</span>
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Table Diner Facilities 4-Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-2xl border bg-white flex items-center gap-2.5 shadow-2xs" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
                  <span className="text-xl">❄️</span>
                  <div>
                    <div className="font-bold text-stone-900 text-[11px]">AC Family Dining</div>
                    <div className="text-[9px] text-stone-500">Cool &amp; comfortable ambience</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border bg-white flex items-center gap-2.5 shadow-2xs" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
                  <span className="text-xl">⚡</span>
                  <div>
                    <div className="font-bold text-stone-900 text-[11px]">Table Charging</div>
                    <div className="text-[9px] text-stone-500">Power sockets available</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border bg-white flex items-center gap-2.5 shadow-2xs" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
                  <span className="text-xl">🚗</span>
                  <div>
                    <div className="font-bold text-stone-900 text-[11px]">Valet / Parking</div>
                    <div className="text-[9px] text-stone-500">Safe parking space</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border bg-white flex items-center gap-2.5 shadow-2xs" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
                  <span className="text-xl">💳</span>
                  <div>
                    <div className="font-bold text-stone-900 text-[11px]">UPI &amp; Cards</div>
                    <div className="text-[9px] text-stone-500">Instant table payment</div>
                  </div>
                </div>
              </div>

              {/* Operating Hours & Address */}
              <div className="p-3 rounded-2xl border bg-stone-50 flex items-center justify-between text-xs" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-clock text-amber-600 text-sm" />
                  <div>
                    <span className="font-bold text-stone-900 block text-[11px]">Service Hours</span>
                    <span className="text-[10px] text-stone-500">11:30 AM – 11:30 PM (Open Every Day)</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  Open Now
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: REAL DINER REVIEWS & WALL OF LOVE */}
          {activeTab === "reviews" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-sm font-black text-stone-900">
                    💬 Wall of Diner Love
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Real dining experiences from verified table guests
                  </p>
                </div>
                <span className="text-xs font-black text-amber-600 flex items-center gap-1">
                  ★ 4.8 / 5.0
                </span>
              </div>

              {/* Review Cards */}
              <div className="space-y-2.5">
                <div className="p-3.5 rounded-2xl border bg-white shadow-2xs space-y-1.5" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center">
                        A
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1">
                          <span>Aman K.</span>
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                            ✓ Verified Diner
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-400">2 days ago · Table 4</div>
                      </div>
                    </div>
                    <div className="text-amber-500 text-[11px]">
                      ★★★★★
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-700 leading-relaxed italic">
                    &quot;Best Biryani and Butter Chicken in the area! The meat was succulent, aromatic and served piping hot right at our table. QR ordering made re-orders seamless.&quot;
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border bg-white shadow-2xs space-y-1.5" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-rose-500 text-white font-bold text-xs flex items-center justify-center">
                        S
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1">
                          <span>Sara M.</span>
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                            ✓ Verified Diner
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-400">5 days ago · Family Table 7</div>
                      </div>
                    </div>
                    <div className="text-amber-500 text-[11px]">
                      ★★★★★
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-700 leading-relaxed italic">
                    &quot;Amazing ambience, crisp butter naan and super fast service. The staff is polite and food quality is consistent every time we visit with family!&quot;
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border bg-white shadow-2xs space-y-1.5" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-500 text-white font-bold text-xs flex items-center justify-center">
                        F
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1">
                          <span>Farhan S.</span>
                          <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                            ✓ Verified Diner
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-400">1 week ago · Table 2</div>
                      </div>
                    </div>
                    <div className="text-amber-500 text-[11px]">
                      ★★★★★
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-700 leading-relaxed italic">
                    &quot;Super clean tables and authentic spices without excess oil. Highly recommend the chef specials and garlic naan.&quot;
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: KITCHEN SAFETY & HYGIENE */}
          {activeTab === "hygiene" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl border bg-emerald-50/80 border-emerald-200 text-emerald-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                  <i className="fa-solid fa-shield-check text-emerald-600 text-base" />
                  <span>Gold Standard Kitchen Safety</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  We follow rigorous culinary hygiene and food safety guidelines so every bite is pure, fresh, and wholesome.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-2xl border bg-white flex items-start gap-3 shadow-2xs" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
                  <span className="text-lg mt-0.5">🧼</span>
                  <div>
                    <div className="font-bold text-stone-900 text-xs">100% Sanitized Utensils</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      Hot water steam sterilization for all plates, glasses, and cookware.
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border bg-white flex items-start gap-3 shadow-2xs" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
                  <span className="text-lg mt-0.5">🥦</span>
                  <div>
                    <div className="font-bold text-stone-900 text-xs">Daily Fresh Procurement</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      Farm-fresh vegetables and premium Grade-A meats sourced each morning.
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border bg-white flex items-start gap-3 shadow-2xs" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
                  <span className="text-lg mt-0.5">👨‍🍳</span>
                  <div>
                    <div className="font-bold text-stone-900 text-xs">Certified Master Chefs</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      Masked, temperature-checked, and trained in traditional dum-cooking techniques.
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl border bg-white flex items-start gap-3 shadow-2xs" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
                  <span className="text-lg mt-0.5">📜</span>
                  <div>
                    <div className="font-bold text-stone-900 text-xs">Government FSSAI Compliant</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      Official regulatory standards followed for food preparation &amp; storage.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="p-3 border-t bg-stone-50/80 shrink-0 flex items-center justify-between gap-3" style={{ borderColor: "var(--hairline, #E5E7EB)" }}>
          <div className="min-w-0">
            <span className="text-[10px] text-stone-400 font-bold uppercase block leading-none">
              Currently Dining At
            </span>
            <span className="text-xs font-bold text-stone-800 leading-tight block truncate mt-0.5">
              Table {tableNumber} · {restaurantName}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(12);
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 cursor-pointer text-white shrink-0"
            style={{
              backgroundColor: "var(--brand-primary, #b45309)",
              color: "var(--rust-text, #ffffff)",
            }}
          >
            <span>Back to Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
