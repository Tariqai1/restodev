"use client";

import React, { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import FoodChefLoader from "@/components/FoodChefLoader";

interface MenuItem {
  id: string;
  category_id?: string;
  name: string;
  price: number;
  description?: string;
  is_veg: boolean;
  photo_url: string | null;
  has_half_portion: boolean;
  half_price: number;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface DeliverySettings {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryRadiusKm: number;
  deliveryFee: number;
  minimumOrderAmount: number;
  estimatedPrepMinutes: number;
}

interface RestaurantData {
  id: string;
  name: string;
  slug: string;
}

interface CartItem {
  menuItemId: string;
  dish: MenuItem;
  portion: "half" | "full";
  qty: number;
  notes?: string;
}

interface PlacedOrderSummary {
  orderId: string;
  orderNumber: string;
  orderType: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string | null;
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  total: number;
  estimatedPrepMinutes: number;
}

export default function OnlineOrderingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [isLoading, setIsLoading] = useState(true);
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  // Customer selections
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("pickup");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [vegOnly, setVegOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Cart state: key is `itemId:portion`
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi">("cash");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [placedOrder, setPlacedOrder] = useState<PlacedOrderSummary | null>(null);

  // Fetch menu and settings
  useEffect(() => {
    async function loadStorefront() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/public/restaurant/${encodeURIComponent(slug)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to load restaurant storefront");
        }

        if (data.onlineOrderingEnabled === false) {
          setOnlineEnabled(false);
          setRestaurant(data.restaurant);
          return;
        }

        setOnlineEnabled(true);
        setRestaurant(data.restaurant);
        setDeliverySettings(data.deliverySettings);
        setCategories(data.categories || []);
        setMenuItems(data.menuItems || []);

        // Pick preferred default order type
        if (data.deliverySettings) {
          if (data.deliverySettings.deliveryEnabled && !data.deliverySettings.pickupEnabled) {
            setOrderType("delivery");
          } else if (data.deliverySettings.pickupEnabled) {
            setOrderType("pickup");
          }
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Unable to reach store");
      } finally {
        setIsLoading(false);
      }
    }

    if (slug) {
      loadStorefront();
    }
  }, [slug]);

  // Cart actions
  const addToCart = (dish: MenuItem, portion: "half" | "full" = "full") => {
    const key = `${dish.id}:${portion}`;
    setCart((prev) => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          menuItemId: dish.id,
          dish,
          portion,
          qty: (existing?.qty || 0) + 1,
        },
      };
    });
  };

  const removeFromCart = (dishId: string, portion: "half" | "full" = "full") => {
    const key = `${dishId}:${portion}`;
    setCart((prev) => {
      const existing = prev[key];
      if (!existing) return prev;
      if (existing.qty <= 1) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return {
        ...prev,
        [key]: {
          ...existing,
          qty: existing.qty - 1,
        },
      };
    });
  };

  const cartItemsList = useMemo(() => Object.values(cart), [cart]);
  const totalItemCount = useMemo(
    () => cartItemsList.reduce((sum, item) => sum + item.qty, 0),
    [cartItemsList]
  );

  const subtotal = useMemo(() => {
    return cartItemsList.reduce((sum, it) => {
      const price = it.portion === "half" ? it.dish.half_price : it.dish.price;
      return sum + price * it.qty;
    }, 0);
  }, [cartItemsList]);

  const deliveryFee = orderType === "delivery" ? deliverySettings?.deliveryFee || 0 : 0;
  const taxAmount = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = Math.round((subtotal + taxAmount + deliveryFee) * 100) / 100;

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    return menuItems.filter((dish) => {
      if (vegOnly && !dish.is_veg) return false;
      if (selectedCategory !== "all" && dish.category_id !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = dish.name.toLowerCase().includes(q);
        const descMatch = (dish.description || "").toLowerCase().includes(q);
        if (!nameMatch && !descMatch) return false;
      }
      return true;
    });
  }, [menuItems, vegOnly, selectedCategory, searchQuery]);

  // Handle Checkout submission
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (!customerName.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 10) {
      setSubmitError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      setSubmitError("Please provide your delivery address.");
      return;
    }
    if (
      deliverySettings?.minimumOrderAmount &&
      subtotal < deliverySettings.minimumOrderAmount
    ) {
      setSubmitError(
        `Minimum order amount for this restaurant is ₹${deliverySettings.minimumOrderAmount}.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        restaurantId: restaurant?.id,
        orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() : null,
        items: cartItemsList.map((it) => ({
          menuItemId: it.menuItemId,
          portion: it.portion,
          qty: it.qty,
          notes: it.notes,
        })),
        notes: orderNotes.trim() || undefined,
        paymentMode,
      };

      const res = await fetch("/api/public/online-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to place order.");
      }

      setPlacedOrder({
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        orderType: data.orderType,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        deliveryAddress: data.deliveryAddress,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        deliveryFee: data.deliveryFee,
        total: data.total,
        estimatedPrepMinutes: data.estimatedPrepMinutes,
      });

      setCart({});
      setIsCheckoutOpen(false);
    } catch (err: any) {
      setSubmitError(err.message || "Something went wrong while placing order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-4">
        <FoodChefLoader message="Loading restaurant menu..." />
      </div>
    );
  }

  // 1. Online Ordering Disabled State
  if (!onlineEnabled) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-2xl mb-4 shadow-xl">
          <i className="fa-solid fa-store-slash" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          {restaurant?.name || "Restaurant"}
        </h1>
        <h2 className="text-base font-semibold text-amber-300 mt-1">
          Online Ordering Currently Unavailable
        </h2>
        <p className="text-xs text-stone-400 max-w-sm mt-2 leading-relaxed">
          This restaurant currently accepts orders exclusively via QR codes at their dining tables.
          Please visit our outlet and scan the table QR code to explore the menu and place your order.
        </p>

        <div className="mt-6 flex flex-col gap-2.5 w-full max-w-xs">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-rotate-right" />
            <span>Refresh Store Status</span>
          </button>

          <Link
            href="/login"
            className="w-full py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-sliders text-amber-500" />
            <span>Store Manager / Turn On Online Store</span>
          </Link>
        </div>

        <div className="mt-6 p-3 rounded-xl bg-stone-900/80 border border-stone-800 text-[11px] text-stone-400 max-w-xs">
          <i className="fa-solid fa-qrcode text-stone-300 mr-1.5" />
          <span>Table QR ordering is active on the dining floor.</span>
        </div>
      </div>
    );
  }

  // 2. Order Placed Success Screen
  if (placedOrder) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
        <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-3xl mx-auto shadow-lg animate-bounce">
            <i className="fa-solid fa-check" />
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Order Confirmed
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight mt-2">
              {placedOrder.orderNumber}
            </h2>
            <p className="text-xs text-stone-400 mt-1">
              Thank you, <strong className="text-stone-200">{placedOrder.customerName}</strong>! Your{" "}
              <strong className="text-purple-300 uppercase">{placedOrder.orderType}</strong> order has been sent to the kitchen.
            </p>
          </div>

          {/* Details Card */}
          <div className="p-4 rounded-2xl bg-stone-950/60 border border-stone-800/80 text-left text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-stone-400">Order Type</span>
              <span className="font-bold text-white uppercase flex items-center gap-1">
                <i className={`fa-solid ${placedOrder.orderType === "delivery" ? "fa-motorcycle text-amber-400" : "fa-bag-shopping text-blue-400"}`} />
                <span>{placedOrder.orderType}</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-400">Estimated Ready Time</span>
              <span className="font-mono font-bold text-purple-300">
                ~{placedOrder.estimatedPrepMinutes} minutes
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-400">Contact Mobile</span>
              <span className="font-mono text-stone-200 font-semibold">
                {placedOrder.customerPhone}
              </span>
            </div>

            {placedOrder.deliveryAddress && (
              <div className="pt-2 border-t border-stone-800">
                <span className="text-stone-400 block text-[11px] mb-0.5">Delivery Address:</span>
                <span className="text-stone-200 font-medium leading-relaxed block">
                  {placedOrder.deliveryAddress}
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-sm font-bold text-white">
              <span>Total Payable</span>
              <span className="font-mono text-emerald-400">₹{placedOrder.total}</span>
            </div>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={() => setPlacedOrder(null)}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md active:scale-98 cursor-pointer"
          >
            Order More Items
          </button>
        </div>
      </div>
    );
  }

  // 3. Main Online Ordering Storefront
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans select-none pb-28">
      {/* Top Banner Header */}
      <header className="sticky top-0 z-30 px-4 py-3 bg-stone-900/90 border-b border-stone-800 backdrop-blur-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono block">
              Direct Online Store
            </span>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
              {restaurant?.name || "Restaurant"}
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Accepting Orders</span>
              </span>
              <span>•</span>
              <span>~{deliverySettings?.estimatedPrepMinutes || 25}m prep</span>
            </div>
          </div>

          {/* Delivery / Pickup Mode Switcher */}
          <div className="flex bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs font-bold shrink-0">
            {deliverySettings?.pickupEnabled && (
              <button
                type="button"
                onClick={() => setOrderType("pickup")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  orderType === "pickup"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                <i className="fa-solid fa-bag-shopping text-[11px]" />
                <span>Pickup</span>
              </button>
            )}

            {deliverySettings?.deliveryEnabled && (
              <button
                type="button"
                onClick={() => setOrderType("delivery")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  orderType === "delivery"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-stone-400 hover:text-white"
                }`}
              >
                <i className="fa-solid fa-motorcycle text-[11px]" />
                <span>Delivery</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-2xl mx-auto w-full px-4 pt-4 space-y-4">
        {/* Notice Banner */}
        {orderType === "delivery" && deliverySettings?.deliveryFee ? (
          <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-600/30 text-amber-300 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <i className="fa-solid fa-motorcycle text-amber-400" />
              <span>Direct delivery radius: {deliverySettings.deliveryRadiusKm}km</span>
            </span>
            <span className="font-mono font-bold">₹{deliverySettings.deliveryFee} fee</span>
          </div>
        ) : null}

        {/* Search & Veg Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full h-10 px-3 pl-9 rounded-xl bg-stone-900 border border-stone-800 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-purple-500"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-stone-500 text-xs" />
          </div>

          <button
            type="button"
            onClick={() => setVegOnly(!vegOnly)}
            className={`h-10 px-3 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
              vegOnly
                ? "bg-emerald-950/60 border-emerald-500/60 text-emerald-400"
                : "bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm border border-emerald-500 flex items-center justify-center p-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </span>
            <span>Veg Only</span>
          </button>
        </div>

        {/* Categories Horizontal Bar */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-colors cursor-pointer border ${
                selectedCategory === "all"
                  ? "bg-purple-600 text-white border-purple-500 shadow-xs"
                  : "bg-stone-900 text-stone-400 border-stone-800 hover:border-stone-700"
              }`}
            >
              All Dishes
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-colors cursor-pointer border ${
                  selectedCategory === c.id
                    ? "bg-purple-600 text-white border-purple-500 shadow-xs"
                    : "bg-stone-900 text-stone-400 border-stone-800 hover:border-stone-700"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Dish List */}
        <div className="space-y-3">
          {filteredDishes.length === 0 ? (
            <div className="py-16 text-center text-xs text-stone-500 space-y-2">
              <i className="fa-solid fa-utensils text-2xl block text-stone-600" />
              <span>No dishes matching your selection</span>
            </div>
          ) : (
            filteredDishes.map((dish) => {
              const fullKey = `${dish.id}:full`;
              const halfKey = `${dish.id}:half`;
              const fullQty = cart[fullKey]?.qty || 0;
              const halfQty = cart[halfKey]?.qty || 0;

              return (
                <div
                  key={dish.id}
                  className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 flex gap-3 items-center justify-between"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`w-2.5 h-2.5 rounded-xs border flex items-center justify-center p-0.5 ${
                          dish.is_veg ? "border-emerald-500" : "border-rose-500"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            dish.is_veg ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                      </span>
                      <span className="text-[10px] font-bold uppercase text-stone-400">
                        {dish.is_veg ? "Pure Veg" : "Non-Veg"}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-white tracking-tight leading-snug">
                      {dish.name}
                    </h3>

                    {dish.description && (
                      <p className="text-[11px] text-stone-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {dish.description}
                      </p>
                    )}

                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono font-bold text-sm text-white">
                        ₹{dish.price}
                      </span>
                      {dish.has_half_portion && (
                        <span className="text-[10px] text-stone-400 font-mono">
                          (Half: ₹{dish.half_price})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: Photo & Add buttons */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {dish.photo_url ? (
                      <img
                        src={dish.photo_url}
                        alt={dish.name}
                        className="w-16 h-16 rounded-xl object-cover border border-stone-800"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-center text-xl text-stone-600">
                        <i className="fa-solid fa-bowl-food" />
                      </div>
                    )}

                    {/* Add / Stepper controls */}
                    <div className="flex flex-col gap-1 items-end">
                      {/* Full Portion Stepper */}
                      {fullQty === 0 ? (
                        <button
                          type="button"
                          onClick={() => addToCart(dish, "full")}
                          className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-2xs active:scale-95 transition-all cursor-pointer"
                        >
                          ADD +
                        </button>
                      ) : (
                        <div className="flex items-center rounded-lg border border-purple-500/50 bg-stone-950 overflow-hidden text-xs font-bold font-mono">
                          <button
                            type="button"
                            onClick={() => removeFromCart(dish.id, "full")}
                            className="px-2 py-0.5 text-stone-400 hover:text-white"
                          >
                            −
                          </button>
                          <span className="px-2 text-white">{fullQty}</span>
                          <button
                            type="button"
                            onClick={() => addToCart(dish, "full")}
                            className="px-2 py-0.5 text-purple-400 hover:text-white"
                          >
                            +
                          </button>
                        </div>
                      )}

                      {/* Half Portion Option */}
                      {dish.has_half_portion && (
                        <div className="mt-0.5">
                          {halfQty === 0 ? (
                            <button
                              type="button"
                              onClick={() => addToCart(dish, "half")}
                              className="text-[10px] text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer"
                            >
                              + Half ₹{dish.half_price}
                            </button>
                          ) : (
                            <div className="flex items-center rounded-lg border border-stone-700 bg-stone-950 text-[10px] font-bold font-mono">
                              <button
                                type="button"
                                onClick={() => removeFromCart(dish.id, "half")}
                                className="px-1.5 py-0.5 text-stone-400"
                              >
                                −
                              </button>
                              <span className="px-1 text-stone-200">{halfQty}H</span>
                              <button
                                type="button"
                                onClick={() => addToCart(dish, "half")}
                                className="px-1.5 py-0.5 text-purple-400"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalItemCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-gradient-to-t from-stone-950 via-stone-950/95 to-transparent z-40">
          <div className="max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center justify-between shadow-xl active:scale-[0.99] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-xs font-mono">
                  {totalItemCount}
                </span>
                <span className="text-xs uppercase tracking-wider">
                  {orderType === "delivery" ? "Delivery Order" : "Pickup Order"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-black">₹{grandTotal}</span>
                <span className="text-xs font-bold flex items-center gap-1">
                  <span>Checkout</span>
                  <i className="fa-solid fa-arrow-right text-[10px]" />
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Slide-Up Checkout Drawer Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-950/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 shrink-0">
              <div className="flex items-center gap-2">
                <i className={`fa-solid ${orderType === "delivery" ? "fa-motorcycle text-amber-400" : "fa-bag-shopping text-blue-400"}`} />
                <h3 className="font-bold text-base text-white">
                  {orderType === "delivery" ? "Home Delivery Details" : "Store Takeaway Pickup"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="w-8 h-8 rounded-lg bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handlePlaceOrder} className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 text-xs">
              {submitError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 font-semibold flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Customer Contact */}
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-stone-300 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full h-10 px-3 rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-300 mb-1">
                    Mobile Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="10-digit mobile number for order updates"
                    className="w-full h-10 px-3 rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                {orderType === "delivery" && (
                  <div>
                    <label className="block font-semibold text-stone-300 mb-1">
                      Complete Delivery Address *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Flat / House #, Building name, Street, Landmark"
                      className="w-full p-3 rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-stone-300 mb-1">
                    Special Cooking / Delivery Notes
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Less spicy, extra napkins, leave at door..."
                    className="w-full h-10 px-3 rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Order Items Preview */}
              <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 space-y-2">
                <span className="text-[11px] font-bold uppercase text-stone-400 block font-mono">
                  Order Summary ({totalItemCount} items)
                </span>
                {cartItemsList.map((item) => (
                  <div key={`${item.menuItemId}:${item.portion}`} className="flex justify-between items-center text-xs">
                    <span className="text-stone-300">
                      {item.qty}× {item.dish.name} {item.portion === "half" ? "(Half)" : ""}
                    </span>
                    <span className="font-mono font-semibold text-stone-200">
                      ₹{(item.portion === "half" ? item.dish.half_price : item.dish.price) * item.qty}
                    </span>
                  </div>
                ))}

                <div className="pt-2 border-t border-stone-800 space-y-1 text-stone-400">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">₹{subtotal}</span>
                  </div>
                  {orderType === "delivery" && (
                    <div className="flex justify-between">
                      <span>Delivery Fee</span>
                      <span className="font-mono">₹{deliveryFee}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>GST (5%)</span>
                    <span className="font-mono">₹{taxAmount}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-stone-800 font-bold text-white text-sm">
                    <span>Grand Total</span>
                    <span className="font-mono text-emerald-400">₹{grandTotal}</span>
                  </div>
                </div>
              </div>

              {/* Payment Mode Selection */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-stone-300">
                  Payment Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("cash")}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      paymentMode === "cash"
                        ? "bg-purple-600 text-white border-purple-500 shadow-2xs"
                        : "bg-stone-950 text-stone-400 border-stone-800"
                    }`}
                  >
                    <i className="fa-solid fa-money-bill-wave text-xs" />
                    <span>Pay on {orderType === "delivery" ? "Delivery" : "Pickup"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode("upi")}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      paymentMode === "upi"
                        ? "bg-purple-600 text-white border-purple-500 shadow-2xs"
                        : "bg-stone-950 text-stone-400 border-stone-800"
                    }`}
                  >
                    <i className="fa-solid fa-qrcode text-xs" />
                    <span>UPI / QR Scan</span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-98 cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmitting ? "Placing Order..." : `Confirm & Place Order · ₹${grandTotal}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
