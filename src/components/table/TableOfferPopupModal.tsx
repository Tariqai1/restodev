"use client";

import React, { useState, useEffect } from "react";
import { RestaurantOfferConfig } from "@/lib/types/offers";
import { triggerHaptic } from "./tableUtils";

interface TableOfferPopupModalProps {
  offerConfig: RestaurantOfferConfig | null | undefined;
  restaurantName: string;
  tableNumber: string;
  onClaimOffer?: () => void;
}

export default function TableOfferPopupModal({
  offerConfig,
  restaurantName,
  tableNumber,
  onClaimOffer,
}: TableOfferPopupModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!offerConfig || !offerConfig.active || offerConfig.showOnTableScan === false) {
      return;
    }

    // Only show once per table session so customer is not annoyed
    try {
      const storageKey = `seen_offer_popup_${tableNumber || "tbl"}`;
      const hasSeen = sessionStorage.getItem(storageKey);
      if (!hasSeen) {
        // Small delay (600ms) for smooth entrance after page load
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 600);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [offerConfig, tableNumber]);

  if (!isOpen || !offerConfig) return null;

  const handleDismiss = () => {
    try {
      const storageKey = `seen_offer_popup_${tableNumber || "tbl"}`;
      sessionStorage.setItem(storageKey, "true");
    } catch {}
    setIsOpen(false);
  };

  const handleClaim = () => {
    triggerHaptic(20);
    try {
      const storageKey = `seen_offer_popup_${tableNumber || "tbl"}`;
      sessionStorage.setItem(storageKey, "true");
    } catch {}
    setIsOpen(false);
    onClaimOffer?.();
  };

  const badgeText = offerConfig.badge || "TODAY'S SPECIAL OFFER";
  const headline = offerConfig.headline || offerConfig.bannerText || "Exclusive Dine-in Offer!";
  const description =
    offerConfig.description ||
    `Enjoy ${offerConfig.discountPercent}% OFF on your table order above ₹${offerConfig.minOrderValue}.`;
  const buttonText = offerConfig.buttonText || "Claim Offer & Explore Menu 🎉";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl max-w-sm w-full overflow-hidden relative animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
          title="Close Offer"
        >
          ✕
        </button>

        {/* Top Visual Banner */}
        {offerConfig.bannerUrl ? (
          <div className="w-full h-44 relative bg-stone-100 overflow-hidden">
            <img
              src={offerConfig.bannerUrl}
              alt="Offer Banner"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-stone-950 inline-flex items-center gap-1 shadow-sm">
                <i className="fa-solid fa-sparkles text-[9px]" />
                <span>{badgeText}</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full h-36 bg-gradient-to-br from-amber-500 via-orange-600 to-rose-700 relative flex flex-col items-center justify-center text-white p-4 text-center">
            {/* Background sparkle accents */}
            <div className="absolute top-2 left-3 text-white/20 text-3xl font-serif">✨</div>
            <div className="absolute bottom-2 right-4 text-white/20 text-4xl font-serif">🎉</div>

            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-2xl shadow-inner mb-2">
              🎁
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white text-orange-800 shadow-xs">
              {badgeText}
            </span>
          </div>
        )}

        {/* Offer Content */}
        <div className="p-5 text-center space-y-3.5">
          <div>
            <h3 className="text-lg font-black text-stone-900 leading-snug">
              {headline}
            </h3>
            <p className="text-xs text-stone-600 mt-1.5 leading-relaxed line-clamp-3">
              {description}
            </p>
          </div>

          {/* Discount Value Badge Pill */}
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/90 flex items-center justify-around gap-2 text-stone-900">
            <div className="text-center">
              <span className="text-[10px] text-amber-800 uppercase font-bold block">
                Discount
              </span>
              <span className="text-lg font-black text-amber-600">
                {offerConfig.discountPercent}% OFF
              </span>
            </div>
            <div className="w-px h-8 bg-amber-200" />
            <div className="text-center">
              <span className="text-[10px] text-amber-800 uppercase font-bold block">
                Min Order
              </span>
              <span className="text-base font-extrabold text-stone-800">
                ₹{offerConfig.minOrderValue}
              </span>
            </div>
            {offerConfig.couponCode && (
              <>
                <div className="w-px h-8 bg-amber-200" />
                <div className="text-center">
                  <span className="text-[10px] text-amber-800 uppercase font-bold block">
                    Code
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-900 bg-white px-1.5 py-0.5 rounded border border-amber-300">
                    {offerConfig.couponCode}
                  </span>
                </div>
              </>
            )}
          </div>

          <p className="text-[10px] text-stone-400">
            Welcome to {restaurantName} · Table {tableNumber}
          </p>

          {/* Claim Action Button */}
          <button
            type="button"
            onClick={handleClaim}
            className="w-full py-3 px-4 rounded-xl text-xs font-extrabold tracking-wide uppercase shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            style={{
              backgroundColor: "var(--brand-primary, #b45309)",
              color: "var(--rust-text, #ffffff)",
            }}
          >
            <span>{buttonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
