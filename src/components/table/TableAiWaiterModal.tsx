"use client";

import React, { useState, useEffect, useRef } from "react";
import { MenuItem, PortionType, CartMap } from "./TableTypes";
import { triggerHaptic, getFoodEmoji } from "./tableUtils";

interface TableAiWaiterModalProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  restaurantName: string;
  cart?: CartMap;
  onAddToCart: (dishId: string, portion: PortionType) => void;
  onRemoveFromCart?: (dishId: string, portion: PortionType) => void;
}

interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  dishes?: MenuItem[];
  pairingTip?: string | null;
  quickSuggestions?: string[];
  time: string;
}

function formatCurrentTime(): string {
  const d = new Date();
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function TableAiWaiterModal({
  isOpen,
  onClose,
  menuItems,
  restaurantName,
  cart,
  onAddToCart,
  onRemoveFromCart,
}: TableAiWaiterModalProps) {
  const initialAiMessage: ChatMessage = {
    id: "msg_welcome",
    sender: "ai",
    text: `Welcome to ${restaurantName || "our restaurant"}! 👋\nMain aapka Smart AI Food Assistant hoon. Aaj kya khane ka mood hai? Mujhe apna taste, budget ya group size bataiye!`,
    quickSuggestions: [
      "⭐ Top Bestsellers",
      "🌶️ Spicy starters",
      "👨‍👩‍👧 Family dinner combo",
      "🥗 Light meal < ₹250",
      "🍨 Desserts & Coolers",
    ],
    time: formatCurrentTime(),
  };

  const [messages, setMessages] = useState<ChatMessage[]>([initialAiMessage]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [localQtyMap, setLocalQtyMap] = useState<Record<string, number>>({});

  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const searchAnimationSteps = [
    "Checking fresh kitchen menu...",
    "Matching chef specialties & spices...",
    "Selecting delicious recommendations...",
  ];

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    }
  }, [messages, loading, isOpen]);

  // Loading animation step cycle
  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % searchAnimationSteps.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [loading]);

  if (!isOpen) return null;

  // Real-time cart quantity for a dish
  const getDishQty = (dishId: string): number => {
    if (cart) {
      const fullQty = cart[`${dishId}__full`]?.qty || 0;
      const halfQty = cart[`${dishId}__half`]?.qty || 0;
      const directQty = cart[dishId]?.qty || 0;
      return fullQty + halfQty + directQty;
    }
    return localQtyMap[dishId] || 0;
  };

  const handleAddDish = (dish: MenuItem) => {
    triggerHaptic(14);
    onAddToCart(dish.id, "full");
    setLocalQtyMap((prev) => ({
      ...prev,
      [dish.id]: (prev[dish.id] || 0) + 1,
    }));
  };

  const handleRemoveDish = (dish: MenuItem) => {
    triggerHaptic(8);
    onRemoveFromCart?.(dish.id, "full");
    setLocalQtyMap((prev) => {
      const current = prev[dish.id] || 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[dish.id];
        return copy;
      }
      return { ...prev, [dish.id]: current - 1 };
    });
  };

  const handleSend = async (queryToSend: string) => {
    const q = queryToSend.trim();
    if (!q || loading) return;

    triggerHaptic(10);
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: "user",
      text: q,
      time: formatCurrentTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: q,
          menuItems,
          restaurantName,
          chatHistory: messages.slice(-5).map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      const data = await res.json();
      let matchedDishes: MenuItem[] = [];

      if (data.ok && Array.isArray(data.recommendedDishIds)) {
        matchedDishes = menuItems.filter((m) =>
          data.recommendedDishIds.includes(m.id)
        );
      }

      // Contextual follow-up quick reply suggestions from AI or smart defaults
      const followUps =
        Array.isArray(data.followUpSuggestions) && data.followUpSuggestions.length > 0
          ? data.followUpSuggestions
          : [
              "Inke saath best roti ya rice? 🫓",
              "Kuch meetha bhi dikhao 🍨",
              "Thode aur options dikhaiye 🍲",
            ];

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: "ai",
        text:
          data.message ||
          "Aapke taste aur mood ke hisaab se humne ye behtareen dishes chuni hain:",
        dishes: matchedDishes.length > 0 ? matchedDishes : undefined,
        pairingTip: data.pairingTip || null,
        quickSuggestions: followUps,
        time: formatCurrentTime(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        sender: "ai",
        text: "Thoda network issue lag raha hai. Aap dobara poochh sakte hain ya niche diye options select kar sakte hain.",
        quickSuggestions: [
          "⭐ Top Bestsellers",
          "🌶️ Spicy starters",
          "🍛 Popular Main Course",
        ],
        time: formatCurrentTime(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestartChat = () => {
    triggerHaptic(12);
    setMessages([
      {
        ...initialAiMessage,
        id: `msg_welcome_${Date.now()}`,
        time: formatCurrentTime(),
      },
    ]);
  };

  return (
    <>
      {/* Dark backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-up Bottom Sheet Modal */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-lg mx-auto rounded-t-3xl border-t shadow-2xl flex flex-col h-[85vh] max-h-[750px] animate-in slide-in-from-bottom duration-300 overflow-hidden"
        style={{
          backgroundColor: "var(--paper)",
          borderColor: "var(--hairline)",
          color: "var(--ink)",
        }}
      >
        {/* Grab bar */}
        <div className="pt-2 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-stone-300" />
        </div>

        {/* Chat Header */}
        <div
          className="px-4 py-2.5 border-b flex items-center justify-between shrink-0 bg-white/70 backdrop-blur-md"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-linear-to-br from-amber-400 via-orange-400 to-amber-500 text-stone-950 font-bold shadow-xs shrink-0">
              <i className="fa-solid fa-wand-magic-sparkles text-sm text-stone-950 animate-ai-sparkle" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-xs font-bold leading-tight truncate flex items-center gap-1.5"
                style={{ color: "var(--ink)" }}
              >
                <span>AI Waiter &amp; Recommendation</span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold tracking-wider uppercase">
                  Online
                </span>
              </h2>
              <p className="text-[10px] truncate text-stone-500">
                Live Food Concierge · {restaurantName || "Our Restaurant"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleRestartChat}
              className="px-2 py-1 rounded-lg text-[10px] font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors flex items-center gap-1 cursor-pointer"
              title="Restart conversation"
            >
              <i className="fa-solid fa-rotate-right text-[10px]" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-600 transition-colors cursor-pointer"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Chat Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-stone-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === "user" ? "items-end" : "items-start"
              } space-y-1.5 animate-in fade-in duration-200`}
            >
              {/* Sender label and time */}
              <div className="flex items-center gap-1.5 px-1 text-[10px] text-stone-400">
                {msg.sender === "ai" ? (
                  <span className="font-bold text-amber-800 flex items-center gap-1">
                    <span>👨‍🍳</span> AI Captain
                  </span>
                ) : (
                  <span className="font-semibold text-stone-600">You</span>
                )}
                <span>•</span>
                <span>{msg.time}</span>
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-2xs ${
                  msg.sender === "user"
                    ? "bg-stone-900 text-white rounded-tr-xs"
                    : "bg-white text-stone-800 border border-stone-200/80 rounded-tl-xs"
                }`}
              >
                <p className="whitespace-pre-line font-medium">{msg.text}</p>

                {/* Chef's Pairing Tip */}
                {msg.pairingTip && (
                  <div className="mt-2.5 px-3 py-2 rounded-xl bg-amber-50/90 border border-amber-200/90 text-[11px] text-amber-950 font-medium flex items-start gap-2 shadow-2xs">
                    <span className="text-amber-600 text-xs shrink-0 mt-0.5">💡</span>
                    <div className="leading-snug">
                      <span className="font-extrabold text-amber-900 block text-[9px] uppercase tracking-wider mb-0.5">
                        Chef's Pairing Tip
                      </span>
                      {msg.pairingTip}
                    </div>
                  </div>
                )}

                {/* Attached Interactive Dish Cards */}
                {msg.dishes && msg.dishes.length > 0 && (
                  <div className="mt-3 space-y-2 pt-2 border-t border-stone-100">
                    <p className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                      <span>✨</span> Recommended Dishes ({msg.dishes.length}):
                    </p>
                    {msg.dishes.map((dish) => {
                      const qty = getDishQty(dish.id);
                      const foodEmoji = getFoodEmoji(dish.name, dish.is_veg);
                      return (
                        <div
                          key={dish.id}
                          className="p-2.5 rounded-xl border border-stone-200/90 bg-stone-50/70 hover:bg-stone-50 transition-colors flex items-center justify-between gap-2.5 shadow-2xs"
                        >
                          {/* Dish info */}
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            {/* Veg / Non-veg dot */}
                            {dish.is_veg ? (
                              <span
                                className="w-3.5 h-3.5 mt-0.5 rounded-xs border-[1.5px] border-emerald-600 bg-white flex items-center justify-center shrink-0 shadow-2xs"
                                title="Vegetarian"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              </span>
                            ) : (
                              <span
                                className="w-3.5 h-3.5 mt-0.5 rounded-xs border-[1.5px] border-rose-600 bg-white flex items-center justify-center shrink-0 shadow-2xs"
                                title="Non-Vegetarian"
                              >
                                <span className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[6px] border-b-rose-600" />
                              </span>
                            )}

                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-stone-900 truncate">
                                {dish.name}
                              </h4>
                              <p className="text-[10px] text-stone-500 line-clamp-1 mt-0.5">
                                {dish.description || `${dish.is_veg ? "Veg" : "Non-Veg"} chef preparation`}
                              </p>
                              <div className="text-xs font-extrabold text-stone-900 mt-0.5">
                                ₹{dish.price}
                              </div>
                            </div>
                          </div>

                          {/* Dish photo & Add Stepper */}
                          <div className="flex items-center gap-2 shrink-0">
                            {dish.photo_url ? (
                              <img
                                src={dish.photo_url}
                                alt={dish.name}
                                className="w-10 h-10 rounded-lg object-cover border border-stone-200"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-amber-100/70 border border-amber-200/50 flex items-center justify-center text-lg">
                                {foodEmoji}
                              </div>
                            )}

                            {qty === 0 ? (
                              <button
                                type="button"
                                onClick={() => handleAddDish(dish)}
                                className="h-7 px-3 rounded-lg text-[11px] font-extrabold uppercase tracking-wider border-2 border-emerald-600 text-emerald-700 bg-white hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                              >
                                <span>ADD</span>
                                <span className="text-sm font-bold leading-none">+</span>
                              </button>
                            ) : (
                              <div className="h-7 flex items-center rounded-lg border-2 border-emerald-600 bg-emerald-600 text-white shadow-2xs overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDish(dish)}
                                  className="w-6 h-full flex items-center justify-center font-bold text-sm hover:bg-emerald-700 cursor-pointer transition-colors"
                                >
                                  −
                                </button>
                                <span className="text-[11px] font-black px-1 min-w-[16px] text-center">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAddDish(dish)}
                                  className="w-6 h-full flex items-center justify-center font-bold text-sm hover:bg-emerald-700 cursor-pointer transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick suggestion follow-up pills */}
              {msg.quickSuggestions && msg.quickSuggestions.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1 pl-1 max-w-[95%]">
                  {msg.quickSuggestions.map((sug, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      disabled={loading}
                      onClick={() => handleSend(sug)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-amber-300/80 bg-amber-50/90 hover:bg-amber-100 text-amber-950 transition-all active:scale-95 cursor-pointer shadow-2xs flex items-center gap-1 text-left"
                    >
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* AI Typing Indicator */}
          {loading && (
            <div className="flex flex-col items-start space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 px-1 text-[10px] text-amber-800 font-bold">
                <span>👨‍🍳</span>
                <span>AI Captain is thinking...</span>
              </div>
              <div className="rounded-2xl rounded-tl-xs px-4 py-3 bg-white border border-stone-200 shadow-2xs flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" />
                </div>
                <span className="text-xs font-medium text-stone-600 italic">
                  {searchAnimationSteps[loadingStep]}
                </span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} className="h-2" />
        </div>

        {/* Input Bar (Sticky at Bottom) */}
        <div
          className="p-3 border-t bg-white shrink-0 space-y-2"
          style={{ borderColor: "var(--hairline)" }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputText);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                disabled={loading}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask craving or budget (e.g. Biryani for 2)..."
                className="w-full pl-3.5 pr-8 py-2.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all bg-stone-50"
              />
              {inputText && (
                <button
                  type="button"
                  onClick={() => setInputText("")}
                  className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs transition-all active:scale-95 shrink-0 cursor-pointer ${
                inputText.trim() && !loading
                  ? "bg-linear-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-amber-200"
                  : "bg-stone-100 text-stone-400 cursor-not-allowed"
              }`}
              title="Send message"
            >
              <i className="fa-solid fa-arrow-up" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
