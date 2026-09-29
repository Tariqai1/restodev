"use client";

import React, { useState, useEffect, useRef } from "react";
import { MenuItem, PortionType } from "./TableTypes";
import { triggerHaptic } from "./tableUtils";

interface TableAiWaiterModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  restaurantName: string;
  onAddToCart: (dishId: string, portion: PortionType) => void;
}

interface QuickPrompt {
  id: string;
  icon: string;
  label: string;
  query: string;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { id: "spicy_veg", icon: "🌶️", label: "Spicy veg <₹200", query: "Kuch spicy veg batao under ₹200" },
  { id: "family_starters", icon: "👨‍👩‍👧", label: "Family starters", query: "Best starters for family" },
  { id: "naan_mains", icon: "🫓", label: "Mains with Naan", query: "Popular mains with Garlic Naan" },
  { id: "light_meal", icon: "🥗", label: "Light meal <₹300", query: "Light meal under ₹300" },
  { id: "chef_top", icon: "⭐", label: "Chef specials", query: "Restaurant ke top bestsellers aur chef specials batao" },
  { id: "sweet_drinks", icon: "🍨", label: "Desserts & coolers", query: "Best desserts aur cool beverages recommend karo" },
];

const SEARCH_ANIMATION_STEPS = [
  "Scanning fresh kitchen menu...",
  "Matching flavours & budget...",
  "Plating chef's best picks...",
];

