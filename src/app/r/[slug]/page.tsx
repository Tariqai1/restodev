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
  images?: string[];
  is_bestseller?: boolean;
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
  verificationCode?: string;
  placedAt: string;
}

function getWhatsAppBillUrl(
  order: PlacedOrderSummary,
  restaurantName: string,
  slug: string
): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://orderdesk.app";
  const trackingUrl = `${origin}/r/${slug}?track=${encodeURIComponent(order.orderNumber)}`;

  const itemsList = (order.items || [])
    .map((it) => `• ${it.qty}× ${it.name} ${it.portion === "half" ? "(Half)" : ""} - ₹${it.price * it.qty}`)
    .join("\n");

  const pinText = order.verificationCode ? `\n🔐 *Doorstep Handover PIN:* ${order.verificationCode}` : "";
  const addressText = order.deliveryAddress ? `\n📍 *Delivery Address:* ${order.deliveryAddress}` : "";

  const text = `🧾 *${restaurantName} — Order Confirmed!*
━━━━━━━━━━━━━━━━━━━━
*Order ID:* #${order.orderNumber}
*Customer:* ${order.customerName}
*Order Type:* ${order.orderType.toUpperCase()}
${pinText}${addressText}

🍽️ *Items Ordered:*
${itemsList}

💰 *Bill Summary:*
• Subtotal: ₹${order.subtotal}
${order.deliveryFee > 0 ? `• Delivery Fee: ₹${order.deliveryFee}\n` : ""}• GST (5%): ₹${order.taxAmount}
*Total Amount:* ₹${order.total}

🛵 *Live Order Tracker & Digital Invoice:*
👉 ${trackingUrl}
━━━━━━━━━━━━━━━━━━━━
_Thank you for ordering with ${restaurantName}!_`;

  const cleanPhone = (order.customerPhone || "").replace(/\D/g, "");
  const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  return fullPhone
    ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
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
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [customerCancelReason, setCustomerCancelReason] = useState("Placed by mistake");
  const [orderCancelledNotice, setOrderCancelledNotice] = useState<string | null>(null);

  // Dish Tap-to-View HD Sheet state
  const [selectedPreviewDish, setSelectedPreviewDish] = useState<MenuItem | null>(null);
  const [previewImageIdx, setPreviewImageIdx] = useState(0);
  const [previewPortion, setPreviewPortion] = useState<"full" | "half">("full");
  const previewTouchStartX = React.useRef<number | null>(null);
  const previewTouchStartY = React.useRef<number | null>(null);

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
    const isModalActive = isCheckoutOpen || isTrackOrderOpen || Boolean(selectedPreviewDish);
    if (isModalActive) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.style.touchAction = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [isCheckoutOpen, isTrackOrderOpen, selectedPreviewDish]);

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
                const sub = Number(parsed.subtotal) || 0;
                const fee = Number(parsed.deliveryFee) || 0;
                const tax = Number(parsed.taxAmount) || 0;
                const tot = Number(parsed.total) || Math.round((sub + fee + tax) * 100) / 100;
                setRecentOrder({
                  ...parsed,
                  subtotal: sub,
                  deliveryFee: fee,
                  taxAmount: tax,
                  total: tot,
                });
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

    // Auto-open live tracking if opened from WhatsApp link (?track=ORD-9401)
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const trackParam = searchParams.get("track") || searchParams.get("order");
      if (trackParam) {
        fetch(`/api/public/online-order?orderNumber=${encodeURIComponent(trackParam)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.ok && data.order) {
              setRecentOrder(data.order);
              setIsTrackOrderOpen(true);
            }
          })
          .catch(() => {});
      }
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

      const resolvedSubtotal = Number(data.subtotal) || subtotal || 0;
      const resolvedTax = Number(data.taxAmount) !== undefined ? Number(data.taxAmount) : taxAmount || 0;
      const resolvedFee = Number(data.deliveryFee) !== undefined ? Number(data.deliveryFee) : (orderType === "delivery" ? deliveryFee : 0);
      const resolvedTotal = Number(data.total) || Number(data.totalAmount) || Math.round((resolvedSubtotal + resolvedTax + resolvedFee) * 100) / 100;

      const summary: PlacedOrderSummary = {
        orderId: data.orderId,
        orderNumber: data.orderNumber || `ORD-${Date.now().toString().slice(-4)}`,
        orderType: data.orderType || orderType,
        customerName: data.customerName || customerName.trim(),
        customerPhone: data.customerPhone || customerPhone.trim(),
        deliveryAddress: data.deliveryAddress || (orderType === "delivery" ? deliveryAddress.trim() : null),
        customerCoords: selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : null,
        subtotal: resolvedSubtotal,
        taxAmount: resolvedTax,
        deliveryFee: resolvedFee,
        total: resolvedTotal,
        estimatedPrepMinutes: Number(data.estimatedPrepMinutes) || 25,
        items: cartItemsList.map((it) => ({
          name: it.dish.name,
          portion: it.portion,
          qty: it.qty,
          price: it.portion === "half" ? it.dish.half_price : it.dish.price,
          is_veg: it.dish.is_veg,
        })),
        verificationCode: data.verificationCode,
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

  const handleCustomerCancelOrder = async () => {
    if (!placedOrder?.orderId) return;
    setIsCancellingOrder(true);
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: placedOrder.orderId,
          reason: customerCancelReason,
          cancelledBy: "customer",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to cancel order");

      if (typeof window !== "undefined" && restaurant?.id) {
        localStorage.removeItem(`od_online_order_${restaurant.id}`);
      }
      setShowCancelConfirmModal(false);
      setPlacedOrder(null);
      setRecentOrder(null);
      setOrderCancelledNotice(`Your order #${placedOrder.orderNumber} has been cancelled.`);
      setTimeout(() => setOrderCancelledNotice(null), 6000);
    } catch (err: any) {
      alert(err.message || "Unable to cancel order.");
    } finally {
      setIsCancellingOrder(false);
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
    const placedSubtotal = Number(placedOrder.subtotal) || 0;
    const placedFee = Number(placedOrder.deliveryFee) || 0;
    const placedTax = Number(placedOrder.taxAmount) || 0;
    const placedTotal =
      Number(placedOrder.total) ||
      Math.round((placedSubtotal + placedTax + placedFee) * 100) / 100;

    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="max-w-md w-full bg-stone-900/95 border border-stone-800/90 rounded-3xl p-5 sm:p-7 text-center shadow-2xl space-y-4 backdrop-blur-md">
          {/* Smooth Glowing Checkmark Badge */}
          <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 ring-8 ring-emerald-500/10 animate-pulse" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-stone-950 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/30">
              <i className="fa-solid fa-check text-2xl font-black text-white" />
            </div>
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold bg-emerald-950/70 px-3 py-1 rounded-full border border-emerald-500/30 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              Order Confirmed & Sent to Kitchen
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight mt-2 font-mono">
              {placedOrder.orderNumber}
            </h2>
            <p className="text-xs text-stone-400 mt-1 leading-relaxed">
              Thank you, <strong className="text-stone-200">{placedOrder.customerName}</strong>! Your{" "}
              <strong className={`${themeStyles.accentText} uppercase font-bold`}>{placedOrder.orderType}</strong> order is being prepared.
            </p>
          </div>

          {/* Doorstep Delivery Verification PIN (if delivery) */}
          {placedOrder.verificationCode && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-amber-950/40 border border-amber-500/30 text-center space-y-1 shadow-sm">
              <span className="text-[10px] uppercase font-mono tracking-wider text-amber-400 font-bold block">
                Doorstep Delivery PIN
              </span>
              <div className="inline-block px-4 py-1.5 rounded-xl bg-stone-950/80 border border-amber-500/50 text-2xl font-black tracking-[0.25em] text-amber-300 font-mono shadow-inner">
                {placedOrder.verificationCode}
              </div>
              <p className="text-[11px] text-amber-200/80 font-medium">
                Share this 4-digit PIN with your delivery captain upon doorstep arrival.
              </p>
            </div>
          )}

          {/* WhatsApp Automated Digital Bill & Live Tracker Card (Zero SMS Fees) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-emerald-900/40 to-emerald-950/80 border border-emerald-500/40 text-center space-y-2 shadow-lg">
            <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider font-mono">
              <i className="fa-brands fa-whatsapp text-lg text-emerald-400" />
              <span>WhatsApp Digital Bill &amp; Live Tracker</span>
            </div>
            <p className="text-[11px] text-stone-300 leading-relaxed">
              Get your complete invoice &amp; live GPS delivery tracker sent directly to your WhatsApp:
            </p>
            <a
              href={getWhatsAppBillUrl(placedOrder, restaurant?.name || "Our Restaurant", slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <i className="fa-brands fa-whatsapp text-base" />
              <span>Send / Save Bill to WhatsApp (100% Free)</span>
            </a>
          </div>

          {/* Kitchen Timeline Tracker */}
          <div className="p-3.5 rounded-2xl bg-stone-950/70 border border-stone-800/80">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-stone-400 font-medium">Estimated Time:</span>
              <span className={`font-mono font-bold ${themeStyles.accentText}`}>
                ~{placedOrder.estimatedPrepMinutes} mins
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
              <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex flex-col items-center gap-1 transition-all">
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
                  <span className="font-mono text-stone-300 shrink-0 font-semibold">
                    ₹{it.price * it.qty}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-stone-800 space-y-1 text-stone-400 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono font-semibold text-stone-300">₹{placedSubtotal}</span>
              </div>
              {placedFee > 0 && (
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span className="font-mono font-semibold text-stone-300">₹{placedFee}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST (5%)</span>
                <span className="font-mono font-semibold text-stone-300">₹{placedTax}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-stone-800 font-bold text-white text-sm">
                <span>Total Amount</span>
                <span className="font-mono text-emerald-400 text-base font-extrabold">₹{placedTotal}</span>
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
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setPlacedOrder(null)}
              className="py-2.5 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 active:scale-95 text-stone-200 text-xs font-bold transition-all duration-200 cursor-pointer border border-stone-700/60 shadow-xs"
            >
              Order More
            </button>
            <button
              type="button"
              onClick={() => {
                setPlacedOrder(null);
                setIsTrackOrderOpen(true);
              }}
              className={`py-2.5 rounded-xl ${themeStyles.accentBg} hover:brightness-110 active:scale-95 text-white text-xs font-bold transition-all duration-200 shadow-md cursor-pointer`}
            >
              Track Live Order
            </button>
          </div>

          {/* Cancel Order Option */}
          <div className="pt-2 border-t border-stone-800/80">
            <button
              type="button"
              onClick={() => setShowCancelConfirmModal(true)}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline underline-offset-4 cursor-pointer transition-colors"
            >
              Need to cancel this order?
            </button>
          </div>
        </div>

        {/* Customer Cancel Confirmation Modal */}
        {showCancelConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-3xl p-5 text-left shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-lg shrink-0">
                  ❌
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Cancel Order?</h3>
                  <p className="text-[11px] text-stone-400">Order #{placedOrder?.orderNumber}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-400 uppercase font-mono block">
                  Reason for cancellation
                </label>
                <div className="space-y-1.5">
                  {[
                    "Placed by mistake",
                    "Want to change items or delivery address",
                    "Delivery time is too long",
                    "Other reason",
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setCustomerCancelReason(r)}
                      className={`w-full p-2.5 rounded-xl text-xs font-semibold text-left border transition-all cursor-pointer ${
                        customerCancelReason === r
                          ? "bg-rose-950/60 border-rose-500/60 text-rose-200"
                          : "bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  disabled={isCancellingOrder}
                  onClick={() => setShowCancelConfirmModal(false)}
                  className="py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  disabled={isCancellingOrder}
                  onClick={handleCustomerCancelOrder}
                  className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                >
                  {isCancellingOrder ? (
                    <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                  ) : (
                    <i className="fa-solid fa-ban text-xs" />
                  )}
                  <span>Cancel Now</span>
                </button>
              </div>
            </div>
          </div>
        )}
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
        {recentOrder && (() => {
          const rSub = Number(recentOrder.subtotal) || 0;
          const rFee = Number(recentOrder.deliveryFee) || 0;
          const rTax = Number(recentOrder.taxAmount) || 0;
          const rTot = Number(recentOrder.total) || Math.round((rSub + rFee + rTax) * 100) / 100;
          return (
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
                    (₹{rTot} · {recentOrder.items?.length || 0} items)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform">
                <span>View Bill & Status</span>
                <i className="fa-solid fa-arrow-right text-[10px]" />
              </div>
            </div>
          );
        })()}

        {/* Order Cancelled Notification Banner */}
        {orderCancelledNotice && (
          <div className="bg-rose-950/80 border-b border-rose-500/40 px-4 py-2.5 flex items-center justify-between text-xs text-rose-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span className="font-semibold">{orderCancelledNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setOrderCancelledNotice(null)}
              className="text-stone-400 hover:text-white p-1"
            >
              ✕
            </button>
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

              const gallery = (dish.images && dish.images.length > 0)
                ? dish.images
                : (dish.photo_url ? [dish.photo_url] : []);
              const mainPhoto = gallery[0] || dish.photo_url;
              const hasMultiplePhotos = gallery.length > 1;

              return (
                <div
                  key={dish.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-stone-900 border border-stone-800 hover:border-stone-700/80 transition-all flex gap-3.5 items-start justify-between group/card"
                >
                  {/* Left: Dish Info - tap to view HD preview */}
                  <div
                    className="flex-1 min-w-0 pr-1 cursor-pointer select-none"
                    onClick={() => {
                      setSelectedPreviewDish(dish);
                      setPreviewImageIdx(0);
                      setPreviewPortion("full");
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
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
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        {dish.is_veg ? "Pure Veg" : "Non-Veg"}
                      </span>
                      {dish.is_bestseller && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <i className="fa-solid fa-star text-[8px]" />
                          <span>Bestseller</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm sm:text-base text-white tracking-tight leading-snug group-hover/card:text-amber-300 transition-colors">
                      {dish.name}
                    </h3>

                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="font-mono font-bold text-sm sm:text-base text-white">
                        ₹{dish.price}
                      </span>
                      {dish.has_half_portion && (
                        <span className="text-[10px] text-stone-400 font-mono">
                          (Half: ₹{dish.half_price})
                        </span>
                      )}
                    </div>

                    {dish.description && (
                      <p className="text-[11px] sm:text-xs text-stone-400 line-clamp-2 mt-1.5 leading-relaxed">
                        {dish.description}
                      </p>
                    )}
                  </div>

                  {/* Right side: HD Photo (w-24 h-24 / sm:w-28 sm:h-28) & Add buttons */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div
                      className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-stone-800 bg-stone-950 cursor-pointer shadow-sm group hover:scale-[1.02] transition-transform select-none"
                      onClick={() => {
                        setSelectedPreviewDish(dish);
                        setPreviewImageIdx(0);
                        setPreviewPortion("full");
                      }}
                      title="Tap to view photo"
                    >
                      {mainPhoto ? (
                        <img
                          src={mainPhoto}
                          alt={dish.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl text-stone-600">
                          <i className="fa-solid fa-bowl-food" />
                        </div>
                      )}

                      {/* Multi-Photo Count Badge */}
                      {hasMultiplePhotos && (
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[9px] font-mono text-white flex items-center gap-1 font-bold shadow-xs pointer-events-none">
                          <i className="fa-solid fa-camera text-[8px]" />
                          <span>{gallery.length}</span>
                        </div>
                      )}

                      {/* Tap to View HD icon cue */}
                      <div className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 backdrop-blur-xs text-white/90 flex items-center justify-center text-[9px] opacity-80 pointer-events-none">
                        <i className="fa-solid fa-expand" />
                      </div>
                    </div>

                    {/* Add / Stepper controls */}
                    <div className="flex flex-col gap-1 items-center w-full">
                      {/* Full Portion Stepper */}
                      {fullQty === 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(dish, "full");
                          }}
                          className={`w-full max-w-[100px] py-1.5 px-3 rounded-xl text-xs font-extrabold text-white shadow-2xs active:scale-95 transition-all cursor-pointer text-center ${themeStyles.accentBg}`}
                        >
                          ADD +
                        </button>
                      ) : (
                        <div className="flex items-center rounded-xl border border-stone-700 bg-stone-950 overflow-hidden text-xs font-bold font-mono shadow-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromCart(dish.id, "full");
                            }}
                            className="w-7 h-7 flex items-center justify-center text-stone-300 hover:text-white active:bg-stone-800"
                          >
                            −
                          </button>
                          <span className="px-2 text-white font-bold">{fullQty}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(dish, "full");
                            }}
                            className={`w-7 h-7 flex items-center justify-center active:bg-stone-800 ${themeStyles.accentText}`}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(dish, "half");
                              }}
                              className={`text-[10px] font-bold underline cursor-pointer hover:opacity-80 ${themeStyles.accentText}`}
                            >
                              + Half ₹{dish.half_price}
                            </button>
                          ) : (
                            <div className="flex items-center rounded-lg border border-stone-700 bg-stone-950 text-[10px] font-bold font-mono">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromCart(dish.id, "half");
                                }}
                                className="px-1.5 py-0.5 text-stone-400 active:bg-stone-800"
                              >
                                −
                              </button>
                              <span className="px-1 text-stone-200">{halfQty}H</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(dish, "half");
                                }}
                                className={`px-1.5 py-0.5 active:bg-stone-800 ${themeStyles.accentText}`}
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

              {/* 4-Digit In-App Delivery Verification Code (100% Free PIN) */}
              {recentOrder.verificationCode && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono uppercase font-black text-amber-400 tracking-wider">
                    <i className="fa-solid fa-shield-halved text-xs text-amber-400" />
                    <span>Delivery Verification PIN</span>
                  </div>
                  <div className="text-3xl font-mono font-black text-white tracking-[0.35em] my-1">
                    {recentOrder.verificationCode}
                  </div>
                  <p className="text-[11px] text-amber-200/80 font-medium">
                    Please share this 4-digit PIN with your delivery captain upon doorstep arrival.
                  </p>
                </div>
              )}

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
                  {(() => {
                    const rSubtotal = Number(recentOrder.subtotal) || 0;
                    const rFee = Number(recentOrder.deliveryFee) || 0;
                    const rTax = Number(recentOrder.taxAmount) || 0;
                    const rTotal =
                      Number(recentOrder.total) ||
                      Math.round((rSubtotal + rFee + rTax) * 100) / 100;
                    return (
                      <>
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span className="font-mono font-semibold text-stone-300">₹{rSubtotal}</span>
                        </div>
                        {rFee > 0 && (
                          <div className="flex justify-between">
                            <span>Delivery Fee</span>
                            <span className="font-mono font-semibold text-stone-300">₹{rFee}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>GST (5%)</span>
                          <span className="font-mono font-semibold text-stone-300">₹{rTax}</span>
                        </div>
                        <div className="flex justify-between pt-1.5 border-t border-stone-800 font-bold text-white text-sm">
                          <span>Total Paid / Payable</span>
                          <span className="font-mono text-emerald-400 font-extrabold text-base">₹{rTotal}</span>
                        </div>
                      </>
                    );
                  })()}
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

            <div className="grid grid-cols-2 gap-2 mt-2">
              <a
                href={getWhatsAppBillUrl(recentOrder, restaurant?.name || "Our Restaurant", slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <i className="fa-brands fa-whatsapp text-sm" />
                <span>Share Bill</span>
              </a>
              <button
                type="button"
                onClick={() => setIsTrackOrderOpen(false)}
                className="py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-200 font-bold text-xs cursor-pointer transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          HD DISH DETAIL SHEET (Swiggy / Zomato Gold Luxury Edition)
         ───────────────────────────────────────────────────────────── */}
      {selectedPreviewDish && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200 select-none overscroll-contain"
          onClick={() => setSelectedPreviewDish(null)}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div
            className="w-full max-w-lg bg-[#18181b] border-t sm:border border-stone-800/80 rounded-t-[32px] sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-300 overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Grab Handle */}
            <div className="pt-2.5 pb-1 flex justify-center bg-[#18181b]">
              <div className="w-10 h-1 bg-stone-700/80 rounded-full" />
            </div>

            {/* Inset Hero Image Carousel */}
            {(() => {
              const gallery = (selectedPreviewDish.images && selectedPreviewDish.images.length > 0)
                ? selectedPreviewDish.images
                : (selectedPreviewDish.photo_url ? [selectedPreviewDish.photo_url] : []);
              const currentImg = gallery[previewImageIdx] || selectedPreviewDish.photo_url;
              const hasMultiple = gallery.length > 1;

              const handlePreviewTouchStart = (e: React.TouchEvent) => {
                previewTouchStartX.current = e.touches[0].clientX;
                previewTouchStartY.current = e.touches[0].clientY;
              };

              const handlePreviewTouchEnd = (e: React.TouchEvent) => {
                if (previewTouchStartX.current === null || previewTouchStartY.current === null) return;
                const diffX = previewTouchStartX.current - e.changedTouches[0].clientX;
                const diffY = previewTouchStartY.current - e.changedTouches[0].clientY;
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 30) {
                  if (diffX > 0) {
                    setPreviewImageIdx((prev) => (prev < gallery.length - 1 ? prev + 1 : 0));
                  } else {
                    setPreviewImageIdx((prev) => (prev > 0 ? prev - 1 : gallery.length - 1));
                  }
                }
                previewTouchStartX.current = null;
                previewTouchStartY.current = null;
              };

              return (
                <div
                  className="mx-3.5 mt-1 rounded-2xl overflow-hidden relative h-64 sm:h-72 bg-stone-950 border border-stone-800/70 shadow-lg shrink-0 touch-pan-y"
                  onTouchStart={handlePreviewTouchStart}
                  onTouchEnd={handlePreviewTouchEnd}
                >
                  {currentImg ? (
                    <img
                      src={currentImg}
                      alt={selectedPreviewDish.name}
                      className="w-full h-full object-cover transition-all duration-300 pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-600 gap-2">
                      <i className="fa-solid fa-bowl-food text-5xl" />
                      <span className="text-xs text-stone-500">No photo available</span>
                    </div>
                  )}

                  {/* Gradient overlay for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

                  {/* Top Close Button (Glassmorphic) */}
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewDish(null)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center text-xs font-bold cursor-pointer backdrop-blur-md transition-transform active:scale-90 z-20 border border-white/15 shadow-md"
                    aria-label="Close"
                  >
                    ✕
                  </button>

                  {/* Top Left Badges: Veg/Non-Veg & Bestseller */}
                  <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase backdrop-blur-md flex items-center gap-1.5 shadow-md border ${
                      selectedPreviewDish.is_veg
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                        : "bg-rose-950/80 text-rose-300 border-rose-500/40"
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${selectedPreviewDish.is_veg ? "bg-emerald-400" : "bg-rose-500"}`} />
                      <span>{selectedPreviewDish.is_veg ? "Pure Veg" : "Non-Veg"}</span>
                    </span>

                    {selectedPreviewDish.is_bestseller && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 flex items-center gap-1 shadow-md">
                        <i className="fa-solid fa-star text-[9px]" />
                        <span>Bestseller</span>
                      </span>
                    )}
                  </div>

                  {/* Multi-image Navigation Controls */}
                  {hasMultiple && (
                    <>
                      {/* Prev Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImageIdx((prev) => (prev > 0 ? prev - 1 : gallery.length - 1));
                        }}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center text-xs cursor-pointer backdrop-blur-md transition-transform active:scale-90 border border-white/15 z-20"
                      >
                        <i className="fa-solid fa-chevron-left" />
                      </button>

                      {/* Next Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImageIdx((prev) => (prev < gallery.length - 1 ? prev + 1 : 0));
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center text-xs cursor-pointer backdrop-blur-md transition-transform active:scale-90 border border-white/15 z-20"
                      >
                        <i className="fa-solid fa-chevron-right" />
                      </button>

                      {/* Image Counter Badge */}
                      <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-[10px] font-mono text-white font-bold flex items-center gap-1.5 shadow-md border border-white/10 z-10">
                        <i className="fa-solid fa-camera text-[9px]" />
                        <span>{previewImageIdx + 1} / {gallery.length}</span>
                      </div>

                      {/* Dot Indicators */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                        {gallery.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImageIdx(idx);
                            }}
                            className={`h-1.5 rounded-full transition-all cursor-pointer ${
                              idx === previewImageIdx ? "w-5 bg-white shadow-sm" : "w-1.5 bg-white/40 hover:bg-white/70"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Scrollable Dish Details */}
            <div className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
              {/* Dish Name & Price */}
              <div>
                <h2 className="font-heading font-black text-2xl text-white tracking-tight leading-snug capitalize">
                  {selectedPreviewDish.name}
                </h2>

                <div className="mt-1.5 flex items-baseline gap-2.5">
                  <span className="font-mono font-black text-2xl text-emerald-400">
                    ₹{previewPortion === "half" ? selectedPreviewDish.half_price : selectedPreviewDish.price}
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-stone-800/80 text-stone-400 border border-stone-700/60 uppercase tracking-wider">
                    Inclusive of taxes
                  </span>
                </div>
              </div>

              {/* Highlights tags */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800/60 border border-stone-700/50 text-[11px] font-medium text-stone-300">
                  <span>🔥</span> Freshly Prepared
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800/60 border border-stone-700/50 text-[11px] font-medium text-stone-300">
                  <span>✨</span> Authentic Recipe
                </span>
                {selectedPreviewDish.is_veg ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-[11px] font-medium text-emerald-400">
                    <span>🌱</span> 100% Vegetarian
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/40 text-[11px] font-medium text-rose-400">
                    <span>🍗</span> Halal Prepared
                  </span>
                )}
              </div>

              {/* Description */}
              {selectedPreviewDish.description && (
                <div className="pt-2 border-t border-stone-800/60">
                  <p className="text-sm text-stone-300 leading-relaxed font-normal">
                    {selectedPreviewDish.description}
                  </p>
                </div>
              )}

              {/* Portion Selector (Full vs Half) if enabled */}
              {selectedPreviewDish.has_half_portion && (
                <div className="pt-2">
                  <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-2">
                    Select Portion
                  </span>
                  <div className="p-1 rounded-2xl bg-stone-900/90 border border-stone-800 grid grid-cols-2 gap-1.5 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setPreviewPortion("full")}
                      className={`py-3 px-3.5 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                        previewPortion === "full"
                          ? "bg-stone-800 text-white shadow-sm border border-stone-700"
                          : "text-stone-400 hover:text-stone-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Full Portion</span>
                        {previewPortion === "full" && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <span className="font-mono font-bold text-sm text-emerald-400 mt-1">
                        ₹{selectedPreviewDish.price}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewPortion("half")}
                      className={`py-3 px-3.5 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                        previewPortion === "half"
                          ? "bg-stone-800 text-white shadow-sm border border-stone-700"
                          : "text-stone-400 hover:text-stone-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Half Portion</span>
                        {previewPortion === "half" && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <span className="font-mono font-bold text-sm text-emerald-400 mt-1">
                        ₹{selectedPreviewDish.half_price}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            {(() => {
              const currentKey = `${selectedPreviewDish.id}:${previewPortion}`;
              const currentQty = cart[currentKey]?.qty || 0;
              const currentPrice = previewPortion === "half" ? selectedPreviewDish.half_price : selectedPreviewDish.price;

              return (
                <div className="p-4 pb-6 bg-stone-950/95 backdrop-blur-md border-t border-stone-800/80 flex items-center gap-3">
                  {currentQty === 0 ? (
                    <button
                      type="button"
                      onClick={() => addToCart(selectedPreviewDish, previewPortion)}
                      className="flex-1 py-4 px-5 rounded-2xl font-black text-white text-sm shadow-xl shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-700 tracking-wider uppercase"
                    >
                      <span>ADD TO ORDER ({previewPortion})</span>
                      <span className="font-mono text-base font-bold flex items-center gap-1.5">
                        ₹{currentPrice} <i className="fa-solid fa-arrow-right text-xs" />
                      </span>
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center justify-between bg-stone-900 border border-stone-700 rounded-2xl p-2 px-3 shadow-inner">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-stone-400 uppercase font-mono tracking-wider">
                          In Cart ({previewPortion})
                        </span>
                        <span className="font-mono font-bold text-white text-base">
                          ₹{currentPrice * currentQty}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center rounded-xl border border-stone-700 bg-stone-950 overflow-hidden text-sm font-bold font-mono shadow-sm">
                          <button
                            type="button"
                            onClick={() => removeFromCart(selectedPreviewDish.id, previewPortion)}
                            className="w-9 h-9 flex items-center justify-center text-stone-300 hover:text-white active:bg-stone-800"
                          >
                            −
                          </button>
                          <span className="px-3 text-white font-bold">{currentQty}</span>
                          <button
                            type="button"
                            onClick={() => addToCart(selectedPreviewDish, previewPortion)}
                            className="w-9 h-9 flex items-center justify-center text-amber-400 hover:text-amber-300 active:bg-stone-800"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPreviewDish(null);
                            setIsCheckoutOpen(true);
                          }}
                          className="py-2.5 px-4 rounded-xl font-extrabold text-xs text-white cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-md active:scale-95 transition-all"
                        >
                          Checkout →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
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
