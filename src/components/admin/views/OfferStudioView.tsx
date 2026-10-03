"use client";

import React, { useState, useEffect } from "react";
import AdminButton from "../ui/AdminButton";
import { RestaurantOfferConfig, DEFAULT_OFFER_CONFIG } from "@/lib/types/offers";

interface OfferStudioViewProps {
  restaurantId?: string;
  restaurantName?: string;
}

export default function OfferStudioView({
  restaurantId,
  restaurantName = "Your Restaurant",
}: OfferStudioViewProps) {
  const [offer, setOffer] = useState<RestaurantOfferConfig>(DEFAULT_OFFER_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Fetch current offer config on load
  useEffect(() => {
    let isMounted = true;
    async function loadOffer() {
      setIsLoading(true);
      setErrorMsg("");
      try {
        const res = await fetch("/api/restaurant/offers");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.offerConfig) {
            setOffer({
              ...DEFAULT_OFFER_CONFIG,
              ...data.offerConfig,
            });
          }
        }
      } catch (err: any) {
        console.error("Failed to load offer config:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadOffer();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBanner(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to upload image");
      if (data.url) {
        setOffer((prev) => ({ ...prev, bannerUrl: data.url }));
      }
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMsg("");
    try {
      const res = await fetch("/api/restaurant/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerConfig: offer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save offer settings");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save offer settings");
    } finally {
      setIsSaving(false);
    }
  };

  const presetDiscounts = [5, 10, 15, 20, 25, 30, 40, 50];
  const presetBadges = ["TODAY'S SPECIAL", "WEEKEND FEAST", "HAPPY HOURS", "CHEF'S PICK", "LIMITED DEAL"];

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 mb-2">
            <i className="fa-solid fa-gift text-[11px] text-amber-600" />
            <span>Promotion &amp; Welcome Popup Engine</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Offer &amp; Promo Studio
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Design promotional offers that automatically greet guests when they scan the table QR code.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AdminButton
            variant="primary"
            size="md"
            leftIcon={isSaving ? "fa-spinner fa-spin" : "fa-floppy-disk"}
            onClick={handleSave}
            disabled={isSaving || isLoading}
          >
            {isSaving ? "Publishing Changes..." : "Save & Publish Offer"}
          </AdminButton>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600 text-base" />
          <span>Offer published live! Guests scanning the table QR code will see this offer immediately.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <i className="fa-solid fa-triangle-exclamation text-rose-600 text-base" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Controls on Left, Real-Time Phone Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Master Toggles Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Offer Activation Controls
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Offer Master Active */}
              <div
                onClick={() => setOffer((prev) => ({ ...prev, active: !prev.active }))}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                  offer.active
                    ? "border-emerald-600 bg-emerald-50/50"
                    : "border-slate-200 bg-slate-50 opacity-70"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-xs mt-0.5 shrink-0 ${
                    offer.active ? "bg-emerald-600 text-white" : "border border-slate-300 bg-white"
                  }`}
                >
                  {offer.active && <i className="fa-solid fa-check text-[10px]" />}
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 block">
                    Offer Active
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    {offer.active ? "Campaign running live across store" : "Campaign is paused / hidden"}
                  </span>
                </div>
              </div>

              {/* Show on Table QR Scan */}
              <div
                onClick={() =>
                  setOffer((prev) => ({
                    ...prev,
                    showOnTableScan: !prev.showOnTableScan,
                  }))
                }
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                  offer.showOnTableScan
                    ? "border-amber-600 bg-amber-50/50"
                    : "border-slate-200 bg-slate-50 opacity-70"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-xs mt-0.5 shrink-0 ${
                    offer.showOnTableScan ? "bg-amber-600 text-white" : "border border-slate-300 bg-white"
                  }`}
                >
                  {offer.showOnTableScan && <i className="fa-solid fa-check text-[10px]" />}
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 block">
                    Table Scan Welcome Popup
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    {offer.showOnTableScan ? "Shows as popup when QR is scanned" : "Hidden from QR scan popup"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Offer Content Details Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Banner &amp; Messaging
            </h3>

            {/* Offer Badge & Presets */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Offer Tag / Badge
              </label>
              <input
                type="text"
                value={offer.badge || ""}
                onChange={(e) => setOffer((prev) => ({ ...prev, badge: e.target.value }))}
                placeholder="e.g. TODAY'S SPECIAL"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:border-amber-500"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {presetBadges.map((badge) => (
                  <button
                    key={badge}
                    type="button"
                    onClick={() => setOffer((prev) => ({ ...prev, badge }))}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      offer.badge === badge
                        ? "bg-amber-100 border-amber-300 text-amber-900"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {badge}
                  </button>
                ))}
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Headline / Offer Title
              </label>
              <input
                type="text"
                value={offer.headline || ""}
                onChange={(e) => setOffer((prev) => ({ ...prev, headline: e.target.value }))}
                placeholder="e.g. Flat 20% OFF on Orders Above ₹399!"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Description / Terms
              </label>
              <textarea
                rows={2}
                value={offer.description || ""}
                onChange={(e) => setOffer((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Exclusive dine-in special treat. Discount automatically applied at checkout."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* Top Announcement Bar Text */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Menu Header Ticker Banner Text
              </label>
              <input
                type="text"
                value={offer.bannerText || ""}
                onChange={(e) => setOffer((prev) => ({ ...prev, bannerText: e.target.value }))}
                placeholder="e.g. FLAT 20% OFF TODAY · Auto-applied on orders above ₹399"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-400">
                This scrolling announcement banner appears at the very top of the customer menu.
              </p>
            </div>
          </div>

          {/* Discount & Numbers Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Discount &amp; Eligibility
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Discount % */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Discount Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={offer.discountPercent}
                    onChange={(e) =>
                      setOffer((prev) => ({
                        ...prev,
                        discountPercent: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full pl-3 pr-7 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                    %
                  </span>
                </div>
              </div>

              {/* Min Order Value */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Min. Order Value (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={offer.minOrderValue}
                    onChange={(e) =>
                      setOffer((prev) => ({
                        ...prev,
                        minOrderValue: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Coupon Code */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Coupon Code (Optional)
                </label>
                <input
                  type="text"
                  value={offer.couponCode || ""}
                  onChange={(e) =>
                    setOffer((prev) => ({
                      ...prev,
                      couponCode: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="e.g. FLAT20"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase tracking-wider text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Quick Discount Presets */}
            <div className="pt-1">
              <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                Quick Discount Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                {presetDiscounts.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setOffer((prev) => ({ ...prev, discountPercent: pct }))}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      offer.discountPercent === pct
                        ? "bg-amber-600 border-amber-600 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {pct}% OFF
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Banner Photo Upload & CTA */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Banner Visual &amp; Action Button
            </h3>

            {/* Banner Image Upload */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Offer Banner Photo (Optional)
              </label>
              <div className="flex items-center gap-2">
                <label className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold cursor-pointer transition-colors flex items-center gap-2 shrink-0">
                  <i className={`fa-solid ${isUploadingBanner ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"} text-xs`} />
                  <span>{isUploadingBanner ? "Uploading..." : "Upload Photo"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleBannerUpload}
                    disabled={isUploadingBanner}
                  />
                </label>
                {offer.bannerUrl && (
                  <button
                    type="button"
                    onClick={() => setOffer((prev) => ({ ...prev, bannerUrl: null }))}
                    className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
              {uploadError && (
                <p className="text-[11px] text-rose-600 font-semibold">{uploadError}</p>
              )}

              <div className="pt-1">
                <input
                  type="text"
                  value={offer.bannerUrl || ""}
                  onChange={(e) => setOffer((prev) => ({ ...prev, bannerUrl: e.target.value }))}
                  placeholder="Or paste external image URL: https://..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Button Text */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-bold text-slate-700">
                Popup Button Text
              </label>
              <input
                type="text"
                value={offer.buttonText || ""}
                onChange={(e) => setOffer((prev) => ({ ...prev, buttonText: e.target.value }))}
                placeholder="e.g. Claim Offer & View Menu 🎉"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Live Phone Preview Column (5 cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="bg-slate-900 p-4 rounded-3xl shadow-xl border border-slate-800 flex flex-col items-center">
            {/* Header info */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 text-white text-xs">
              <span className="font-bold flex items-center gap-1.5">
                <i className="fa-solid fa-mobile-screen text-amber-400 text-sm" />
                <span>Guest Phone Live Preview</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {offer.active ? "POPUP LIVE" : "OFFER OFF"}
              </span>
            </div>

            {/* Phone Screen Mockup */}
            <div className="w-full max-w-[340px] mt-4 bg-stone-900 rounded-[2.5rem] p-3 border-4 border-slate-700 shadow-2xl relative">
              {/* Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-full z-20 flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-black rounded-full mr-2" />
                <div className="w-1.5 h-1.5 bg-slate-700 rounded-full" />
              </div>

              {/* Simulated Customer Screen */}
              <div className="w-full bg-stone-50 rounded-[2rem] overflow-hidden min-h-[520px] flex flex-col relative text-stone-900">
                {/* Simulated Customer Header */}
                <div className="bg-white border-b border-stone-200 px-4 pt-7 pb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      T1
                    </div>
                    <div>
                      <span className="font-bold text-xs block text-stone-900 truncate max-w-[120px]">
                        {restaurantName}
                      </span>
                      <span className="text-[10px] text-stone-500 block">Table 01</span>
                    </div>
                  </div>
                  <div className="px-2 py-1 rounded-md bg-stone-100 text-[10px] font-bold text-stone-700 border border-stone-200">
                    Call
                  </div>
                </div>

                {/* Simulated Announcement Banner */}
                {offer.active && offer.bannerText && (
                  <div className="bg-gradient-to-r from-amber-600 to-rose-600 text-white text-[10px] font-bold py-1 px-3 text-center truncate">
                    📢 {offer.bannerText}
                  </div>
                )}

                {/* Simulated Menu Content */}
                <div className="p-3 space-y-2.5 flex-1 opacity-40">
                  <div className="h-6 bg-stone-200 rounded-md w-24" />
                  <div className="p-2 bg-white rounded-xl border border-stone-200 flex gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-stone-200 rounded w-28" />
                      <div className="h-2.5 bg-stone-100 rounded w-16" />
                    </div>
                    <div className="w-12 h-12 bg-stone-200 rounded-lg" />
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-stone-200 flex gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-stone-200 rounded w-32" />
                      <div className="h-2.5 bg-stone-100 rounded w-20" />
                    </div>
                    <div className="w-12 h-12 bg-stone-200 rounded-lg" />
                  </div>
                </div>

                {/* Simulated POPUP OVERLAY */}
                {offer.active && offer.showOnTableScan && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] z-30 flex items-center justify-center p-3 animate-in fade-in">
                    <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full overflow-hidden flex flex-col relative">
                      {/* Close Mock Button */}
                      <div className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-black/40 text-white flex items-center justify-center text-[10px] font-bold">
                        ✕
                      </div>

                      {/* Banner Image or Gradient */}
                      {offer.bannerUrl ? (
                        <div className="w-full h-28 relative bg-stone-100 overflow-hidden">
                          <img
                            src={offer.bannerUrl}
                            alt="Banner"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          <div className="absolute bottom-2 left-3 right-3">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-stone-950 inline-flex items-center gap-1 shadow-xs">
                              ★ {offer.badge || "SPECIAL OFFER"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-24 bg-gradient-to-br from-amber-500 via-orange-600 to-rose-700 relative flex flex-col items-center justify-center text-white p-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-xs border border-white/30">
                            ★ {offer.badge || "SPECIAL OFFER"}
                          </span>
                          <span className="text-xl font-black mt-1 tracking-tight">
                            {offer.discountPercent}% OFF
                          </span>
                        </div>
                      )}

                      {/* Content Details */}
                      <div className="p-3 text-center space-y-2">
                        <h4 className="text-xs font-black text-stone-900 leading-tight">
                          {offer.headline || "Special Offer for You!"}
                        </h4>
                        <p className="text-[10px] text-stone-600 leading-relaxed line-clamp-2">
                          {offer.description ||
                            `Enjoy ${offer.discountPercent}% OFF on orders above ₹${offer.minOrderValue}.`}
                        </p>

                        {/* Coupon Pill */}
                        {offer.couponCode && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-dashed border-amber-300 text-amber-900">
                            <span className="text-[9px] text-amber-700">Code:</span>
                            <span className="text-[10px] font-mono font-black">{offer.couponCode}</span>
                          </div>
                        )}

                        {/* CTA Button */}
                        <div className="pt-1">
                          <button
                            type="button"
                            className="w-full py-2 px-3 rounded-xl bg-stone-900 text-white text-[11px] font-bold shadow-md flex items-center justify-center gap-1"
                          >
                            <span>{offer.buttonText || "Claim Offer 🎉"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-4 text-center">
              Real-time representation of what guests experience upon scanning table QR codes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