export default function TableAiWaiterModal({
  isOpen,
  onClose,
  menuItems,
  restaurantName,
  onAddToCart,
}: TableAiWaiterModalProps) {
  const [query, setQuery] = useState("");
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [responseMsg, setResponseMsg] = useState<string>("");
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});

  const inputRef = useRef<HTMLInputElement | null>(null);
  const contentBottomRef = useRef<HTMLDivElement | null>(null);

  // Cycle loading step messages during search
  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % SEARCH_ANIMATION_STEPS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [loading]);

  // Auto-scroll to bottom of conversation when response arrives
  useEffect(() => {
    if (responseMsg || loading) {
      setTimeout(() => {
        contentBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [responseMsg, loading]);

  if (!isOpen) return null;

  const handleAsk = async (textToAsk: string) => {
    const q = textToAsk.trim();
    if (!q) return;

    triggerHaptic(10);
    setActiveQuestion(q);
    setQuery("");
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
        setResponseMsg(data.message || "Yeh rahi hamari best recommendations:");
        setRecommendedIds(Array.isArray(data.recommendedDishIds) ? data.recommendedDishIds : []);
      } else {
        setResponseMsg(
          data.message ||
            "Maaf kijiye, abhi recommend nahi kar pa rahe. Kripya niche diye options mein se dekhein."
        );
      }
    } catch {
      setResponseMsg("Network thoda slow hai. Kripya thodi der baad dobara poochhein.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDish = (dish: MenuItem) => {
    triggerHaptic(12);
    onAddToCart(dish.id, "full");
    setAddedIds((prev) => ({ ...prev, [dish.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [dish.id]: false }));
    }, 2500);
  };

  const recommendedDishes = menuItems.filter((it) => recommendedIds.includes(it.id));

  return (
    <>
      {/* Dark backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-up Bottom Sheet Modal */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-lg mx-auto rounded-t-3xl border-t shadow-2xl flex flex-col max-h-[88vh] animate-in slide-in-from-bottom duration-300 overflow-hidden"
        style={{
          backgroundColor: "var(--paper)",
          borderColor: "var(--hairline)",
          color: "var(--ink)",
        }}
      >
        {/* Grab bar for smooth sheet feeling */}
        <div className="pt-2 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-stone-300" />
        </div>

        {/* Compact Header */}
        <div
          className="px-4 py-2.5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs shadow-xs font-bold shrink-0 relative overflow-hidden"
              style={{
                backgroundColor: "var(--brand-primary)",
                color: "var(--rust-text)",
              }}
            >
              <i className="fa-solid fa-wand-magic-sparkles text-amber-950" />
              {/* Subtle shimmer ring */}
              <span className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-xs font-bold leading-tight truncate flex items-center gap-1.5"
                style={{ color: "var(--ink)" }}
              >
                <span>AI Waiter &amp; Recommendation</span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[9px] font-extrabold tracking-wider uppercase">
                  Live
                </span>
              </h2>
              <p className="text-[10px] truncate" style={{ color: "var(--ink-soft)" }}>
                Smart Menu Concierge · {restaurantName || "Our Restaurant"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-600 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>

        {/* Scrollable Main Conversation Area */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 min-h-[160px]">
          {/* STATE 1: Initial Empty / Welcome Greeting (Minimal & Clean) */}
          {!activeQuestion && !loading && !responseMsg && (
            <div className="py-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 mx-auto flex items-center justify-center text-xl shadow-2xs">
                <span>👨‍🍳</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-stone-800">
                  Namaste! Aaj kya khane ka mood hai?
                </h3>
                <p className="text-[11px] text-stone-500 max-w-xs mx-auto leading-relaxed">
                  Budget, spice level, family ya cravings bataiye — hamara AI Captain best dishes dhoondh dega.
                </p>
              </div>
            </div>
          )}

          {/* STATE 2: Active User Query Bubble */}
          {activeQuestion && (
            <div className="flex justify-end">
              <div
                className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-tr-xs text-xs font-medium text-white shadow-xs leading-relaxed"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <div className="flex items-center gap-1.5">
                  <span>{activeQuestion}</span>
                </div>
              </div>
            </div>
          )}

          {/* STATE 3: DELIGHTFUL SEARCH ANIMATION */}
          {loading && (
            <div className="space-y-3 animate-in fade-in duration-300">
              {/* Animated Chef Thinking Card */}
              <div
                className="p-3.5 rounded-2xl border bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-amber-50/90 shadow-2xs space-y-2.5 relative overflow-hidden"
                style={{ borderColor: "var(--hairline)" }}
              >
                {/* Shimmer light sweep animation */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]" />

                <div className="flex items-center gap-2.5 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm shadow-xs animate-pulse shrink-0">
                    <i className="fa-solid fa-utensils text-xs" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-amber-950">AI Waiter Thinking</span>
                      {/* 3 Animated Bouncing Dots */}
                      <span className="inline-flex items-center gap-1 ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-bounce" />
                      </span>
                    </div>
                    {/* Rotating Status Step */}
                    <p className="text-[11px] font-medium text-amber-800/90 mt-0.5 truncate animate-in fade-in">
                      {SEARCH_ANIMATION_STEPS[loadingStep]}
                    </p>
                  </div>
                </div>

                {/* Progress bar wave */}
                <div className="w-full bg-amber-200/50 h-1 rounded-full overflow-hidden">
                  <div className="bg-amber-600 h-full rounded-full w-2/3 animate-[pulse_1s_infinite]" />
                </div>
              </div>

              {/* Pulsing Dish Card Placeholders */}
              <div className="space-y-2 opacity-60">
                <div className="p-3 rounded-xl border border-stone-200 bg-white flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 rounded-xs bg-stone-300" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 bg-stone-300 rounded-sm w-36" />
                      <div className="h-2 bg-stone-200 rounded-sm w-16" />
                    </div>
                  </div>
                  <div className="w-14 h-7 bg-stone-200 rounded-lg" />
                </div>

                <div className="p-3 rounded-xl border border-stone-200 bg-white flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 rounded-xs bg-stone-300" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 bg-stone-300 rounded-sm w-44" />
                      <div className="h-2 bg-stone-200 rounded-sm w-20" />
                    </div>
                  </div>
                  <div className="w-14 h-7 bg-stone-200 rounded-lg" />
                </div>
              </div>
            </div>
          )}

          {/* STATE 4: AI RESPONSE & RECOMMENDED DISHES */}
          {responseMsg && !loading && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* AI Recommendation Message Bubble */}
              <div
                className="p-3 rounded-2xl rounded-tl-xs border bg-gradient-to-br from-amber-50/60 via-white to-orange-50/40 space-y-1.5 shadow-2xs"
                style={{ borderColor: "var(--hairline)" }}
              >
                <div className="flex items-center gap-1.5 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                  <i className="fa-solid fa-sparkles text-[9px]" />
                  <span>Chef Recommendation</span>
                </div>
                <p className="text-xs leading-relaxed text-stone-800 font-medium">
                  {responseMsg}
                </p>
              </div>

              {/* Recommended Dish Cards (1-Tap Add) */}
              {recommendedDishes.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      Dishes For You ({recommendedDishes.length}):
                    </span>
                    <span className="text-[10px] text-amber-700 font-semibold">
                      1-Tap Add to Table
                    </span>
                  </div>

                  <div className="space-y-2">
                    {recommendedDishes.map((dish) => {
                      const isAdded = Boolean(addedIds[dish.id]);
                      return (
                        <div
                          key={dish.id}
                          className="p-2.5 rounded-xl border bg-white flex items-center justify-between gap-2.5 shadow-2xs hover:shadow-xs transition-all"
                          style={{ borderColor: "var(--hairline)" }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Veg / Non-Veg Indicator */}
                            <span
                              className={`w-3.5 h-3.5 rounded-xs border shrink-0 flex items-center justify-center ${
                                dish.is_veg
                                  ? "border-emerald-600 bg-emerald-50"
                                  : "border-rose-600 bg-rose-50"
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  dish.is_veg ? "bg-emerald-600" : "bg-rose-600"
                                }`}
                              />
                            </span>

                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-stone-900 block truncate">
                                {dish.name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-mono font-bold text-stone-800">
                                  ₹{dish.price}
                                </span>
                                {dish.description && (
                                  <span className="text-[10px] text-stone-400 truncate max-w-[130px]">
                                    {dish.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 1-Tap Add Button with Feedback */}
                          <button
                            type="button"
                            onClick={() => handleAddDish(dish)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 shadow-2xs flex items-center gap-1 ${
                              isAdded
                                ? "bg-emerald-600 text-white font-bold"
                                : "bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold"
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <i className="fa-solid fa-check text-[10px]" />
                                <span>Added</span>
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-plus text-[10px]" />
                                <span>ADD</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={contentBottomRef} />
        </div>

        {/* COMPACT 1-LINE HORIZONTAL SUGGESTION PILLS (Takes only ~34px height) */}
        <div
          className="px-3 py-1.5 border-t bg-stone-50/70 shrink-0"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 shrink-0 mr-0.5">
              Quick:
            </span>
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleAsk(p.query)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white hover:bg-amber-50 border border-stone-200 hover:border-amber-300 text-stone-700 hover:text-amber-900 transition-colors shrink-0 shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <span className="text-xs">{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div
          className="p-3 border-t bg-white shrink-0"
          style={{ borderColor: "var(--hairline)" }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(query);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="2 logon ke liye best thali ya starters..."
                className="w-full pl-8 pr-8 py-2.5 text-xs rounded-xl border bg-stone-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                style={{ borderColor: "var(--hairline)", color: "var(--ink)" }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                >
                  <i className="fa-solid fa-circle-xmark" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Searching</span>
                </>
              ) : (
                <>
                  <span>Ask</span>
                  <i className="fa-solid fa-arrow-up text-[10px]" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
