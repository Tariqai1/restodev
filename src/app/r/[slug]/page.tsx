"use client";

import React, { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import FoodChefLoader from "@/components/FoodChefLoader";
import MapLocationPicker, { SelectedLocationData } from "@/components/location/MapLocationPicker";
import LiveDeliveryMapTracker from "@/components/location/LiveDeliveryMapTracker";

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
  latitude?: number;
  longitude?: number;
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

interface PlacedOrderItem {
  name: string;
  portion: "half" | "full";
  qty: number;
  price: number;
  is_veg: boolean;
}

interface PlacedOrderSummary {
  orderId: string;
  orderNumber: string;
  orderType: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string | null;
  customerCoords?: { lat: number; lng: number } | null;
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  total: number;
  estimatedPrepMinutes: number;
  items: PlacedOrderItem[];
  placedAt: string;
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

  // Branding & Theme state
  const [theme, setTheme] = useState<string>("purple");
  const [branding, setBranding] = useState<{ logoUrl?: string; tagline?: string } | null>(null);

  // Customer selections
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [vegOnly, setVegOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Cart state: key is `itemId:portion`
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTrackOrderOpen, setIsTrackOrderOpen] = useState(false);

  // Form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocationData | null>(null);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi">("cash");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [placedOrder, setPlacedOrder] = useState<PlacedOrderSummary | null>(null);
  const [recentOrder, setRecentOrder] = useState<PlacedOrderSummary | null>(null);

  // Dynamic Theme Colors
  const themeStyles = useMemo(() => {
    switch (theme) {
      case "amber":
        return {
          accentBg: "bg-amber-600 hover:bg-amber-700",
          accentText: "text-amber-400",
          accentBorder: "border-amber-500",
          accentSoft: "bg-amber-500/10 text-amber-300 border-amber-500/30",
          accentRing: "focus:border-amber-500 focus:ring-amber-500/20",
          pillActive: "bg-amber-600 text-white border-amber-500 shadow-sm",
        };
      case "crimson":
        return {
          accentBg: "bg-rose-700 hover:bg-rose-800",
          accentText: "text-rose-400",
          accentBorder: "border-rose-600",
          accentSoft: "bg-rose-500/10 text-rose-300 border-rose-500/30",
          accentRing: "focus:border-rose-500 focus:ring-rose-500/20",
          pillActive: "bg-rose-700 text-white border-rose-600 shadow-sm",
        };
      case "saffron":
        return {
          accentBg: "bg-orange-600 hover:bg-orange-700",
          accentText: "text-orange-400",
          accentBorder: "border-orange-500",
          accentSoft: "bg-orange-500/10 text-orange-300 border-orange-500/30",
          accentRing: "focus:border-orange-500 focus:ring-orange-500/20",
          pillActive: "bg-orange-600 text-white border-orange-500 shadow-sm",
        };
      case "emerald":
        return {
          accentBg: "bg-emerald-600 hover:bg-emerald-700",
          accentText: "text-emerald-400",
          accentBorder: "border-emerald-500",
          accentSoft: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
          accentRing: "focus:border-emerald-500 focus:ring-emerald-500/20",
          pillActive: "bg-emerald-600 text-white border-emerald-500 shadow-sm",
        };
      case "charcoal":
        return {
          accentBg: "bg-amber-500 hover:bg-amber-600 !text-stone-950 font-bold",
          accentText: "text-amber-400",
          accentBorder: "border-amber-500",
          accentSoft: "bg-amber-500/10 text-amber-300 border-amber-500/30",
          accentRing: "focus:border-amber-500 focus:ring-amber-500/20",
          pillActive: "bg-amber-500 !text-stone-950 border-amber-400 shadow-sm",
        };
      default: // purple
        return {
          accentBg: "bg-purple-600 hover:bg-purple-700",
          accentText: "text-purple-400",
          accentBorder: "border-purple-500",
          accentSoft: "bg-purple-500/10 text-purple-300 border-purple-500/30",
          accentRing: "focus:border-purple-500 focus:ring-purple-500/20",
          pillActive: "bg-purple-600 text-white border-purple-500 shadow-sm",
        };
    }
  }, [theme]);

  // ─────────────────────────────────────────────────────────────
  // SCROLL LOCK EFFECT: Locks background body scroll when modal is open
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const isModalActive = isCheckoutOpen || isTrackOrderOpen;
    if (isModalActive) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const originalTouchAction = document.body.style.touchAction;

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.touchAction = "none";

      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [isCheckoutOpen, isTrackOrderOpen]);

  // Load Storefront data
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

        // Load theme and branding
        if (data.theme) setTheme(data.theme);
        if (data.branding) {
          setBranding(data.branding);
          if (data.branding.theme) setTheme(data.branding.theme);
        }

        // Pick preferred default order type
        if (data.deliverySettings) {
          if (data.deliverySettings.deliveryEnabled) {
            setOrderType("delivery");
          } else if (data.deliverySettings.pickupEnabled) {
            setOrderType("pickup");
          }
        }

        // Restore recent active order from localStorage (within 24 hours)
        if (typeof window !== "undefined" && data.restaurant?.id) {
          try {
            const saved = localStorage.getItem(`od_online_order_${data.restaurant.id}`);
            if (saved) {
              const parsed = JSON.parse(saved);
              const elapsedHours = (Date.now() - new Date(parsed.placedAt || 0).getTime()) / (1000 * 60 * 60);
              if (elapsedHours < 24) {
                setRecentOrder(parsed);
              }
            }
          } catch {
            // ignore
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
      setSubmitError("Please provide your complete delivery address.");
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
        customerLat: selectedLocation?.lat,
        customerLng: selectedLocation?.lng,
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

      const summary: PlacedOrderSummary = {
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        orderType: data.orderType,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        deliveryAddress: data.deliveryAddress,
        customerCoords: selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : null,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        deliveryFee: data.deliveryFee,
        total: data.total,
        estimatedPrepMinutes: data.estimatedPrepMinutes,
        items: cartItemsList.map((it) => ({
          name: it.dish.name,
          portion: it.portion,
          qty: it.qty,
          price: it.portion === "half" ? it.dish.half_price : it.dish.price,
          is_veg: it.dish.is_veg,
        })),
        placedAt: new Date().toISOString(),
      };

      setPlacedOrder(summary);
      setRecentOrder(summary);

      // Persist in localStorage for customer order tracking
      if (typeof window !== "undefined" && restaurant?.id) {
        localStorage.setItem(`od_online_order_${restaurant.id}`, JSON.stringify(summary));
      }

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
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
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
      </div>
    );
  }

  // 2. Order Placed Full Confirmation Screen
  if (placedOrder) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
        <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-3xl p-5 sm:p-7 text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-2xl mx-auto shadow-lg animate-bounce">
            <i className="fa-solid fa-check" />
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Order Confirmed & Sent to Kitchen
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight mt-1.5">
              {placedOrder.orderNumber}
            </h2>
            <p className="text-xs text-stone-400 mt-1">
              Thank you, <strong className="text-stone-200">{placedOrder.customerName}</strong>! Your{" "}
              <strong className={`${themeStyles.accentText} uppercase`}>{placedOrder.orderType}</strong> order is being prepared.
            </p>
          </div>

          {/* Kitchen Timeline Tracker */}
          <div className="p-3 rounded-2xl bg-stone-950/70 border border-stone-800/80">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-stone-400 font-medium">Estimated Time:</span>
              <span className={`font-mono font-bold ${themeStyles.accentText}`}>
                ~{placedOrder.estimatedPrepMinutes} mins
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
              <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex flex-col items-center gap-1">
                <i className="fa-solid fa-receipt text-xs" />
                <span>Received</span>
              </div>
              <div className={`p-1.5 rounded-lg ${themeStyles.accentSoft} flex flex-col items-center gap-1 animate-pulse`}>
                <i className="fa-solid fa-fire-burner text-xs" />
                <span>Cooking</span>
              </div>
              <div className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-500 flex flex-col items-center gap-1">
                <i className={`fa-solid ${placedOrder.orderType === "delivery" ? "fa-motorcycle" : "fa-bag-shopping"} text-xs`} />
                <span>{placedOrder.orderType === "delivery" ? "On The Way" : "Ready"}</span>
              </div>
            </div>
          </div>

          {/* Itemized Order Breakdown */}
          <div className="p-4 rounded-2xl bg-stone-950/60 border border-stone-800/80 text-left text-xs space-y-2.5">
            <span className="text-[11px] font-bold uppercase text-stone-400 block font-mono">
              Items Ordered ({placedOrder.items.length})
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {placedOrder.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <span className={`w-2 h-2 rounded-xs shrink-0 ${it.is_veg ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <span className="text-stone-200 truncate">
                      {it.qty}× {it.name} {it.portion === "half" ? "(Half)" : ""}
                    </span>
                  </div>
                  <span className="font-mono text-stone-300 shrink-0">
                    ₹{it.price * it.qty}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-stone-800 space-y-1 text-stone-400 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono">₹{placedOrder.subtotal}</span>
              </div>
              {placedOrder.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span className="font-mono">₹{placedOrder.deliveryFee}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST (5%)</span>
                <span className="font-mono">₹{placedOrder.taxAmount}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-stone-800 font-bold text-white text-sm">
                <span>Total Amount</span>
                <span className="font-mono text-emerald-400">₹{placedOrder.total}</span>
              </div>
            </div>

            {placedOrder.deliveryAddress && (
              <div className="pt-2 border-t border-stone-800">
                <span className="text-stone-400 block text-[10px] uppercase font-mono">Delivery Address:</span>
                <span className="text-stone-200 font-medium leading-relaxed block text-xs mt-0.5">
                  {placedOrder.deliveryAddress}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPlacedOrder(null)}
              className="py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all cursor-pointer"
            >
              Order More
            </button>
            <button
              type="button"
              onClick={() => {
                setPlacedOrder(null);
                setIsTrackOrderOpen(true);
              }}
              className={`py-2.5 rounded-xl ${themeStyles.accentBg} text-white text-xs font-bold transition-all shadow-md cursor-pointer`}
            >
              Track Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Main Online Ordering Storefront
  return (
    <div
      data-theme={theme}
      className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans select-none pb-28"
    >
      {/* Top Banner Header with Clean Logo and Theme Branding */}
      <header className="sticky top-0 z-30 bg-stone-900/95 border-b border-stone-800 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-3.5 sm:px-5 py-2.5 flex items-center justify-between gap-3">
          {/* Logo & Restaurant Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={restaurant?.name || "Logo"}
                className="w-11 h-11 rounded-2xl object-cover border border-stone-800 shadow-md shrink-0 bg-stone-900"
              />
            ) : (
              <div
                className={`w-11 h-11 rounded-2xl ${themeStyles.accentBg} flex items-center justify-center text-white font-black text-lg shadow-md shrink-0`}
              >
                {(restaurant?.name || "R")[0].toUpperCase()}
              </div>
            )}

            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white truncate leading-tight">
                {restaurant?.name || "Restaurant"}
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                <span className="flex items-center gap-1 text-emerald-400 font-bold shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Online Store</span>
                </span>
                <span>•</span>
                <span className="truncate">~{deliverySettings?.estimatedPrepMinutes || 25}m prep</span>
              </div>
            </div>
          </div>

          {/* Delivery / Pickup Mode Switcher */}
          <div className="flex bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs font-bold shrink-0">
            {deliverySettings?.deliveryEnabled && (
              <button
                type="button"
                onClick={() => setOrderType("delivery")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  orderType === "delivery"
                    ? themeStyles.pillActive
                    : "text-stone-400 hover:text-white"
                }`}
              >
                <i className="fa-solid fa-motorcycle text-[11px]" />
                <span>Delivery</span>
              </button>
            )}

            {deliverySettings?.pickupEnabled && (
              <button
                type="button"
                onClick={() => setOrderType("pickup")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  orderType === "pickup"
                    ? themeStyles.pillActive
                    : "text-stone-400 hover:text-white"
                }`}
              >
                <i className="fa-solid fa-bag-shopping text-[11px]" />
                <span>Pickup</span>
              </button>
            )}
          </div>
        </div>

        {/* Dedicated Live Active Order Alert Bar (High Contrast, Never Overlapping) */}
        {recentOrder && (
          <div
            onClick={() => setIsTrackOrderOpen(true)}
            className="w-full bg-gradient-to-r from-emerald-950/90 via-stone-900 to-emerald-950/90 border-t border-emerald-500/30 px-3.5 sm:px-5 py-2 flex items-center justify-between text-xs cursor-pointer hover:bg-stone-900 transition-all shadow-md group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="min-w-0">
                <span className="font-bold text-white truncate inline-block mr-1.5">
                  Active Order #{recentOrder.orderNumber}
                </span>
                <span className="text-[11px] text-emerald-300 font-mono hidden xs:inline">
                  (₹{recentOrder.total} · {recentOrder.items.length} items)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform">
              <span>View Bill & Status</span>
              <i className="fa-solid fa-arrow-right text-[10px]" />
            </div>
          </div>
        )}
      </header>

      {/* Main Content Container */}
      <main className="max-w-3xl mx-auto w-full px-3.5 sm:px-5 pt-4 space-y-4">

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
              className={`w-full h-10 px-3 pl-9 rounded-xl bg-stone-900 border border-stone-800 text-xs text-white placeholder-stone-500 focus:outline-none ${themeStyles.accentRing}`}
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
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition-colors cursor-pointer border ${
                selectedCategory === "all"
                  ? themeStyles.pillActive
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
                    ? themeStyles.pillActive
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
                          className={`px-3 py-1 rounded-lg text-xs font-bold text-white shadow-2xs active:scale-95 transition-all cursor-pointer ${themeStyles.accentBg}`}
                        >
                          ADD +
                        </button>
                      ) : (
                        <div className="flex items-center rounded-lg border border-stone-700 bg-stone-950 overflow-hidden text-xs font-bold font-mono">
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
                            className={`px-2 py-0.5 hover:text-white ${themeStyles.accentText}`}
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
                              className={`text-[10px] font-bold underline cursor-pointer hover:opacity-80 ${themeStyles.accentText}`}
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
                                className={`px-1.5 py-0.5 ${themeStyles.accentText}`}
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

      {/* Floating Bottom Cart Bar (Thumb-optimized & Safe-area padded) */}
      {totalItemCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-stone-950 via-stone-950/95 to-transparent z-40">
          <div className="max-w-3xl mx-auto">
            <button
              type="button"
              onClick={() => setIsCheckoutOpen(true)}
              className={`w-full py-3.5 px-4 rounded-2xl text-white font-bold flex items-center justify-between shadow-2xl active:scale-[0.99] transition-all cursor-pointer ${themeStyles.accentBg}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-black/25 flex items-center justify-center text-xs font-mono font-bold">
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

      {/* ─────────────────────────────────────────────────────────────
          4. MODAL: Slide-Up Checkout Drawer (Background Scroll-Locked)
         ───────────────────────────────────────────────────────────── */}
      {isCheckoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCheckoutOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Grab Handle for mobile */}
            <div className="w-12 h-1 bg-stone-700 rounded-full mx-auto mb-3 sm:hidden" />
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

            {/* Scrollable Form Body with overscroll containment */}
            <form
              onSubmit={handlePlaceOrder}
              className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 text-xs overscroll-contain"
            >
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
                    className={`w-full h-10 px-3 rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-none ${themeStyles.accentRing}`}
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
                    className={`w-full h-10 px-3 rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-none font-mono ${themeStyles.accentRing}`}
                  />
                </div>

                {orderType === "delivery" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block font-semibold text-stone-300">
                        Delivery Address *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsMapPickerOpen(true)}
                        className={`text-[11px] font-bold ${themeStyles.accentText} hover:underline flex items-center gap-1 cursor-pointer`}
                      >
                        <span>📍 {selectedLocation ? "Change Pin" : "Pick on Map"}</span>
                      </button>
                    </div>

                    {selectedLocation ? (
                      /* Verified Address Card (Zepto / Swiggy Style) */
                      <div className="p-3 rounded-2xl bg-stone-950 border border-emerald-500/50 space-y-1.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {selectedLocation.tag === "home" ? "🏠 Home" : selectedLocation.tag === "work" ? "🏢 Work" : "📍 Destination"}
                          </span>
                          <span className="text-[11px] font-mono text-emerald-400 font-bold">
                            ✓ {selectedLocation.distanceKm} km away
                          </span>
                        </div>
                        <p className="text-xs text-white font-bold leading-snug">
                          {selectedLocation.flatNo}
                        </p>
                        <p className="text-[11px] text-stone-400 leading-snug">
                          {selectedLocation.formattedAddress}
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsMapPickerOpen(true)}
                          className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline pt-0.5 cursor-pointer"
                        >
                          Adjust location on map
                        </button>
                      </div>
                    ) : (
                      /* Prominent Map Picker Button */
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setIsMapPickerOpen(true)}
                          className="w-full py-3 px-3.5 rounded-2xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border border-emerald-500/40 text-emerald-300 hover:border-emerald-400 font-bold text-xs flex items-center justify-between transition-all cursor-pointer shadow-md active:scale-98"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">📍</span>
                            <div className="text-left">
                              <span className="block font-black text-white text-xs leading-tight">
                                Select Address on Live Map
                              </span>
                              <span className="text-[10px] text-emerald-300/80 font-normal">
                                Pinpoint doorstep & check delivery radius
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-black bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-xl">
                            Locate →
                          </span>
                        </button>

                        <textarea
                          required
                          rows={2}
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Or type Flat #, Building, Street, Landmark manually..."
                          className={`w-full p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-hidden text-xs resize-none ${themeStyles.accentRing}`}
                        />
                      </div>
                    )}
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
                    className={`w-full h-10 px-3 rounded-xl bg-stone-950 border border-stone-800 text-white placeholder-stone-500 focus:outline-none ${themeStyles.accentRing}`}
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
                        ? themeStyles.pillActive
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
                        ? themeStyles.pillActive
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
                className={`w-full py-3.5 rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-98 cursor-pointer disabled:opacity-50 mt-2 ${themeStyles.accentBg}`}
              >
                {isSubmitting ? "Placing Order..." : `Confirm & Place Order · ₹${grandTotal}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. MODAL: Customer Order History & Tracking (Background Scroll-Locked)
         ───────────────────────────────────────────────────────────── */}
      {isTrackOrderOpen && recentOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsTrackOrderOpen(false);
          }}
        >
          <div
            className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div className="w-12 h-1 bg-stone-700 rounded-full mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between pb-3 border-b border-stone-800 shrink-0">
              <div className="flex items-center gap-2">
                <i className={`fa-solid ${themeStyles.accentText} fa-bag-shopping`} />
                <h3 className="font-bold text-base text-white">Your Order Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTrackOrderOpen(false)}
                className="w-8 h-8 rounded-lg bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto space-y-4 py-3 text-xs overscroll-contain">
              {/* Swiggy/Zepto-grade Live Map Delivery Tracker */}
              {recentOrder.orderType === "delivery" && (
                <div className="mb-2">
                  <LiveDeliveryMapTracker
                    orderNumber={recentOrder.orderNumber}
                    stage="preparing"
                    customerAddress={recentOrder.deliveryAddress || "Your location"}
                    customerCoords={recentOrder.customerCoords}
                    restoCoords={
                      deliverySettings?.latitude && deliverySettings?.longitude
                        ? { lat: deliverySettings.latitude, lng: deliverySettings.longitude }
                        : undefined
                    }
                    restoName={restaurant?.name || "Kitchen"}
                    estimatedMinutes={recentOrder.estimatedPrepMinutes || 25}
                    customerPhone={recentOrder.customerPhone}
                  />
                </div>
              )}

              {/* Order Number & Header */}
              <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-stone-400 uppercase font-bold block">
                    Order Number
                  </span>
                  <span className="text-base font-black text-white font-mono">
                    {recentOrder.orderNumber}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                    In Kitchen
                  </span>
                  <span className="text-[10px] text-stone-400 block mt-0.5">
                    ~{recentOrder.estimatedPrepMinutes}m prep
                  </span>
                </div>
              </div>

              {/* Dishes list */}
              <div className="p-3.5 rounded-2xl bg-stone-950/50 border border-stone-800 space-y-2">
                <span className="text-[11px] font-bold uppercase text-stone-400 block font-mono">
                  Dishes in this order ({recentOrder.items?.length || 0})
                </span>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {(recentOrder.items || []).map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <span className={`w-2 h-2 rounded-xs shrink-0 ${it.is_veg ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <span className="text-stone-200 truncate font-medium">
                          {it.qty}× {it.name} {it.portion === "half" ? "(Half)" : ""}
                        </span>
                      </div>
                      <span className="font-mono text-stone-300 shrink-0 font-semibold">
                        ₹{it.price * it.qty}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-stone-800 space-y-1 text-stone-400 text-[11px]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">₹{recentOrder.subtotal}</span>
                  </div>
                  {recentOrder.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span>Delivery Fee</span>
                      <span className="font-mono">₹{recentOrder.deliveryFee}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>GST (5%)</span>
                    <span className="font-mono">₹{recentOrder.taxAmount}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-stone-800 font-bold text-white text-sm">
                    <span>Total Paid / Payable</span>
                    <span className="font-mono text-emerald-400">₹{recentOrder.total}</span>
                  </div>
                </div>
              </div>

              {/* Delivery details if any */}
              {recentOrder.deliveryAddress && (
                <div className="p-3 rounded-xl bg-stone-950/40 border border-stone-800">
                  <span className="text-[10px] text-stone-400 font-mono uppercase block">Delivery Address:</span>
                  <span className="text-stone-200 font-medium leading-relaxed block text-xs mt-0.5">
                    {recentOrder.deliveryAddress}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsTrackOrderOpen(false)}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs cursor-pointer mt-1"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. MODAL: Map Location Picker (Zepto/Swiggy Style)
         ───────────────────────────────────────────────────────────── */}
      <MapLocationPicker
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        restoCoords={
          deliverySettings?.latitude && deliverySettings?.longitude
            ? { lat: deliverySettings.latitude, lng: deliverySettings.longitude }
            : undefined
        }
        restoName={restaurant?.name || "Our Restaurant"}
        deliveryRadiusKm={deliverySettings?.deliveryRadiusKm || 5}
        onConfirmLocation={(loc) => {
          setSelectedLocation(loc);
          setDeliveryAddress(loc.formattedAddress);
        }}
      />
    </div>
  );
}
