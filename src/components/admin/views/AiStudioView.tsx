"use client";

import React, { useState, useRef } from "react";
import AdminButton from "../ui/AdminButton";
import AdminBadge from "../ui/AdminBadge";

interface ExtractedItem {
  id: string;
  name: string;
  price: number;
  is_veg: boolean;
  description?: string;
}

interface ExtractedCategory {
  id: string;
  name: string;
  items: ExtractedItem[];
}

interface AiStudioViewProps {
  restaurantId?: string;
  onGoToMenu?: () => void;
  onDataUpdated?: () => void;
}

const SAMPLE_MENU_TEXT = `[STARTERS]
Paneer Tikka - ₹280
Crisp Corn Pepper Salt - ₹220
Chicken Malai Tikka - ₹340
Fish Amritsari - ₹380

[MAIN COURSE]
Dal Makhani - ₹240
Paneer Butter Masala - ₹290
Butter Chicken - ₹380
Mutton Rogan Josh - ₹440

[BREADS & RICE]
Tandoori Roti - ₹30
Butter Naan - ₹65
Garlic Naan - ₹85
Jeera Rice - ₹160
Chicken Dum Biryani - ₹360

[BEVERAGES & DESSERTS]
Fresh Lime Soda - ₹90
Masala Chaas - ₹60
Gulab Jamun (2 Pcs) - ₹90`;

