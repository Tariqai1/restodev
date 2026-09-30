"use client";

import React, { useState, useEffect } from "react";
import AdminButton from "../ui/AdminButton";

interface StoreSettingsViewProps {
  initialName?: string;
}

const THEME_OPTIONS = [
  {
    id: "amber" as const,
    name: "Amber Warm (Default)",
    desc: "Warm Gold, Spice & Earthy Brown",
    primary: "#b45309",
    surface: "#fffbeb",
    border: "#fde68a",
  },
  {
    id: "crimson" as const,
    name: "Crimson Velvet",
    desc: "Deep Ruby & Fine Dine Burgundy",
    primary: "#be123c",
    surface: "#fff1f2",
    border: "#fecdd3",
  },
  {
    id: "saffron" as const,
    name: "Saffron Royal",
    desc: "Vibrant Indian Orange & Rust",
    primary: "#c2410c",
    surface: "#fff7ed",
    border: "#ffedd5",
  },
  {
    id: "emerald" as const,
    name: "Emerald Bistro",
    desc: "Fresh Botanical Green & Mint",
    primary: "#047857",
    surface: "#ecfdf5",
    border: "#a7f3d0",
  },
  {
    id: "charcoal" as const,
    name: "Charcoal Dark",
    desc: "Modern Midnight Slate & Gold",
    primary: "#1e293b",
    surface: "#f8fafc",
    border: "#e2e8f0",
  },
];

