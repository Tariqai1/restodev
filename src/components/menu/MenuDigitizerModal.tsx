"use client";

import React, { useState } from "react";

interface MenuDigitizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  onImportComplete: () => void;
}

export default function MenuDigitizerModal({
  isOpen,
  onClose,
  restaurantId,
  onImportComplete,
}: MenuDigitizerModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractedCategories, setExtractedCategories] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setErrorMsg("");

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleScanMenu = async () => {
    if (!previewUrl) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/ai/menu-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: previewUrl,
        }),
      });

      const data = await res.json();
      if (data.ok && Array.isArray(data.categories)) {
        setExtractedCategories(data.categories);
      } else {
        setErrorMsg(data.error || "Could not read menu text from image. Please try a clearer, brighter photo.");
      }
    } catch (err) {
      setErrorMsg("Failed to connect to AI vision server.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportToDatabase = async () => {
    if (!restaurantId || extractedCategories.length === 0) return;
    setImporting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/ai/menu-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: previewUrl,
          saveToRestaurantId: restaurantId,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        onImportComplete();
        onClose();
      } else {
        setErrorMsg(data.error || "Failed to save menu items.");
      }
    } catch (err) {
      setErrorMsg("Failed to import menu.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <div className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-camera text-xl text-purple-600" />
            <div>
              <h2 className="font-heading font-bold text-sm text-stone-900">
                AI Menu Digitizer (Photo to Menu)
              </h2>
              <p className="text-[11px] text-stone-500">
                Powered by Smart Vision AI · Snap printed menu card to auto-create items
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-bold hover:bg-stone-300 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Step 1: Upload Photo */}
          {!previewUrl && (
            <div className="border-2 border-dashed border-stone-300 rounded-2xl p-8 text-center hover:border-amber-500 transition-colors bg-stone-50/50">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="menu-photo-upload"
              />
              <label
                htmlFor="menu-photo-upload"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <div className="w-14 h-14 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xl shadow-xs">
                  <i className="fa-solid fa-cloud-arrow-up" />
                </div>
                <span className="text-sm font-bold text-stone-800">
                  Upload or Take Photo of Menu Card
                </span>
                <span className="text-xs text-stone-500 max-w-sm">
                  Supports JPG, PNG photos of physical printed restaurant menus or flyers.
                </span>
                <span className="mt-2 inline-flex items-center px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs">
                  Choose Image
                </span>
              </label>
            </div>
          )}

          {/* Step 2: Image Preview & Scan Action */}
          {previewUrl && extractedCategories.length === 0 && (
            <div className="space-y-4">
              <div className="relative max-h-60 overflow-hidden rounded-xl border bg-black flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Menu Card"
                  className="max-h-60 object-contain w-auto mx-auto"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(null);
                    setSelectedFile(null);
                  }}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 text-white text-xs font-bold hover:bg-black"
                >
                  Change Photo
                </button>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleScanMenu}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>AI Vision analyzing dishes &amp; prices...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-wand-magic-sparkles text-xs" />
                    <span>Extract Dishes with AI Vision</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 3: Extracted Results Review */}
          {extractedCategories.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  ✓ Successfully extracted {extractedCategories.reduce((s, c) => s + (c.items?.length || 0), 0)} dishes in {extractedCategories.length} categories
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setExtractedCategories([]);
                    setPreviewUrl(null);
                  }}
                  className="text-xs text-stone-500 hover:underline"
                >
                  Scan another
                </button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {extractedCategories.map((cat, cIdx) => (
                  <div key={cIdx} className="rounded-xl border border-stone-200 p-3 bg-stone-50">
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">
                      📁 {cat.name} ({cat.items?.length || 0})
                    </h4>
                    <div className="space-y-1.5">
                      {cat.items?.map((it: any, iIdx: number) => (
                        <div
                          key={iIdx}
                          className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-stone-200"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span className={it.is_veg ? "veg-indicator" : "nonveg-indicator"} />
                            <span className="font-semibold text-stone-800 truncate">{it.name}</span>
                          </div>
                          <span className="font-mono font-bold text-stone-900">₹{it.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={importing}
                onClick={handleImportToDatabase}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Saving dishes to restaurant menu database...</span>
                  </>
                ) : (
                  <>
                    <span>📥</span>
                    <span>Import All Dishes into Restaurant Menu</span>
                  </>
                )}
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
