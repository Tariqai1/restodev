"use client";

import React, { useState } from "react";
import { MenuItem, PortionType } from "./TableTypes";
import { triggerHaptic } from "./tableUtils";

interface TableAiWaiterModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  restaurantName: string;
  onAddToCart: (dishId: string, portion: PortionType) => void;
}

const QUICK_PROMPTS = [
  "Kuch spicy veg batao under ₹200",
  "Best starters for family",
  "Popular mains with Garlic Naan",
  "Light meal under ₹300",
];

export default function TableAiWaiterModal({
  isOpen,
  onClose,
  menuItems,
  restaurantName,
  onAddToCart,
}: TableAiWaiterModalProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState<string>("");
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleAsk = async (textToAsk: string) => {
    const q = textToAsk.trim();
    if (!q) return;
    triggerHaptic(10);
    setLoading(true);
    setResponseMsg("");
    setRecommendedIds([]);

    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: q,
          menuItems,
          restaurantName,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResponseMsg(data.message);
        setRecommendedIds(data.recommendedDishIds || []);
      } else {
        setResponseMsg(data.error || "Maaf kijiye, abhi recommend nahi kar pa rahe.");
      }
    } catch (err: any) {
      setResponseMsg("Connection error. Kripya dobara try karein.");
    } finally {
      setLoading(false);
    }
  };

  const recommendedDishes = menuItems.filter((it) => recommendedIds.includes(it.id));

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-lg mx-auto rounded-t-3xl border-t shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300"
        style={{
          backgroundColor: "var(--paper)",
          borderColor: "var(--hairline)",
          color: "var(--ink)",
        }}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: "var(--hairline)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg bg-gradient-to-tr from-amber-500 to-yellow-400 text-stone-950 shadow-sm font-bold">
              🤖
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight" style={{ color: "var(--ink)" }}>
                AI Waiter &amp; Recommendation
              </h2>
              <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>
                Powered by NVIDIA Llama 3.3 · Ask anything about menu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold hover:bg-stone-200 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Quick Prompts */}
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400 font-bold block mb-2">
              Popular Questions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(p);
                    handleAsk(p);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border text-xs font-medium bg-white hover:bg-amber-50 hover:border-amber-300 transition-colors cursor-pointer text-left"
                  style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}
                >
                  💬 {p}
                </button>
              ))}
            </div>
          </div>

          {/* AI Response Box */}
          {loading && (
            <div className="p-4 rounded-xl border border-dashed flex items-center gap-3 text-xs bg-amber-50/50" style={{ borderColor: "var(--hairline)" }}>
              <div className="w-4 h-4 rounded-full border-2 border-amber-600 border-t-transparent animate-spin shrink-0" />
              <span className="text-stone-700 font-medium">Chef &amp; AI Waiter menu dekh rahe hain...</span>
            </div>
          )}

          {responseMsg && !loading && (
            <div className="p-3.5 rounded-xl border bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50 space-y-3" style={{ borderColor: "var(--hairline)" }}>
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0">✨</span>
                <p className="text-xs leading-relaxed text-stone-800 font-medium">{responseMsg}</p>
              </div>

              {/* Recommended Dish Cards */}
              {recommendedDishes.length > 0 && (
                <div className="pt-2 border-t space-y-2" style={{ borderColor: "var(--hairline)" }}>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block">
                    Recommended Dishes (1-Tap Add):
                  </span>
                  <div className="space-y-1.5">
                    {recommendedDishes.map((dish) => (
                      <div
                        key={dish.id}
                        className="p-2.5 rounded-xl border bg-white flex items-center justify-between shadow-2xs"
                        style={{ borderColor: "var(--hairline)" }}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className={dish.is_veg ? "veg-indicator shrink-0" : "nonveg-indicator shrink-0"} />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-stone-900 block truncate">{dish.name}</span>
                            <span className="text-[11px] font-bold text-stone-600">₹{dish.price}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(12);
                            onAddToCart(dish.id, "full");
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-600 transition-colors shadow-xs active:scale-95 cursor-pointer shrink-0"
                        >
                          + ADD
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t bg-stone-50 shrink-0" style={{ borderColor: "var(--hairline)" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(query);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 2 logon ke liye best thali ya starters..."
              className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              style={{ borderColor: "var(--hairline)" }}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40 transition-all cursor-pointer shrink-0"
            >
              Ask
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