export default function StoreSettingsView({
  initialName = "Order Desk Restaurant",
}: StoreSettingsViewProps) {
  const [storeName, setStoreName] = useState(initialName);
  const [phone, setPhone] = useState("+91 98765 43210");
  const [address, setAddress] = useState("Shop 12-14, Food Street, Indiranagar, Bengaluru, KA 560038");
  const [gstin, setGstin] = useState("29ABCDE1234F1Z5");
  const [fssai, setFssai] = useState("11223344556677");
  const [serviceCharge, setServiceCharge] = useState(false);
  const [serviceChargePct, setServiceChargePct] = useState(5);

  // Branding & Theme States
  const [selectedTheme, setSelectedTheme] = useState<"amber" | "crimson" | "saffron" | "emerald" | "charcoal">("amber");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [tagline, setTagline] = useState<string>("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Menu Display & AI Features
  const [showDishDescription, setShowDishDescription] = useState(false);
  const [aiSuggestionsLayout, setAiSuggestionsLayout] = useState<"carousel" | "drawer">("carousel");

  // Online Ordering (Delivery / Pickup) States
  const [onlineOrderingEnabled, setOnlineOrderingEnabled] = useState(false);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(5);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(0);
  const [estimatedPrepMinutes, setEstimatedPrepMinutes] = useState(25);
  const [slug, setSlug] = useState("");
  const [restaurantId, setRestaurantId] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load all settings: delivery, theme, branding, and features
  useEffect(() => {
    async function loadAllSettings() {
      try {
        const [delRes, themeRes, featRes] = await Promise.all([
          fetch("/api/restaurant/delivery"),
          fetch("/api/restaurant/theme"),
          fetch("/api/restaurant/features"),
        ]);

        if (delRes.ok) {
          const data = await delRes.json();
          if (data.settings) {
            setOnlineOrderingEnabled(Boolean(data.settings.onlineOrderingEnabled));
            setPickupEnabled(Boolean(data.settings.pickupEnabled));
            setDeliveryEnabled(Boolean(data.settings.deliveryEnabled));
            setDeliveryRadiusKm(Number(data.settings.deliveryRadiusKm) || 5);
            setDeliveryFee(Number(data.settings.deliveryFee) || 0);
            setMinimumOrderAmount(Number(data.settings.minimumOrderAmount) || 0);
            setEstimatedPrepMinutes(Number(data.settings.estimatedPrepMinutes) || 25);
            setSlug(data.settings.slug || data.restaurant?.slug || "");
          }
          if (data.restaurant) {
            setRestaurantId(data.restaurant.id || "");
            if (data.restaurant.name) setStoreName(data.restaurant.name);
          }
        }

        if (themeRes.ok) {
          const tData = await themeRes.json();
          if (tData.theme) setSelectedTheme(tData.theme);
          if (tData.branding) {
            if (tData.branding.logoUrl) setLogoUrl(tData.branding.logoUrl);
            if (tData.branding.tagline) setTagline(tData.branding.tagline);
          }
        }

        if (featRes.ok) {
          const fData = await featRes.json();
          if (fData.features) {
            setShowDishDescription(Boolean(fData.features.showDishDescription));
            if (fData.features.aiSuggestionsLayout) {
              setAiSuggestionsLayout(fData.features.aiSuggestionsLayout);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load store settings:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadAllSettings();
  }, []);

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to upload logo");
      if (data.url) {
        setLogoUrl(data.url);
      }
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        fetch("/api/restaurant/delivery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            onlineOrderingEnabled,
            pickupEnabled,
            deliveryEnabled,
            deliveryRadiusKm,
            deliveryFee,
            minimumOrderAmount,
            estimatedPrepMinutes,
            slug,
          }),
        }),
        fetch("/api/restaurant/theme", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme: selectedTheme,
            branding: {
              logoUrl: logoUrl.trim() || null,
              tagline: tagline.trim() || null,
            },
          }),
        }),
        fetch("/api/restaurant/features", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showDishDescription,
            aiSuggestionsLayout,
          }),
        }),
      ]);

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3500);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const getOnlineOrderUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://orderdesk.app";
    const cleanIdentifier = slug.trim() || restaurantId || "store";
    return `${origin}/r/${cleanIdentifier}`;
  };

  const handleCopyLink = () => {
    const url = getOnlineOrderUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 mb-2">
            <i className="fa-solid fa-gears text-[11px]" />
            <span>Store Configuration &amp; Legal Profile</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Administration &amp; Store Profile
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure restaurant identity, header logo, customer theme, dish descriptions, and AI features.
          </p>
        </div>

        <AdminButton
          variant="primary"
          size="sm"
          leftIcon="fa-floppy-disk"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving Settings..." : "Save Store Settings"}
        </AdminButton>
      </div>

      {isSaved && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600" />
          <span>All store settings, branding, header logo, theme, and AI preferences saved successfully!</span>
        </div>
      )}

      {/* 1. RESTAURANT LOGO & HEADER BRANDING */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-image text-amber-600 text-xs" />
              <span>Customer Header Logo &amp; Brand Identity</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload your restaurant logo to show in the customer header instead of the table number badge.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Logo Upload & URL Box */}
          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Upload Logo Image (PNG / JPG / WebP)
              </label>
              <div className="flex items-center gap-2">
                <label className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer transition-colors flex items-center gap-2 shrink-0">
                  <i className={`fa-solid ${isUploadingLogo ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"} text-xs`} />
                  <span>{isUploadingLogo ? "Uploading..." : "Upload Logo"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoFileUpload}
                    disabled={isUploadingLogo}
                  />
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold transition-colors cursor-pointer"
                  >
                    Remove Logo
                  </button>
                )}
              </div>
              {uploadError && (
                <p className="text-[11px] text-rose-600 mt-1 font-semibold">{uploadError}</p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Or Paste Direct Logo Image URL
              </label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Brand Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Authentic North Indian & Mughlai Delicacies"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 text-xs"
              />
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Customer Header Live Preview:
            </span>
            <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={storeName}
                    className="w-9 h-9 rounded-lg object-cover shadow-2xs border border-slate-200 shrink-0"
                    onError={() => setLogoUrl("")}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                    T01
                  </div>
                )}
                <div className="min-w-0">
                  <span className="font-bold text-sm text-slate-900 block leading-tight truncate">
                    {storeName || "Tauheed Resto"}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate">
                    Table T01 {tagline ? `· ${tagline}` : ""}
                  </span>
                </div>
              </div>

              <div className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-700 flex items-center gap-1 shrink-0">
                <i className="fa-solid fa-bell text-[9px]" />
                <span>Call</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THEME COLOR PALETTE CUSTOMIZER */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-palette text-purple-600 text-xs" />
            <span>Customer Menu Theme &amp; Atmosphere</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select the brand color theme for table diners and mobile menus.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {THEME_OPTIONS.map((thm) => {
            const isSelected = selectedTheme === thm.id;
            return (
              <div
                key={thm.id}
                onClick={() => setSelectedTheme(thm.id)}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? "border-purple-600 bg-purple-50/40 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full border border-black/10 shadow-2xs inline-block"
                      style={{ backgroundColor: thm.primary }}
                    />
                    <span className="font-bold text-xs text-slate-900">{thm.name}</span>
                  </div>
                  {isSelected && (
                    <i className="fa-solid fa-circle-check text-purple-600 text-sm" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{thm.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. MENU DISPLAY & DISH DESCRIPTION CONTROL */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-align-left text-blue-600 text-xs" />
            <span>Menu Layout &amp; Dish Description Display</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Control the visual density and compact browsing experience for diners.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="font-bold text-xs text-slate-900 block">
              Show Dish Descriptions on Customer Menu
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
              By default, dish descriptions are <strong>hidden</strong> to keep cards ultra-sleek and prevent vertical scrolling clutter. Enable to show ingredient &amp; preparation descriptions.
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={showDishDescription}
              onChange={(e) => setShowDishDescription(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
            <span className="ml-2.5 text-xs font-bold text-slate-800 min-w-[55px]">
              {showDishDescription ? "Showing" : "Hidden"}
            </span>
          </label>
        </div>
      </div>

      {/* 4. AI ASSISTANT SUGGESTIONS LAYOUT (OPTION 1 vs OPTION 2) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-wand-magic-sparkles text-amber-600 text-xs" />
            <span>AI Food Assistant Suggestions Layout</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Choose how recommendation chips and party size options are presented in the customer chatbot.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Option 1 */}
          <div
            onClick={() => setAiSuggestionsLayout("carousel")}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              aiSuggestionsLayout === "carousel"
                ? "border-purple-600 bg-purple-50/40 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <i className="fa-solid fa-arrows-left-right text-amber-600 text-[11px]" />
                <span>Option 1: Horizontal Carousel (Default)</span>
              </span>
              {aiSuggestionsLayout === "carousel" && (
                <i className="fa-solid fa-circle-check text-purple-600 text-sm" />
              )}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Single-row horizontal scrollable strip with <strong>Auto-Hide</strong>. Conserves 70% vertical screen space on mobile phones, chips vanish once user interacts.
            </p>
          </div>

          {/* Option 2 */}
          <div
            onClick={() => setAiSuggestionsLayout("drawer")}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              aiSuggestionsLayout === "drawer"
                ? "border-purple-600 bg-purple-50/40 shadow-xs"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <i className="fa-solid fa-layer-group text-purple-600 text-[11px]" />
                <span>Option 2: Collapsible Action Drawer</span>
              </span>
              {aiSuggestionsLayout === "drawer" && (
                <i className="fa-solid fa-circle-check text-purple-600 text-sm" />
              )}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Floating micro-pills <code>[Quick Ideas]</code> &amp; <code>[Party Size]</code> above chat bar. Tapping opens an organized bottom drawer for a 100% clean chat stream.
            </p>
          </div>
        </div>
      </div>

      {/* 5. ONLINE ORDERING (DELIVERY & PICKUP) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-200 mb-1.5">
              <i className="fa-solid fa-motorcycle text-[10px]" />
              <span>Multi-Channel Ordering</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Online Ordering (Delivery &amp; Pickup)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Enable your own direct online ordering web store without table QR codes. Share link on WhatsApp, Instagram Bio &amp; Google Maps.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={onlineOrderingEnabled}
              onChange={(e) => setOnlineOrderingEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
            <span className="ml-3 text-xs font-bold text-slate-800">
              {onlineOrderingEnabled ? "Active" : "Disabled"}
            </span>
          </label>
        </div>

        {/* Detailed Controls when Online Ordering is Active */}
        {onlineOrderingEnabled ? (
          <div className="space-y-4 pt-1 animate-in fade-in duration-200">
            {/* Generic Shareable Link Box */}
            <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 block">
                  Your Direct Customer Storefront Link
                </span>
                <div className="text-xs font-mono font-bold text-purple-950 mt-1 truncate">
                  {getOnlineOrderUrl()}
                </div>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  Customers can browse your menu and order for Delivery or Pickup directly.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <i className={`fa-solid ${copiedLink ? "fa-check text-emerald-600" : "fa-copy"}`} />
                  <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                </button>

                <a
                  href={getOnlineOrderUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                  <span>Open Store</span>
                </a>
              </div>
            </div>

            {/* Restaurant URL Slug */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custom Storefront Slug / URL Handle
              </label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-300 rounded-l-xl text-xs text-slate-500 font-mono">
                  orderdesk.app/r/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. biryani-blues"
                  className="w-full px-3 py-2 border border-slate-300 rounded-r-xl focus:outline-none focus:border-purple-500 text-xs font-mono font-bold"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Letters, numbers, and dashes only. Leave blank to use your default restaurant ID.
              </span>
            </div>

            {/* Service Type Switches (Pickup & Delivery Independent) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Pickup Toggle */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <i className="fa-solid fa-bag-shopping text-blue-600 text-xs" />
                    <span className="font-bold text-slate-800 text-xs">Self Pickup / Takeaway</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Customers collect order from counter
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={pickupEnabled}
                  onChange={(e) => setPickupEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>

              {/* Delivery Toggle */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <i className="fa-solid fa-motorcycle text-amber-600 text-xs" />
                    <span className="font-bold text-slate-800 text-xs">Direct Home Delivery</span>
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Dispatched to customer address
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={deliveryEnabled}
                  onChange={(e) => setDeliveryEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Delivery Parameters (Radius, Fee, Minimum, Prep Time) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Delivery Radius (km)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={deliveryRadiusKm}
                  onChange={(e) => setDeliveryRadiusKm(Number(e.target.value) || 5)}
                  disabled={!deliveryEnabled}
                  className={`w-full px-3 py-2 border rounded-xl font-mono ${
                    deliveryEnabled
                      ? "border-slate-300 focus:outline-none focus:border-purple-500"
                      : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Maximum delivery distance</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Delivery Fee (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(Number(e.target.value) || 0)}
                  disabled={!deliveryEnabled}
                  className={`w-full px-3 py-2 border rounded-xl font-mono ${
                    deliveryEnabled
                      ? "border-slate-300 focus:outline-none focus:border-purple-500"
                      : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Set 0 for free delivery</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Minimum Order (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={minimumOrderAmount}
                  onChange={(e) => setMinimumOrderAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Cart threshold for checkout</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Estimated Prep Time
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={estimatedPrepMinutes}
                    onChange={(e) => setEstimatedPrepMinutes(Number(e.target.value) || 25)}
                    className="w-full px-3 py-2 border border-r-0 border-slate-300 rounded-l-xl focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <span className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-r-xl text-xs text-slate-600 font-semibold">
                    mins
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Shown as "~{estimatedPrepMinutes}m ready"</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500 flex items-center gap-3">
            <i className="fa-solid fa-circle-info text-slate-400 text-sm" />
            <span>
              Online ordering is currently off for this restaurant. Customers can only order by scanning the QR code at their physical dining table. Turn toggle ON above to enable pickup and home delivery.
            </span>
          </div>
        )}
      </div>

      {/* 6. STORE CONTACT & ADDRESS */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
          Restaurant Identity &amp; Contact
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Restaurant Brand Name *
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-semibold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Store Support Phone *
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Physical Outlet Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* 7. STATUTORY & TAX IDS */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
          Statutory Compliance &amp; Tax Credentials
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              GSTIN (Goods &amp; Services Tax Identification #)
            </label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono font-bold"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Printed on thermal tax invoices &amp; GSTR-3B filings
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              FSSAI Food Safety License Number
            </label>
            <input
              type="text"
              value={fssai}
              onChange={(e) => setFssai(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-mono font-bold"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Required on customer bills under FSSAI Act
            </span>
          </div>
        </div>
      </div>

      {/* 8. OPERATIONAL FEATURES */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
          Dine-In Billing &amp; Service Charge
        </h3>

        <div className="space-y-3 text-xs">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 block">
                Discretionary Service Charge
              </span>
              <span className="text-[11px] text-slate-500">
                Optional gratuity levy added to food bills
              </span>
            </div>
            <div className="flex items-center gap-3">
              {serviceCharge && (
                <div className="flex items-center gap-1 font-mono font-bold">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={serviceChargePct}
                    onChange={(e) => setServiceChargePct(Number(e.target.value) || 5)}
                    className="w-14 px-2 py-1 border border-slate-300 rounded-lg text-center"
                  />
                  <span>%</span>
                </div>
              )}
              <input
                type="checkbox"
                checked={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
