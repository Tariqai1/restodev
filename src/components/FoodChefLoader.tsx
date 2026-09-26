"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type FoodChefLoaderProps = {
  message?: string;
  subMessage?: string;
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light" | "luxury";
  restaurantName?: string;
  tableNumber?: string;
};

const CHEF_QUOTES = [
  "Simmering authentic spices...",
  "Chef is plating your fresh menu...",
  "Heating up the tandoor...",
  "Sizzling the ingredients...",
  "Setting up your digital dining desk...",
  "Almost ready to serve...",
];

const DELICACIES = [
  { emoji: "🍲", name: "Handi Biryani" },
  { emoji: "🥘", name: "Paneer Makhani" },
  { emoji: "🍢", name: "Tandoori Tikka" },
  { emoji: "🫓", name: "Butter Naan" },
  { emoji: "🥟", name: "Steamed Momos" },
  { emoji: "🍹", name: "Signature Cooler" },
  { emoji: "🍨", name: "Royal Kesar Kulfi" },
];

export default function FoodChefLoader({
  message,
  subMessage,
  size = "md",
  variant = "dark",
  restaurantName,
  tableNumber,
}: FoodChefLoaderProps) {
  const [foodIndex, setFoodIndex] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const foodTimer = setInterval(() => {
      setFoodIndex((prev) => (prev + 1) % DELICACIES.length);
    }, 1600);

    const quoteTimer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % CHEF_QUOTES.length);
    }, 2400);

    return () => {
      clearInterval(foodTimer);
      clearInterval(quoteTimer);
    };
  }, []);

  const currentFood = DELICACIES[foodIndex];
  const currentQuote = message || CHEF_QUOTES[quoteIndex];
  const isLight = variant === "light";

  const diameterClass =
    size === "sm" ? "w-20 h-20" : size === "lg" ? "w-32 h-32 sm:w-36 sm:h-36" : "w-24 h-24 sm:w-28 sm:h-28";

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center select-none max-w-sm mx-auto">
      {/* 1. Elegant Restaurant & Table Badge */}
      {(restaurantName || tableNumber) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border shadow-2xs text-[11px] font-bold mb-6 tracking-wide ${
            isLight
              ? "bg-amber-100/70 text-amber-950 border-amber-300/80"
              : "bg-stone-800/90 text-amber-300 border-amber-500/30"
          }`}
        >
          {restaurantName && <span>✨ {restaurantName}</span>}
          {restaurantName && tableNumber && <span className="opacity-30">•</span>}
          {tableNumber && <span className="font-mono">Table {tableNumber}</span>}
        </motion.div>
      )}

      {/* 2. Center Culinary Platter Stage with Delicate Rising Steam */}
      <div className="relative flex flex-col items-center justify-center mb-5">
        {/* Delicate Rising Steam Vector Curves */}
        <div className="h-6 w-14 mb-1 flex items-center justify-center overflow-visible pointer-events-none">
          <svg
            className={`w-10 h-6 ${isLight ? "text-amber-500/70" : "text-amber-400/80"}`}
            viewBox="0 0 36 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <motion.path
              d="M 10 22 Q 6 14 11 8 Q 15 3 10 1"
              animate={{
                pathLength: [0.3, 1, 0.3],
                opacity: [0.1, 0.85, 0.1],
                y: [2, -6, 2],
              }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut", delay: 0 }}
            />
            <motion.path
              d="M 18 22 Q 22 14 17 8 Q 13 3 18 1"
              animate={{
                pathLength: [0.3, 1, 0.3],
                opacity: [0.1, 0.95, 0.1],
                y: [2, -7, 2],
              }}
              transition={{ repeat: Infinity, duration: 2.1, ease: "easeInOut", delay: 0.35 }}
            />
            <motion.path
              d="M 26 22 Q 22 14 27 8 Q 31 3 26 1"
              animate={{
                pathLength: [0.3, 1, 0.3],
                opacity: [0.1, 0.85, 0.1],
                y: [2, -6, 2],
              }}
              transition={{ repeat: Infinity, duration: 1.9, ease: "easeInOut", delay: 0.7 }}
            />
          </svg>
        </div>

        {/* Ambient Warm Golden Glow */}
        <motion.div
          className="absolute -inset-4 rounded-full blur-2xl pointer-events-none"
          animate={{
            scale: [0.94, 1.08, 0.94],
            opacity: [0.25, 0.5, 0.25],
          }}
          transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
          style={{
            background: isLight
              ? "radial-gradient(circle, rgba(245,158,11,0.35) 0%, rgba(251,191,36,0.15) 55%, transparent 75%)"
              : "radial-gradient(circle, rgba(245,158,11,0.25) 0%, rgba(217,119,6,0.12) 55%, transparent 75%)",
          }}
        />

        {/* Outer Circular Platter Frame */}
        <div
          className={`relative rounded-full flex items-center justify-center transition-all ${diameterClass} ${
            isLight
              ? "bg-gradient-to-b from-stone-50 via-white to-amber-50/70 border-2 border-amber-400/40 shadow-[0_12px_32px_-6px_rgba(217,119,6,0.18)]"
              : "bg-gradient-to-b from-stone-900 via-stone-950 to-black border-2 border-amber-500/40 shadow-[0_12px_36px_-6px_rgba(245,158,11,0.22)]"
          }`}
        >
          {/* Smooth Continuous Spinning Golden Arc Ring */}
          <motion.div
            className="absolute -inset-1 rounded-full pointer-events-none"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4.5, ease: "linear" }}
          >
            <div className="w-full h-full rounded-full border border-amber-400/20 border-t-amber-500 border-r-amber-400/50" />
          </motion.div>

          {/* Smooth Spring Dish Transition */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentFood.name}
              initial={{ opacity: 0, scale: 0.65, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.65, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
              className="flex items-center justify-center select-none"
            >
              <span
                className={`drop-shadow-sm ${
                  size === "sm" ? "text-3xl" : size === "lg" ? "text-5xl sm:text-6xl" : "text-4xl"
                }`}
              >
                {currentFood.emoji}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Micro Dish Name Pill */}
        <div className="h-6 mt-3 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={currentFood.name}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.2 }}
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                isLight
                  ? "bg-amber-50 text-amber-900 border-amber-200/80 shadow-2xs"
                  : "bg-stone-900/90 text-amber-300 border-amber-500/25 shadow-2xs"
              }`}
            >
              {currentFood.name}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* 3. Dynamic Text Messages */}
      <div className="space-y-1.5 max-w-xs mb-4">
        <AnimatePresence mode="wait">
          <motion.h4
            key={currentQuote}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className={`text-base sm:text-lg font-bold tracking-tight ${
              isLight ? "text-stone-900" : "text-stone-100"
            }`}
          >
            {currentQuote}
          </motion.h4>
        </AnimatePresence>
        <p className={`text-xs font-medium ${isLight ? "text-stone-500" : "text-stone-400"}`}>
          {subMessage || `Plating fresh ${currentFood.name}...`}
        </p>
      </div>

      {/* 4. Ultra-Smooth Fluid Liquid Progress Bar */}
      <div
        className={`relative w-44 h-1.5 rounded-full overflow-hidden ${
          isLight ? "bg-amber-200/50 border border-amber-300/40" : "bg-stone-800 border border-stone-700/60"
        }`}
      >
        <motion.div
          className="absolute top-0 bottom-0 w-24 rounded-full bg-gradient-to-r from-transparent via-amber-500 to-transparent"
          animate={{ x: ["-100%", "220%"] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  );
}
