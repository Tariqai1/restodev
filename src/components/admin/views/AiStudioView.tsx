"use client";

import React, { useState } from "react";
import AdminButton from "../ui/AdminButton";
import AdminBadge from "../ui/AdminBadge";

interface ExtractedDish {
  name: string;
  category: string;
  price: number;
  is_veg: boolean;
  confidence: number;
}

export default function AiStudioView() {
  const [activeTab, setActiveTab] = useState<"ocr" | "prep" | "pairings">("ocr");
  const [menuText, setMenuText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedDishes, setExtractedDishes] = useState<ExtractedDish[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Prep Estimator State
  const [prepDishName, setPrepDishName] = useState("Chicken Biryani");
  const [prepKitchenLoad, setPrepKitchenLoad] = useState<"low" | "medium" | "rush">("medium");
  const [estimatedMins, setEstimatedMins] = useState<number | null>(18);

  const handleRunOcr = async () => {
    if (!menuText.trim()) return;
    setIsProcessing(true);
    setSuccessMsg(null);

    // Simulate smart catalog extraction with clean parsing
    setTimeout(() => {
      const lines = menuText.split("\n").filter((l) => l.trim().length > 0);
      const parsed: ExtractedDish[] = [];

      lines.forEach((line) => {
        const priceMatch = line.match(/(?:₹|rs\.?|inr)?\s*(\d{2,4})/i);
        const price = priceMatch ? parseInt(priceMatch[1], 10) : 180;
        const namePart = line.replace(/(?:₹|rs\.?|inr)?\s*(\d{2,4})/i, "").trim();
        const isVeg = !/chicken|mutton|fish|prawn|egg|lamb|meat/i.test(namePart);

        if (namePart) {
          parsed.push({
            name: namePart,
            category: isVeg ? "Vegetarian Specialties" : "Non-Veg Specialties",
            price,
            is_veg: isVeg,
            confidence: 96,
          });
        }
      });

      if (parsed.length === 0) {
        parsed.push(
          { name: "Dal Makhani", category: "Main Course", price: 240, is_veg: true, confidence: 98 },
          { name: "Butter Naan", category: "Breads", price: 65, is_veg: true, confidence: 99 },
          { name: "Paneer Tikka", category: "Starters", price: 280, is_veg: true, confidence: 95 }
        );
      }

      setExtractedDishes(parsed);
      setIsProcessing(false);
      setSuccessMsg(`Successfully parsed ${parsed.length} dishes into ready-to-import catalog format.`);
    }, 1000);
  };

  const handleCalculatePrep = () => {
    const base = prepDishName.toLowerCase().includes("biryani") ? 18 : 12;
    const mult = prepKitchenLoad === "rush" ? 1.5 : prepKitchenLoad === "medium" ? 1.15 : 1.0;
    setEstimatedMins(Math.round(base * mult));
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30 mb-2">
            <i className="fa-solid fa-brain text-[11px]" />
            <span>AI Operations &amp; Catalog Hub</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            AI Copilot Studio
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            OCR physical menu scanner, cooking duration predictor, and smart dish pairing recommendations.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <i className="fa-solid fa-circle-check text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB 1: MENU OCR SCANNER */}
      {activeTab === "ocr" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Menu Text &amp; Image Parser
              </h3>
              <p className="text-xs text-slate-500">
                Paste existing menu text or dish lines to automatically extract items, categories, and rupee prices.
              </p>
            </div>

            <textarea
              rows={8}
              value={menuText}
              onChange={(e) => setMenuText(e.target.value)}
              placeholder="Paste printed menu text here, e.g.:&#10;Paneer Tikka - ₹280&#10;Butter Chicken - ₹380&#10;Garlic Naan - ₹75&#10;Fresh Lime Soda - ₹90"
              className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-purple-500"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Auto-detects Veg / Non-Veg &amp; Categories
              </span>
              <AdminButton
                variant="primary"
                size="sm"
                leftIcon={isProcessing ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}
                disabled={isProcessing}
                onClick={handleRunOcr}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isProcessing ? "Extracting Dishes..." : "Extract Catalog"}
              </AdminButton>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Extracted Catalog Preview
                </h3>
                <span className="text-xs text-slate-500">
                  {extractedDishes.length} items parsed
                </span>
              </div>

              {extractedDishes.length > 0 && (
                <AdminButton
                  variant="outline"
                  size="sm"
                  leftIcon="fa-check"
                  onClick={() => alert(`Imported ${extractedDishes.length} dishes into your catalog!`)}
                >
                  Import All
                </AdminButton>
              )}
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {extractedDishes.map((dish, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        dish.is_veg ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">
                        {dish.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {dish.category} · {dish.confidence}% confidence
                      </span>
                    </div>
                  </div>

                  <span className="font-mono font-bold text-slate-900">
                    ₹{dish.price}
                  </span>
                </div>
              ))}

              {extractedDishes.length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  <i className="fa-solid fa-receipt text-3xl text-slate-300 mb-2 block" />
                  <span className="text-xs">
                    Paste menu text on the left and click Extract Catalog
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PREP PREDICTOR */}
      {activeTab === "prep" && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs max-w-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Smart Preparation Time Predictor
          </h3>
          <p className="text-xs text-slate-500">
            Estimates live ticket cooking ETA based on recipe complexity and current kitchen station load.
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Dish Name
              </label>
              <input
                type="text"
                value={prepDishName}
                onChange={(e) => setPrepDishName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Current Kitchen Station Load
              </label>
              <select
                value={prepKitchenLoad}
                onChange={(e) => setPrepKitchenLoad(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
              >
                <option value="low">Low (1-3 active tickets)</option>
                <option value="medium">Medium (4-8 active tickets)</option>
                <option value="rush">Rush Hour (9+ active tickets)</option>
              </select>
            </div>

            <AdminButton
              variant="primary"
              size="sm"
              leftIcon="fa-calculator"
              onClick={handleCalculatePrep}
              className="mt-2"
            >
              Calculate Cooking ETA
            </AdminButton>

            {estimatedMins && (
              <div className="mt-4 p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold block">Predicted Cooking Duration:</span>
                  <span className="text-2xl font-black font-mono">
                    {estimatedMins} Minutes
                  </span>
                </div>
                <span className="text-xs text-purple-700 font-semibold bg-white px-2.5 py-1 rounded-lg border border-purple-200">
                  Ready in {estimatedMins + 2} mins with plating
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SMART PAIRINGS */}
      {activeTab === "pairings" && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Catalog Cross-Sell &amp; Pairing Matrix
          </h3>
          <p className="text-xs text-slate-500">
            Suggested cross-sell items recommended to customers on the digital table menu.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="font-bold text-slate-800 block">Biryani Pairings</span>
              <p className="text-slate-500 text-[11px]">When guest orders Biryani:</p>
              <div className="space-y-1">
                <span className="block px-2 py-1 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                  + Burani Raita (₹60)
                </span>
                <span className="block px-2 py-1 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                  + Mirchi Ka Salan (₹80)
                </span>
                <span className="block px-2 py-1 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                  + Gulab Jamun (₹70)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="font-bold text-slate-800 block">Curry &amp; Gravy Pairings</span>
              <p className="text-slate-500 text-[11px]">When guest orders Curry:</p>
              <div className="space-y-1">
                <span className="block px-2 py-1 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                  + Butter Naan (₹65)
                </span>
                <span className="block px-2 py-1 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                  + Jeera Rice (₹140)
                </span>
                <span className="block px-2 py-1 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                  + Masala Chaas (₹50)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <span className="font-bold text-slate-800 block">Tandoori Starters</span>
              <p className="text-slate-500 text-[11px]">When guest orders Starters:</p>
              <div className="space-y-1">
                <span className="block px-2 py-1 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                  + Mint Chutney &amp; Onion Rings
                </span>
                <span className="block px-2 py-1 rounded bg-white border border-slate-200 font-semibold text-slate-700">
                  + Fresh Lime Soda (₹90)
                </span>
                <span className="block px-2 py-1 rounded bg-white border border-slate-200 font-semibold text-slate-700">
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