export default function AiStudioView({
  restaurantId,
  onGoToMenu,
  onDataUpdated,
}: AiStudioViewProps) {
  const [activeTab, setActiveTab] = useState<"ocr" | "prep" | "pairings">("ocr");

  // OCR Scanner States
  const [ocrInputMode, setOcrInputMode] = useState<"image" | "text">("image");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [menuText, setMenuText] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStepText, setScanStepText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [extractedCategories, setExtractedCategories] = useState<ExtractedCategory[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{ items: number; categories: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Prep Estimator State
  const [prepDishName, setPrepDishName] = useState("Chicken Biryani");
  const [prepKitchenLoad, setPrepKitchenLoad] = useState<"low" | "medium" | "rush">("medium");
  const [estimatedMins, setEstimatedMins] = useState<number | null>(18);
  const [prepReason, setPrepReason] = useState<string | null>(
    "Slow-cooked dum basmati rice and marinated meat require ~16 mins; +2 mins buffer for queue."
  );
  const [isCalculatingPrep, setIsCalculatingPrep] = useState(false);

  // Pairings State
  const [customPairingQuery, setCustomPairingQuery] = useState("");
  const [customPairings, setCustomPairings] = useState<string[]>([]);

  // 1. Client-side canvas image compression to ensure camera photos upload in milliseconds without 413 errors
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMsg(null);
    setSuccessMsg(null);
    setImportStats(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1280;
        let w = img.width;
        let h = img.height;

        if (w > h && w > MAX_DIM) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else if (h > MAX_DIM) {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          // Crisp 0.85 JPEG is typically only 150-250KB
          setPreviewUrl(canvas.toDataURL("image/jpeg", 0.85));
        } else {
          setPreviewUrl(ev.target?.result as string);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 2. Scan Menu Action (Calls /api/ai/menu-ocr)
  const handleScanMenu = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setImportStats(null);

    if (ocrInputMode === "image" && !previewUrl) {
      setErrorMsg("Please upload or take a photo of a menu card first.");
      return;
    }

    if (ocrInputMode === "text" && !menuText.trim()) {
      setErrorMsg("Please enter or paste menu text to extract.");
      return;
    }

    setIsScanning(true);
    setScanStepText(
      ocrInputMode === "image"
        ? "AI Vision analyzing physical menu layout..."
        : "Extracting dishes, prices, and categories..."
    );

    try {
      const payload: any = { action: "parse" };
      if (ocrInputMode === "image") {
        payload.imageBase64 = previewUrl;
      } else {
        payload.menuText = menuText;
      }

      const res = await fetch("/api/ai/menu-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.ok && Array.isArray(data.categories) && data.categories.length > 0) {
        // Map to state with unique IDs for editing
        const mappedCategories: ExtractedCategory[] = data.categories.map((c: any, cIdx: number) => ({
          id: `cat_${cIdx}_${Date.now()}`,
          name: c.name || "Specialties",
          items: Array.isArray(c.items)
            ? c.items.map((it: any, iIdx: number) => ({
                id: `item_${cIdx}_${iIdx}_${Date.now()}`,
                name: String(it.name || "Dish").trim(),
                price: Number(it.price) || 120,
                is_veg: Boolean(it.is_veg),
                description: it.description || "",
              }))
            : [],
        }));

        setExtractedCategories(mappedCategories);
        const totalItems = mappedCategories.reduce((acc, cat) => acc + cat.items.length, 0);
        setSuccessMsg(`Extracted ${totalItems} dishes across ${mappedCategories.length} categories.`);
      } else {
        setErrorMsg(
          data.error ||
            "Could not read items clearly. Please ensure the menu photo is sharp and well-lit, or use the 'Paste Text' tab."
        );
      }
    } catch (err: any) {
      setErrorMsg("Failed to connect to AI vision server. Please check your internet connection.");
    } finally {
      setIsScanning(false);
      setScanStepText("");
    }
  };

  // 3. Edit extracted item handlers
  const handleUpdateItem = (catId: string, itemId: string, field: keyof ExtractedItem, val: any) => {
    setExtractedCategories((prev) =>
      prev.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          items: c.items.map((it) => (it.id === itemId ? { ...it, [field]: val } : it)),
        };
      })
    );
  };

  const handleDeleteItem = (catId: string, itemId: string) => {
    setExtractedCategories((prev) =>
      prev
        .map((c) => {
          if (c.id !== catId) return c;
          return {
            ...c,
            items: c.items.filter((it) => it.id !== itemId),
          };
        })
        .filter((c) => c.items.length > 0)
    );
  };

  const handleUpdateCategoryName = (catId: string, newName: string) => {
    setExtractedCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, name: newName } : c))
    );
  };

  const handleAddNewItem = (catId: string) => {
    setExtractedCategories((prev) =>
      prev.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          items: [
            ...c.items,
            {
              id: `item_${Date.now()}`,
              name: "New Dish",
              price: 150,
              is_veg: true,
              description: "",
            },
          ],
        };
      })
    );
  };

  // 4. Save Extracted Catalog to Supabase Database
  const handleImportAllToDatabase = async () => {
    if (extractedCategories.length === 0) return;

    setIsImporting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/ai/menu-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import",
          categories: extractedCategories,
          saveToRestaurantId: restaurantId,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        const counts = data.insertedCounts || {
          items: extractedCategories.reduce((s, c) => s + c.items.length, 0),
          categories: extractedCategories.length,
        };
        setImportStats(counts);
        setSuccessMsg(
          `🎉 Successfully imported ${counts.items} dishes into your restaurant menu!`
        );
        onDataUpdated?.();
      } else {
        setErrorMsg(data.error || "Failed to save dishes to menu database.");
      }
    } catch (err: any) {
      setErrorMsg("Failed to communicate with menu database.");
    } finally {
      setIsImporting(false);
    }
  };

  // Prep calculation
  const handleCalculatePrep = async () => {
    setIsCalculatingPrep(true);
    try {
      const res = await fetch("/api/ai/prep-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderItems: [{ name: prepDishName, qty: 1 }],
          activeKitchenOrdersCount: prepKitchenLoad === "rush" ? 8 : prepKitchenLoad === "medium" ? 4 : 1,
        }),
      });
      const data = await res.json();
      if (data.ok && typeof data.estimatedMinutes === "number") {
        setEstimatedMins(data.estimatedMinutes);
        setPrepReason(data.reason || "");
      } else {
        // Fallback calculation
        const base = prepDishName.toLowerCase().includes("biryani") ? 18 : 12;
        const mult = prepKitchenLoad === "rush" ? 1.5 : prepKitchenLoad === "medium" ? 1.15 : 1.0;
        setEstimatedMins(Math.round(base * mult));
        setPrepReason("Heuristic estimate based on preparation complexity and kitchen ticket load.");
      }
    } catch {
      const base = prepDishName.toLowerCase().includes("biryani") ? 18 : 12;
      const mult = prepKitchenLoad === "rush" ? 1.5 : prepKitchenLoad === "medium" ? 1.15 : 1.0;
      setEstimatedMins(Math.round(base * mult));
    } finally {
      setIsCalculatingPrep(false);
    }
  };

  // Total item count in preview
  const totalPreviewItems = extractedCategories.reduce((acc, c) => acc + c.items.length, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30 mb-2">
            <i className="fa-solid fa-brain text-[11px]" />
            <span>AI Operations &amp; Catalog Hub</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">AI Copilot Studio</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            OCR physical menu scanner, cooking duration predictor, and smart dish pairing recommendations.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("ocr")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "ocr"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <i className="fa-solid fa-camera" />
            <span>Menu OCR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("prep")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "prep"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <i className="fa-solid fa-stopwatch" />
            <span>Prep Predictor</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pairings")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "pairings"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <i className="fa-solid fa-utensils" />
            <span>Smart Pairings</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-circle-check text-emerald-600 text-base" />
            <span className="font-bold">{successMsg}</span>
          </div>
          {onGoToMenu && importStats && (
            <button
              type="button"
              onClick={onGoToMenu}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>View in Menu Catalog</span>
              <i className="fa-solid fa-arrow-right text-[10px]" />
            </button>
          )}
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-800 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: MENU OCR SCANNER & DIGITIZER */}
      {/* ========================================================= */}
      {activeTab === "ocr" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Input Mode (Photo / Text) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              {/* Input Mode Selector */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Input Method
                </span>
                <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setOcrInputMode("image");
                      setErrorMsg(null);
                    }}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      ocrInputMode === "image"
                        ? "bg-white text-purple-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <i className="fa-solid fa-camera text-[10px]" />
                    <span>Photo / Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOcrInputMode("text");
                      setErrorMsg(null);
                    }}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      ocrInputMode === "text"
                        ? "bg-white text-purple-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <i className="fa-solid fa-font text-[10px]" />
                    <span>Paste Text</span>
                  </button>
                </div>
              </div>

              {/* MODE 1: PHYSICAL PHOTO SCANNER */}
              {ocrInputMode === "image" && (
                <div className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="admin-menu-scanner-input"
                  />

                  {!previewUrl ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-purple-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-purple-50/20 transition-all flex flex-col items-center justify-center space-y-2.5"
                    >
                      <div className="w-14 h-14 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xl shadow-xs">
                        <i className="fa-solid fa-cloud-arrow-up" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">
                        Upload or Snap Menu Photo
                      </span>
                      <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                        Take a photo of physical printed menus, leaflets, or flyers. Supports JPG, PNG, WEBP.
                      </p>
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        <i className="fa-solid fa-camera text-[11px]" />
                        <span>Choose Photo / Camera</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-950 flex items-center justify-center max-h-72">
                        <img
                          src={previewUrl}
                          alt="Menu Preview"
                          className="max-h-72 object-contain w-auto mx-auto"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewUrl(null);
                            setSelectedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black text-white text-xs font-bold backdrop-blur-xs flex items-center gap-1 cursor-pointer"
                        >
                          <i className="fa-solid fa-rotate text-[10px]" />
                          <span>Change Photo</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                        <span className="truncate max-w-[200px]">
                          {selectedFile ? selectedFile.name : "Menu Photo"}
                        </span>
                        <span>Auto-compressed for Vision AI</span>
                      </div>
                    </div>
                  )}

                  <AdminButton
                    variant="primary"
                    size="md"
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    leftIcon={isScanning ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}
                    disabled={!previewUrl || isScanning}
                    onClick={handleScanMenu}
                  >
                    {isScanning ? scanStepText || "Scanning Menu..." : "Extract Dishes with AI Vision"}
                  </AdminButton>
                </div>
              )}

              {/* MODE 2: PASTE PRINTED TEXT */}
              {ocrInputMode === "text" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Menu Dish Lines &amp; Prices
                    </label>
                    <button
                      type="button"
                      onClick={() => setMenuText(SAMPLE_MENU_TEXT)}
                      className="text-[11px] text-purple-600 hover:text-purple-800 font-bold cursor-pointer"
                    >
                      Load Sample Menu
                    </button>
                  </div>

                  <textarea
                    rows={10}
                    value={menuText}
                    onChange={(e) => setMenuText(e.target.value)}
                    placeholder={`[STARTERS]\nPaneer Tikka - ₹280\nChicken Malai Tikka - ₹340\n\n[MAIN COURSE]\nDal Makhani - ₹240\nButter Naan - ₹65`}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-purple-500 leading-relaxed"
                  />

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Auto-detects Veg / Non-Veg &amp; INR prices</span>
                    <span>{menuText.split("\n").filter((l) => l.trim()).length} lines</span>
                  </div>

                  <AdminButton
                    variant="primary"
                    size="md"
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    leftIcon={isScanning ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}
                    disabled={!menuText.trim() || isScanning}
                    onClick={handleScanMenu}
                  >
                    {isScanning ? "Extracting Catalog..." : "Extract Catalog from Text"}
                  </AdminButton>
                </div>
              )}
            </div>

            {/* Instruction Callout */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-xs space-y-1.5 text-slate-600">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <i className="fa-solid fa-lightbulb text-amber-500" />
                Tips for Best Scanning Accuracy:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500">
                <li>Capture the menu under good lighting with minimal glare.</li>
                <li>Make sure dish titles and rupee prices are sharp &amp; readable.</li>
                <li>You can review, edit prices, or change veg tags before importing.</li>
              </ul>
            </div>
          </div>

          {/* RIGHT COLUMN: Extracted Catalog Preview & Live Database Import */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col min-h-[500px]">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Digitized Catalog Preview</span>
                    {totalPreviewItems > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">
                        {totalPreviewItems} items
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review and fine-tune items, prices, and categories before saving to your live menu.
                  </p>
                </div>

                {extractedCategories.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setExtractedCategories([]);
                        setSuccessMsg(null);
                        setImportStats(null);
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                    <AdminButton
                      variant="success"
                      size="sm"
                      leftIcon={isImporting ? "fa-spinner fa-spin" : "fa-cloud-arrow-up"}
                      disabled={isImporting || totalPreviewItems === 0}
                      onClick={handleImportAllToDatabase}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {isImporting ? "Importing to Menu..." : `Import ${totalPreviewItems} Dishes`}
                    </AdminButton>
                  </div>
                )}
              </div>

              {/* Preview Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 max-h-[560px]">
                {extractedCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40"
                  >
                    {/* Category Title Header */}
                    <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <i className="fa-solid fa-folder-open text-purple-600 text-xs" />
                        <input
                          type="text"
                          value={cat.name}
                          onChange={(e) => handleUpdateCategoryName(cat.id, e.target.value)}
                          className="font-bold text-xs text-slate-800 bg-transparent border-b border-transparent hover:border-slate-400 focus:border-purple-600 focus:bg-white focus:px-1 rounded outline-none max-w-xs"
                          title="Click to rename category"
                        />
                        <span className="text-[10px] text-slate-400 font-medium">
                          ({cat.items.length} items)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddNewItem(cat.id)}
                        className="text-[11px] text-purple-600 hover:text-purple-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <i className="fa-solid fa-plus text-[9px]" />
                        <span>Add Dish</span>
                      </button>
                    </div>

                    {/* Dish Items Table/List */}
                    <div className="divide-y divide-slate-100">
                      {cat.items.map((it) => (
                        <div
                          key={it.id}
                          className="px-4 py-2.5 bg-white flex items-center justify-between gap-3 text-xs hover:bg-slate-50/80 transition-colors"
                        >
                          {/* Veg Toggle & Name */}
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {/* Veg / Non-Veg Indicator */}
                            <button
                              type="button"
                              onClick={() => handleUpdateItem(cat.id, it.id, "is_veg", !it.is_veg)}
                              title={it.is_veg ? "Vegetarian (click to switch)" : "Non-Veg (click to switch)"}
                              className={`w-3.5 h-3.5 rounded-xs border shrink-0 flex items-center justify-center cursor-pointer transition-transform active:scale-90 ${
                                it.is_veg
                                  ? "border-emerald-600 bg-emerald-50"
                                  : "border-rose-600 bg-rose-50"
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  it.is_veg ? "bg-emerald-600" : "bg-rose-600"
                                }`}
                              />
                            </button>

                            <input
                              type="text"
                              value={it.name}
                              onChange={(e) => handleUpdateItem(cat.id, it.id, "name", e.target.value)}
                              className="font-semibold text-slate-800 border border-transparent hover:border-slate-300 focus:border-purple-500 focus:bg-white rounded px-1.5 py-0.5 outline-none flex-1 truncate"
                            />
                          </div>

                          {/* Price Input & Delete Button */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-0.5 border border-slate-200">
                              <span className="font-mono text-slate-500 font-bold text-xs">₹</span>
                              <input
                                type="number"
                                min={0}
                                value={it.price}
                                onChange={(e) =>
                                  handleUpdateItem(cat.id, it.id, "price", Number(e.target.value) || 0)
                                }
                                className="w-16 font-mono font-bold text-slate-900 bg-transparent text-right outline-none text-xs"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(cat.id, it.id)}
                              className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <i className="fa-solid fa-trash text-[11px]" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Empty State */}
                {extractedCategories.length === 0 && !isScanning && (
                  <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mb-1">
                      <i className="fa-solid fa-receipt" />
                    </div>
                    <span className="text-sm font-bold text-slate-700">No dishes extracted yet</span>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Upload a printed menu photo or paste text on the left, then click &ldquo;Extract Dishes&rdquo;.
                    </p>
                  </div>
                )}

                {/* Scanning Loading State */}
                {isScanning && (
                  <div className="py-20 text-center flex flex-col items-center justify-center space-y-4">
                    <div className="w-14 h-14 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin flex items-center justify-center" />
                    <div className="space-y-1">
                      <span className="text-sm font-bold text-slate-800 block">
                        {scanStepText || "Digitizing menu with AI Vision..."}
                      </span>
                      <p className="text-xs text-slate-500">
                        Analyzing food titles, categorizing dishes, and reading rupee prices...
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Commit Bar */}
              {extractedCategories.length > 0 && (
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Ready to write to Supabase <code className="font-mono">menu_items</code> &amp;{" "}
                    <code className="font-mono">menu_categories</code>.
                  </span>
                  <AdminButton
                    variant="success"
                    size="md"
                    leftIcon={isImporting ? "fa-spinner fa-spin" : "fa-check"}
                    disabled={isImporting}
                    onClick={handleImportAllToDatabase}
                    className="bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                  >
                    {isImporting ? "Saving..." : "Commit All to Menu Catalog"}
                  </AdminButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PREP PREDICTOR */}
      {/* ========================================================= */}
      {activeTab === "prep" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-2xl space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-stopwatch text-purple-600" />
              <span>Smart Preparation Time Predictor</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live AI kitchen ETA computation based on dish cooking complexity and pending station orders.
            </p>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Dish Name / Order Spec
              </label>
              <input
                type="text"
                value={prepDishName}
                onChange={(e) => setPrepDishName(e.target.value)}
                placeholder="e.g. Chicken Dum Biryani, Garlic Naan, Paneer Tikka"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Current Kitchen Station Load
              </label>
              <select
                value={prepKitchenLoad}
                onChange={(e) => setPrepKitchenLoad(e.target.value as any)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white text-xs font-semibold focus:outline-none focus:border-purple-600"
              >
                <option value="low">Low (1-3 active kitchen tickets)</option>
                <option value="medium">Medium (4-8 active tickets)</option>
                <option value="rush">Rush Hour (9+ active kitchen tickets)</option>
              </select>
            </div>

            <AdminButton
              variant="primary"
              size="md"
              leftIcon={isCalculatingPrep ? "fa-spinner fa-spin" : "fa-calculator"}
              onClick={handleCalculatePrep}
              disabled={isCalculatingPrep || !prepDishName.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isCalculatingPrep ? "Consulting AI Chef..." : "Calculate Cooking ETA"}
            </AdminButton>

            {estimatedMins !== null && (
              <div className="mt-4 p-4 rounded-xl bg-purple-50/80 border border-purple-200 text-purple-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-purple-700 block uppercase tracking-wider">
                      Predicted Cooking Duration
                    </span>
                    <span className="text-3xl font-black font-mono text-purple-950">
                      {estimatedMins} Minutes
                    </span>
                  </div>
                  <span className="text-xs text-purple-800 font-bold bg-white px-3 py-1.5 rounded-lg border border-purple-200 shadow-2xs">
                    Plating ready at {estimatedMins + 2}m
                  </span>
                </div>

                {prepReason && (
                  <p className="text-xs text-purple-800/90 leading-relaxed border-t border-purple-200/60 pt-2">
                    <span className="font-bold">Chef Explanation: </span>
                    {prepReason}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: SMART PAIRINGS & CROSS-SELL MATRIX */}
      {/* ========================================================= */}
      {activeTab === "pairings" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-utensils text-purple-600" />
              <span>Catalog Cross-Sell &amp; Pairing Matrix</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated high-margin dish recommendations displayed to guests on digital table menus.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Biryani Pairings</span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  +₹210 Avg Lift
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">When customer adds Biryani:</p>
              <div className="space-y-1.5">
                <span className="block px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 text-xs">
                  + Burani Garlic Raita (₹60)
                </span>
                <span className="block px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 text-xs">
                  + Mirchi Ka Salan (₹80)
                </span>
                <span className="block px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 text-xs">
                  + Royal Gulab Jamun (₹70)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Curry &amp; Gravy Pairings</span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  +₹185 Avg Lift
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">When customer adds Curry:</p>
              <div className="space-y-1.5">
                <span className="block px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 text-xs">
                  + Butter Naan (₹65)
                </span>
                <span className="block px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 text-xs">
                  + Jeera Rice (₹140)
                </span>
                <span className="block px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 text-xs">
                  + Masala Chaas (₹50)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Tandoori Starters</span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  +₹150 Avg Lift
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">When customer adds Starters:</p>
              <div className="space-y-1.5">
                <span className="block px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 text-xs">
                  + Mint Chutney &amp; Lachha Onion
                </span>
                <span className="block px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 text-xs">
                  + Fresh Lime Soda (₹90)
                </span>
                <span className="block px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 text-xs">
                  + Virgin Mojito (₹130)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
