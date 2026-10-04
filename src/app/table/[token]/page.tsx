"use client";

import { useEffect, useState, useCallback, useMemo, use } from "react";
import dynamic from "next/dynamic";
import FoodChefLoader from "@/components/FoodChefLoader";

import {
  RestaurantOfferConfig,
  DEFAULT_OFFER_CONFIG,
  RestaurantThemeType,
  RestaurantBrandingConfig,
  DEFAULT_BRANDING_CONFIG,
  SmartUpsellConfig,
  DEFAULT_UPSELL_CONFIG,
} from "@/lib/types/offers";

import {
  MenuItem,
  Category,
  ActiveOrder,
  ActiveOrderItem,
  RestaurantFeatures,
  CartMap,
  FlyingParticle,
  WaiterCallType,
  OrderStage,
  ScoredUpsell,
  PortionType,
  CancelledItemNotice,
} from "@/components/table/TableTypes";

import {
  triggerHaptic,
  matchesSearch,
  getCategoryIcon,
  getFoodEmoji,
  getSpiciness,
} from "@/components/table/tableUtils";

import TableWelcomeScreen from "@/components/table/TableWelcomeScreen";
import TableHeroBanner from "@/components/table/TableHeroBanner";
import TableLiveJourney from "@/components/table/TableLiveJourney";
import TableCompactStatus from "@/components/table/TableCompactStatus";
import TableDishCard from "@/components/table/TableDishCard";
import CallWaiterModal from "@/components/table/CallWaiterModal";
import TableUpiModal from "@/components/table/TableUpiModal";
import TableCategorySheet from "@/components/table/TableCategorySheet";
import TableCartDrawer from "@/components/table/TableCartDrawer";
import DishPreviewModal from "@/components/table/DishPreviewModal";
import TableDispatchModal from "@/components/table/TableDispatchModal";
import TableOrderHistory from "@/components/table/TableOrderHistory";
import TableAiWaiterModal from "@/components/table/TableAiWaiterModal";
import TableVoiceOrderModal from "@/components/table/TableVoiceOrderModal";
import TableOnlineOrderBanner from "@/components/table/TableOnlineOrderBanner";
import TableOfferPopupModal from "@/components/table/TableOfferPopupModal";

const ScratchCardModal = dynamic(
  () => import("@/components/table/ScratchCardModal"),
  { ssr: false }
);

export default function CustomerTableOrderingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const { token } = resolvedParams;

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [restaurantName, setRestaurantName] = useState("Order Desk");
  const [restaurantId, setRestaurantId] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [joinedNotice, setJoinedNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState<RestaurantThemeType>("amber");
  const [branding, setBranding] = useState<RestaurantBrandingConfig>(
    DEFAULT_BRANDING_CONFIG
  );
  const [restaurantSlug, setRestaurantSlug] = useState<string>("");

  // Feature Entitlements controlled by Super Admin
  const [features, setFeatures] = useState<RestaurantFeatures>({
    callWaiter: true,
    prepTimeTracker: true,
    customRequests: true,
    tablePayUpi: true,
    dishNotes: true,
    smartUpsell: true,
    feedbackReview: true,
    loyaltyOffers: true,
    waiterOrderApproval: true,
    quickAdds: false,
    showTableFooter: false,
    halfFullPortions: true,
    onlineOrdering: true,
  });

  const [isApprovalPending, setIsApprovalPending] = useState<boolean>(false);
  const [cancelledItems, setCancelledItems] = useState<CancelledItemNotice[]>([]);
  const [cancelledOrderNotice, setCancelledOrderNotice] = useState<{
    orderId?: string;
    reason: string;
    cancelledAt: string;
  } | null>(null);
  const [dismissedCancelledId, setDismissedCancelledId] = useState<string | null>(null);
  const [waiterWhatsappUrl, setWaiterWhatsappUrl] = useState<string>("");

  // Dynamic Restaurant Offers & Retention Config
  const [offerConfig, setOfferConfig] = useState<RestaurantOfferConfig>(
    DEFAULT_OFFER_CONFIG
  );
  const [upsellConfig, setUpsellConfig] = useState<SmartUpsellConfig>(
    DEFAULT_UPSELL_CONFIG
  );
  const [isScratchModalOpen, setIsScratchModalOpen] = useState(false);
  const [isOfferDismissed, setIsOfferDismissed] = useState<boolean>(false);

  // Flow State
  const [hasDismissedWelcome, setHasDismissedWelcome] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(`od_welcomed_${token}`) === "true";
    }
    return false;
  });

  // Fast Dietary & Category Filters
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [dietFilter, setDietFilter] = useState<
    "all" | "veg" | "nonveg" | "bestseller" | "under_199" | "spicy"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Cart: Map<menuItemId, { qty: number, notes: string, addedBy: string }>
  const [cart, setCart] = useState<CartMap>({});
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState("");
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [isJourneySheetOpen, setIsJourneySheetOpen] = useState<boolean>(false);
  const [urlLayoutParam, setUrlLayoutParam] = useState<string | null>(null);

  // Auto-dismiss order success notification after 4.5s to prevent screen clutter
  useEffect(() => {
    if (!orderSuccessMsg) return;
    const timer = setTimeout(() => {
      setOrderSuccessMsg("");
    }, 4500);
    return () => clearTimeout(timer);
  }, [orderSuccessMsg]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const l = sp.get("layout");
      if (
        l === "floating_capsule" ||
        l === "split_card" ||
        l === "slim_accordion"
      ) {
        setUrlLayoutParam(l);
      }
    }
  }, []);

  const currentJourneyLayout:
    | "floating_capsule"
    | "split_card"
    | "slim_accordion" =
    (urlLayoutParam as any) ||
    features.orderJourneyLayout ||
    "floating_capsule";

  // Call Waiter / Buzzer state
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [waiterCallSuccess, setWaiterCallSuccess] = useState("");
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [customCallNote, setCustomCallNote] = useState("");
  const [billPaymentMode, setBillPaymentMode] = useState<
    "upi" | "cash" | "card"
  >("upi");
  const [waiterCooldown, setWaiterCooldown] = useState<number>(0);
  const [showUpiQrModal, setShowUpiQrModal] = useState(false);

  // Post-meal rating state
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [isTicketExpanded, setIsTicketExpanded] = useState(false);
  const [previewDish, setPreviewDish] = useState<MenuItem | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  // Micro-interaction & Feature States
  const [flyingParticles, setFlyingParticles] = useState<FlyingParticle[]>([]);
  const [isCartBouncing, setIsCartBouncing] = useState<boolean>(false);
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isAiWaiterOpen, setIsAiWaiterOpen] = useState<boolean>(false);
  const [isVoiceOrderOpen, setIsVoiceOrderOpen] = useState<boolean>(false);
  const [quickAddNotice, setQuickAddNotice] = useState<string>("");

  // Ensure body scroll and touch gestures are strictly unlocked on mount
  useEffect(() => {
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
    document.documentElement.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  // Lock body scroll only when a fullscreen modal or sheet is open
  useEffect(() => {
    const isModalOpen = Boolean(
      previewDish ||
      isReviewOpen ||
      isCallModalOpen ||
      isHistoryOpen ||
      isCategorySheetOpen ||
      showUpiQrModal ||
      isScratchModalOpen ||
      isAiWaiterOpen ||
      isVoiceOrderOpen ||
      showDispatchModal
    );

    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.documentElement.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.documentElement.style.overflow = "";
    };
  }, [
    previewDish,
    isReviewOpen,
    isCallModalOpen,
    isHistoryOpen,
    isCategorySheetOpen,
    showUpiQrModal,
    isScratchModalOpen,
    isAiWaiterOpen,
    isVoiceOrderOpen,
    showDispatchModal,
  ]);

  const handleBatchAddToCart = (itemsToAdd: Array<{ dishId: string; qty: number; portion: PortionType }>) => {
    itemsToAdd.forEach((it) => {
      for (let i = 0; i < it.qty; i++) {
        addToCart(it.dishId, it.portion);
      }
    });
  };

  // Live timer tick
  const [nowTime, setNowTime] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (waiterCooldown > 0) {
      const cdTimer = setInterval(() => {
        setWaiterCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(cdTimer);
    }
  }, [waiterCooldown]);

  // SWR Caching Engine: Instantly hydrate from localStorage in 0.05s
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(`od_cache_${token}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.restaurant?.name) setRestaurantName(parsed.restaurant.name);
          if (parsed.restaurant?.id) setRestaurantId(parsed.restaurant.id);
          if (parsed.restaurant?.slug) setRestaurantSlug(parsed.restaurant.slug);
          if (parsed.table?.table_number)
            setTableNumber(parsed.table.table_number);
          if (parsed.categories?.length) setCategories(parsed.categories);
          if (parsed.items?.length) setItems(parsed.items);
          if (parsed.branding) {
            setBranding(parsed.branding);
            if (parsed.branding.theme) setTheme(parsed.branding.theme);
          } else if (parsed.theme) {
            setTheme(parsed.theme);
          }
          if (parsed.features) setFeatures(parsed.features);
          if (parsed.offerConfig) setOfferConfig(parsed.offerConfig);
          if (parsed.upsellConfig) setUpsellConfig(parsed.upsellConfig);
          setIsLoading(false);
        }
      } catch {
        // ignore
      }
    }
  }, [token]);

  const loadTableData = useCallback(
    async (statusOnly = false) => {
      try {
        const url = statusOnly
          ? `/api/public/table/${token}?poll=status`
          : `/api/public/table/${token}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Failed to load table details");

        if (data.statusOnly) {
          setActiveOrder(data.activeOrder || null);
          if (data.isApprovalPending !== undefined)
            setIsApprovalPending(Boolean(data.isApprovalPending));
          if (data.joinedNotice !== undefined)
            setJoinedNotice(data.joinedNotice);
          if (data.cancelledItems !== undefined)
            setCancelledItems(data.cancelledItems);
          if (data.cancelledOrderNotice !== undefined)
            setCancelledOrderNotice(data.cancelledOrderNotice);
          return;
        }

        setRestaurantName(data.restaurant?.name || "Order Desk");
        if (data.restaurant?.id) setRestaurantId(data.restaurant.id);
        if (data.restaurant?.slug) setRestaurantSlug(data.restaurant.slug);
        setTableNumber(data.table?.table_number || "T--");
        setCategories(data.categories || []);
        setItems(data.items || []);
        setActiveOrder(data.activeOrder || null);
        if (data.isApprovalPending !== undefined)
          setIsApprovalPending(Boolean(data.isApprovalPending));
        if (data.joinedNotice !== undefined)
          setJoinedNotice(data.joinedNotice);
        if (data.cancelledItems !== undefined)
          setCancelledItems(data.cancelledItems);
        if (data.cancelledOrderNotice !== undefined)
          setCancelledOrderNotice(data.cancelledOrderNotice);
        if (data.branding) {
          setBranding(data.branding);
          if (data.branding.theme) setTheme(data.branding.theme);
        } else if (data.theme) {
          setTheme(data.theme);
        }
        if (data.features) setFeatures(data.features);
        if (data.offerConfig) setOfferConfig(data.offerConfig);
        if (data.upsellConfig) setUpsellConfig(data.upsellConfig);

        try {
          localStorage.setItem(`od_cache_${token}`, JSON.stringify(data));
        } catch {
          // ignore quota
        }
      } catch (err) {
        if (!statusOnly) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : "Error connecting to restaurant."
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    let isMounted = true;
    fetch(`/api/public/table/${token}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        setRestaurantName(data.restaurant?.name || "Order Desk");
        if (data.restaurant?.slug) setRestaurantSlug(data.restaurant.slug);
        setTableNumber(data.table?.table_number || "T--");
        setCategories(data.categories || []);
        setItems(data.items || []);
        setActiveOrder(data.activeOrder || null);
        if (data.isApprovalPending !== undefined)
          setIsApprovalPending(Boolean(data.isApprovalPending));
        if (data.joinedNotice !== undefined)
          setJoinedNotice(data.joinedNotice);
        if (data.cancelledItems !== undefined)
          setCancelledItems(data.cancelledItems);
        if (data.cancelledOrderNotice !== undefined)
          setCancelledOrderNotice(data.cancelledOrderNotice);
        if (data.branding) {
          setBranding(data.branding);
          if (data.branding.theme) setTheme(data.branding.theme);
        } else if (data.theme) {
          setTheme(data.theme);
        }
        if (data.features) setFeatures(data.features);
        if (data.offerConfig) setOfferConfig(data.offerConfig);
        if (data.upsellConfig) setUpsellConfig(data.upsellConfig);
        try {
          localStorage.setItem(`od_cache_${token}`, JSON.stringify(data));
        } catch {
          // ignore
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Error connecting to restaurant."
        );
        setIsLoading(false);
      });

    let pollInterval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => {
        if (
          typeof document !== "undefined" &&
          document.visibilityState === "hidden"
        ) {
          return;
        }
        loadTableData(true);
      }, 3500);
    };

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined") {
        if (document.visibilityState === "visible") {
          loadTableData(true);
          startPolling();
        } else if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }
    };

    startPolling();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
      }
    };
  }, [token, loadTableData]);

  function addToCart(
    itemOrKey: string,
    portion: PortionType = "full",
    e?: React.MouseEvent<any> | React.TouchEvent<any>
  ) {
    triggerHaptic(14);

    const cartKey = itemOrKey.includes("__") ? itemOrKey : `${itemOrKey}__${portion}`;
    const rawDishId = itemOrKey.includes("__") ? itemOrKey.split("__")[0] : itemOrKey;
    const finalPortion = itemOrKey.includes("__") ? (itemOrKey.split("__")[1] as PortionType) : portion;

    if (e && e.currentTarget && typeof window !== "undefined") {
      try {
        const rect = e.currentTarget.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;
        const targetX = window.innerWidth / 2;
        const targetY = window.innerHeight - 35;
        const item = items.find((i) => i.id === rawDishId);
        const emoji = item ? getFoodEmoji(item.name, item.is_veg) : "✨";

        const newP: FlyingParticle = {
          id: Date.now() + Math.random(),
          x: startX,
          y: startY,
          tx: targetX - startX,
          ty: targetY - startY,
          emoji,
        };

        setFlyingParticles((prev) => [...prev, newP]);

        setTimeout(() => {
          setFlyingParticles((prev) => prev.filter((p) => p.id !== newP.id));
          setIsCartBouncing(true);
          setTimeout(() => setIsCartBouncing(false), 380);
        }, 620);
      } catch {
        setIsCartBouncing(true);
        setTimeout(() => setIsCartBouncing(false), 380);
      }
    } else {
      setIsCartBouncing(true);
      setTimeout(() => setIsCartBouncing(false), 380);
    }

    setCart((prev) => {
      const current = prev[cartKey] || {
        dishId: rawDishId,
        portion: finalPortion,
        qty: 0,
        notes: finalPortion === "half" ? "Half Portion" : "",
        addedBy: customerName.trim() || "You",
      };
      return {
        ...prev,
        [cartKey]: { ...current, qty: current.qty + 1 },
      };
    });
  }

  function removeFromCart(itemOrKey: string, portion: PortionType = "full") {
    triggerHaptic(8);
    const cartKey = itemOrKey.includes("__") ? itemOrKey : `${itemOrKey}__${portion}`;
    setCart((prev) => {
      const targetKey = prev[cartKey] ? cartKey : prev[itemOrKey] ? itemOrKey : cartKey;
      const current = prev[targetKey];
      if (!current || current.qty <= 1) {
        const copy = { ...prev };
        delete copy[targetKey];
        return copy;
      }
      return {
        ...prev,
        [targetKey]: { ...current, qty: current.qty - 1 },
      };
    });
  }

  function handleReorderItem(item: ActiveOrderItem) {
    triggerHaptic(16);
    if (item.menu_item_id) {
      const portion: PortionType = item.notes?.toLowerCase().includes("half") ? "half" : "full";
      addToCart(item.menu_item_id, portion);
      setIsReviewOpen(true);
    }
  }

  async function handleCancelOrderItem(orderId: string, itemId: string): Promise<boolean> {
    try {
      const res = await fetch("/api/public/order/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          orderId,
          orderItemId: itemId,
          action: "cancel",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to cancel item.");
        return false;
      }
      // Optimistically remove item from active order
      setActiveOrder((prev) => {
        if (!prev) return null;
        const updated = prev.order_items.filter((it) => it.id !== itemId);
        return { ...prev, order_items: updated };
      });
      // Synchronize with server state
      loadTableData(true);
      return true;
    } catch (err) {
      console.error("Cancel order item error:", err);
      return false;
    }
  }

  async function handleUpdateOrderItemQty(
    orderId: string,
    itemId: string,
    newQty: number
  ): Promise<boolean> {
    try {
      const res = await fetch("/api/public/order/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          orderId,
          orderItemId: itemId,
          action: "update_qty",
          qty: newQty,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to update item quantity.");
        return false;
      }
      // Optimistically update item qty in active order
      setActiveOrder((prev) => {
        if (!prev) return null;
        const updated = prev.order_items.map((it) =>
          it.id === itemId ? { ...it, qty: newQty } : it
        );
        return { ...prev, order_items: updated };
      });
      // Synchronize with server state
      loadTableData(true);
      return true;
    } catch (err) {
      console.error("Update order item qty error:", err);
      return false;
    }
  }

  // Cart calculations
  const cartEntries = Object.entries(cart).filter(([, val]) => val.qty > 0);
  const totalCartCount = cartEntries.reduce(
    (sum, [, val]) => sum + val.qty,
    0
  );
  const subtotalCart = cartEntries.reduce((sum, [key, val]) => {
    const [dishId, portion] = key.split("__");
    const item = items.find((i) => i.id === dishId);
    if (!item) return sum;
    const isHalf = portion === "half";
    const unitPrice = isHalf ? Math.round(Number(item.price) * 0.6) : Number(item.price);
    return sum + unitPrice * val.qty;
  }, 0);

  const isOfferActive =
    features.loyaltyOffers !== false && offerConfig.active;
  const discountApplicable =
    isOfferActive && subtotalCart >= offerConfig.minOrderValue;
  const discountAmount = discountApplicable
    ? Math.round(subtotalCart * (offerConfig.discountPercent / 100))
    : 0;
  const discountedSubtotal = Math.max(0, subtotalCart - discountAmount);

  const cgst = Math.round(discountedSubtotal * 0.025 * 100) / 100;
  const sgst = Math.round(discountedSubtotal * 0.025 * 100) / 100;
  const grandTotal = Math.round(discountedSubtotal + cgst + sgst);

  const activeOrderSubtotal = (activeOrder?.order_items || []).reduce(
    (sum, item) => sum + Number(item.unit_price) * item.qty,
    0
  );
  const activeOrderCgst =
    Math.round(activeOrderSubtotal * 0.025 * 100) / 100;
  const activeOrderSgst =
    Math.round(activeOrderSubtotal * 0.025 * 100) / 100;
  const activeOrderGrandTotal = Math.round(
    activeOrderSubtotal + activeOrderCgst + activeOrderSgst
  );
  const payableBillTotal =
    activeOrderGrandTotal > 0 ? activeOrderGrandTotal : grandTotal;

  const quickReorderCandidates = items
    .filter((it) => {
      const n = it.name.toLowerCase();
      return (
        n.includes("roti") ||
        n.includes("naan") ||
        n.includes("paratha") ||
        n.includes("kulcha") ||
        n.includes("water") ||
        n.includes("coke") ||
        n.includes("soda") ||
        n.includes("drink") ||
        n.includes("beverage") ||
        n.includes("lassi") ||
        n.includes("rice") ||
        n.includes("papad") ||
        n.includes("raita") ||
        it.is_bestseller
      );
    })
    .slice(0, 10);

  const upsellCandidates = useMemo((): ScoredUpsell[] => {
    if (!features.smartUpsell || !upsellConfig.enabled) return [];

    const cartDishIds = Object.keys(cart);
    const cartDishList = cartDishIds
      .map((id) => items.find((i) => i.id === id))
      .filter(Boolean) as MenuItem[];

    const availableItems = items.filter(
      (it) => it.is_available && !cart[it.id]
    );
    if (availableItems.length === 0) return [];

    const isCartPureVeg =
      cartDishList.length > 0 && cartDishList.every((it) => it.is_veg);
    const dietaryCandidates = isCartPureVeg
      ? availableItems.filter((it) => it.is_veg)
      : availableItems;

    const hasCurry = cartDishList.some((it) => {
      const n = it.name.toLowerCase();
      const d = (it.description || "").toLowerCase();
      return (
        n.includes("curry") ||
        n.includes("dal") ||
        n.includes("gravy") ||
        n.includes("masala") ||
        n.includes("paneer") ||
        n.includes("butter chicken") ||
        d.includes("curry") ||
        d.includes("gravy")
      );
    });

    const hasBreadsOrRice = cartDishList.some((it) => {
      const n = it.name.toLowerCase();
      return (
        n.includes("roti") ||
        n.includes("naan") ||
        n.includes("paratha") ||
        n.includes("kulcha") ||
        n.includes("bread") ||
        n.includes("rice") ||
        n.includes("biryani") ||
        n.includes("pulao")
      );
    });

    const hasStartersOrSpicy = cartDishList.some((it) => {
      const n = it.name.toLowerCase();
      return (
        n.includes("tikka") ||
        n.includes("kebab") ||
        n.includes("starter") ||
        n.includes("fry") ||
        n.includes("chilli") ||
        n.includes("schezwan") ||
        n.includes("crispy") ||
        n.includes("tandoor")
      );
    });

    const hasDrinks = cartDishList.some((it) => {
      const n = it.name.toLowerCase();
      return (
        n.includes("coke") ||
        n.includes("soda") ||
        n.includes("mojito") ||
        n.includes("shake") ||
        n.includes("lassi") ||
        n.includes("juice") ||
        n.includes("water") ||
        n.includes("drink") ||
        n.includes("beverage") ||
        n.includes("chai") ||
        n.includes("coffee") ||
        n.includes("cooler")
      );
    });

    const hasDessert = cartDishList.some((it) => {
      const n = it.name.toLowerCase();
      return (
        n.includes("ice cream") ||
        n.includes("gulab") ||
        n.includes("sweet") ||
        n.includes("halwa") ||
        n.includes("kheer") ||
        n.includes("cake") ||
        n.includes("brownie") ||
        n.includes("dessert") ||
        n.includes("kulfi")
      );
    });

    const spendGap = offerConfig.active
      ? offerConfig.minOrderValue - subtotalCart
      : 0;
    const isNearSpendGoal =
      offerConfig.active && spendGap > 0 && spendGap <= 160;

    const scored: ScoredUpsell[] = [];

    for (const item of dietaryCandidates) {
      const n = item.name.toLowerCase();
      const p = Number(item.price);
      let score = 0;
      let reasonTag = "Chef Pick";
      let reasonIcon = "✨";

      if (
        upsellConfig.showSpendGoalNudge &&
        isNearSpendGoal &&
        p >= spendGap - 25 &&
        p <= spendGap + 70
      ) {
        score += 85;
        reasonTag = `Unlock ${offerConfig.discountPercent}% OFF`;
        reasonIcon = "🎁";
      }

      if (hasCurry && !hasBreadsOrRice) {
        if (
          n.includes("naan") ||
          n.includes("roti") ||
          n.includes("paratha") ||
          n.includes("kulcha") ||
          n.includes("jeera rice")
        ) {
          score += 65;
          reasonTag = "Pairs with Curry";
          reasonIcon = "🫓";
        }
      }

      if (
        upsellConfig.pushBeveragesWithStarters &&
        hasStartersOrSpicy &&
        !hasDrinks
      ) {
        if (
          n.includes("lassi") ||
          n.includes("mojito") ||
          n.includes("shake") ||
          n.includes("cooler") ||
          n.includes("soda") ||
          n.includes("coke") ||
          n.includes("juice") ||
          n.includes("drink")
        ) {
          score += 60;
          reasonTag = "Cooling Drink Pair";
          reasonIcon = "🥤";
        }
      }

      if (
        upsellConfig.pushDessertsNearCheckout &&
        (subtotalCart >= 250 || cartDishList.length >= 2) &&
        !hasDessert
      ) {
        if (
          n.includes("ice cream") ||
          n.includes("gulab") ||
          n.includes("halwa") ||
          n.includes("kheer") ||
          n.includes("brownie") ||
          n.includes("kulfi")
        ) {
          score += 55;
          reasonTag = "Sweet Finish";
          reasonIcon = "🍨";
        }
      }

      if (upsellConfig.strategy === "bestsellers") {
        if (item.is_bestseller) {
          score += 40;
          if (reasonTag === "Chef Pick") {
            reasonTag = "Bestseller";
            reasonIcon = "🔥";
          }
        }
      } else if (upsellConfig.strategy === "high_margin") {
        if (
          n.includes("beverage") ||
          n.includes("drink") ||
          n.includes("shake") ||
          n.includes("papad") ||
          n.includes("raita") ||
          n.includes("starter") ||
          n.includes("tikka")
        ) {
          score += 35;
          if (reasonTag === "Chef Pick") {
            reasonTag = "Popular Add-on";
            reasonIcon = "⭐";
          }
        }
      } else if (upsellConfig.strategy === "budget_addons") {
        if (p <= 120) {
          score += 45;
          if (reasonTag === "Chef Pick") {
            reasonTag = "Quick Add-on";
            reasonIcon = "⚡";
          }
        }
      } else {
        if (item.is_bestseller) score += 20;
        if (p <= 150) score += 10;
      }

      if (score === 0) {
        if (item.is_bestseller) {
          score = 15;
          reasonTag = "Crowd Favorite";
          reasonIcon = "🔥";
        } else if (p <= 110) {
          score = 10;
          reasonTag = "Budget Add-on";
          reasonIcon = "⚡";
        } else {
          score = 5;
        }
      }

      scored.push({
        id: item.id,
        name: item.name,
        price: p,
        is_veg: item.is_veg,
        photo_url: item.photo_url,
        reasonTag,
        reasonIcon,
        score,
      });
    }

    scored.sort((a, b) => (b.score || 0) - (a.score || 0));
    const maxLimit = Math.min(6, Math.max(1, upsellConfig.maxItems || 3));
    return scored.slice(0, maxLimit);
  }, [
    cart,
    items,
    features.smartUpsell,
    upsellConfig,
    offerConfig,
    subtotalCart,
  ]);

  async function handlePlaceOrder() {
    if (cartEntries.length === 0) return;
    triggerHaptic(25);
    setIsSubmitting(true);
    setOrderSuccessMsg("");

    try {
      const payload = {
        token,
        customerName: customerName.trim() || "Dine-in Guest",
        items: cartEntries.map(([key, val]) => {
          const [id, portion] = key.split("__");
          return {
            menuItemId: id,
            portion: (portion === "half" ? "half" : "full") as PortionType,
            qty: val.qty,
            notes: val.notes || (portion === "half" ? "Half Portion" : undefined),
          };
        }),
      };

      const res = await fetch("/api/public/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit order");

      setCart({});
      setIsReviewOpen(false);
      setShowDispatchModal(true);
      triggerHaptic(25);
      if (data.approvalPending) {
        setIsApprovalPending(true);
        setOrderSuccessMsg(
          "Order dispatched! Floor captain will verify items at your table shortly."
        );
      } else {
        setOrderSuccessMsg("Order sent to kitchen! Cooking begins immediately.");
      }
      await loadTableData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to place order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCallWaiter(
    type: WaiterCallType,
    customNote?: string,
    paymentMode?: "upi" | "cash" | "card"
  ) {
    if (waiterCooldown > 0) return;
    triggerHaptic(20);
    setIsCallingWaiter(true);
    setWaiterCallSuccess("");
    try {
      const res = await fetch("/api/public/table/call-waiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type, customNote, paymentMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to notify staff");

      const label =
        type === "water"
          ? "Water refill request"
          : type === "bill"
          ? `Bill request (${
              paymentMode === "upi" ? "UPI QR Instant" : "Cash/Card"
            })`
          : type === "clean"
          ? "Table clearing request"
          : type === "cutlery"
          ? "Extra Cutlery & Napkins"
          : type === "condiments"
          ? "Dips & Chutney request"
          : type === "chair"
          ? "Baby High Chair request"
          : type === "ac"
          ? "AC temperature request"
          : customNote
          ? `Special request: "${customNote}"`
          : "Staff assistance request";

      setWaiterCallSuccess(`${label} received! Staff buzzer is sounding.`);
      if (data.whatsappWebUrl) {
        setWaiterWhatsappUrl(data.whatsappWebUrl);
      } else {
        setWaiterWhatsappUrl("");
      }
      setIsCallModalOpen(false);
      setCustomCallNote("");
      setWaiterCooldown(45);

      if (type === "bill" && paymentMode === "upi") {
        setShowUpiQrModal(true);
      }

      setTimeout(() => {
        setWaiterCallSuccess("");
        setWaiterWhatsappUrl("");
      }, 9000);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Could not notify staff. Please try again."
      );
    } finally {
      setIsCallingWaiter(false);
    }
  }

  const filteredItems = items.filter((item) => {
    if (dietFilter === "veg" && !item.is_veg) return false;
    if (dietFilter === "nonveg" && item.is_veg) return false;
    if (dietFilter === "bestseller" && !item.is_bestseller) return false;
    if (dietFilter === "under_199" && Number(item.price) > 199) return false;
    if (
      dietFilter === "spicy" &&
      getSpiciness(item.name, item.description) !== "spicy"
    )
      return false;
    if (selectedCat !== "all" && item.category_id !== selectedCat) return false;
    return matchesSearch(searchQuery, item.name, item.description);
  });

  let activeStage: OrderStage = "placed";
  if (activeOrder && activeOrder.order_items.length > 0) {
    if (activeOrder.order_items.every((it) => it.item_status === "served")) {
      activeStage = "served";
    } else if (
      activeOrder.order_items.some((it) => it.item_status === "preparing")
    ) {
      activeStage = "preparing";
    }
  }

  let remainingMinutesText = "";
  if (activeOrder?.prepEstimate) {
    const elapsedSecs = Math.max(
      0,
      Math.floor(
        (nowTime - new Date(activeOrder.prepEstimate.setAt).getTime()) / 1000
      )
    );
    const totalSecs = activeOrder.prepEstimate.minutes * 60;
    const remainingSecs = Math.max(0, totalSecs - elapsedSecs);
    const remMins = Math.floor(remainingSecs / 60);
    const remSecs = remainingSecs % 60;
    remainingMinutesText = `${remMins}:${remSecs.toString().padStart(2, "0")}`;
  }

  // 1. Loading State
  if (isLoading) {
    return (
      <div
        data-theme={theme}
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <FoodChefLoader
          variant="light"
          restaurantName={restaurantName}
          tableNumber={tableNumber}
          message="Connecting to your table station..."
          subMessage="Chef is preparing your instant digital menu..."
          size="lg"
        />
      </div>
    );
  }

  // 2. Error State
  if (errorMsg && items.length === 0) {
    return (
      <div
        data-theme={theme}
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: "var(--paper)" }}
      >
        <div
          className="max-w-sm w-full text-center p-6 rounded-xl border shadow-lg"
          style={{
            backgroundColor: "var(--paper)",
            borderColor: "var(--hairline)",
          }}
        >
          <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center text-xl bg-red-100 text-red-700">
            ⚠️
          </div>
          <div
            className="font-heading text-xl font-bold mb-1"
            style={{ color: "var(--brick)" }}
          >
            Table Link Unavailable
          </div>
          <p className="text-xs mb-5" style={{ color: "var(--ink-soft)" }}>
            {errorMsg}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 text-xs font-bold rounded-lg shadow cursor-pointer transition-all active:scale-95"
            style={{
              backgroundColor: "var(--rust)",
              color: "var(--rust-text)",
            }}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // 3. STEP 1: POST-SCAN WELCOME
  if (!hasDismissedWelcome) {
    return (
      <TableWelcomeScreen
        theme={theme}
        branding={branding}
        restaurantName={restaurantName}
        tableNumber={tableNumber}
        offerConfig={offerConfig}
        onExplore={() => {
          setHasDismissedWelcome(true);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`od_welcomed_${token}`, "true");
          }
        }}
      />
    );
  }

  // 4. STEP 2: MAIN MENU & ORDERING INTERFACE
  return (
    <div
      data-theme={theme}
      className="min-h-screen max-w-md mx-auto flex flex-col pb-32 overflow-x-hidden touch-pan-y"
      style={{
        backgroundColor: "var(--paper)",
        color: "var(--ink)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Sticky Table Header */}
      <TableHeroBanner
        restaurantName={restaurantName}
        tableNumber={tableNumber}
        branding={branding}
        features={features}
        waiterCooldown={waiterCooldown}
        onOpenCallModal={() => setIsCallModalOpen(true)}
      />

      {/* Joined / Group Table Banner */}
      {joinedNotice && (
        <div
          className="mx-4 mt-3 p-3 rounded-xl text-xs font-semibold border flex items-center justify-between shadow-xs animate-fade-in"
          style={{
            backgroundColor: "#FEF3C7",
            borderColor: "#FDE68A",
            color: "#92400E",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🔗</span>
            <span>{joinedNotice}</span>
          </div>
        </div>
      )}

      {/* Buzzer Alert Banner */}
      {waiterCallSuccess && (
        <div
          className="mx-4 mt-3 p-3.5 rounded-xl text-xs font-semibold border flex items-center justify-between shadow-sm animate-fade-in"
          style={{
            backgroundColor: "#EFF6EF",
            color: "var(--sage)",
            borderColor: "#C5D8C3",
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">🛎️</span>
            <span>{waiterCallSuccess}</span>
            {waiterWhatsappUrl && (
              <a
                href={waiterWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 shadow-xs"
              >
                <span>💬 WhatsApp</span>
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setWaiterCallSuccess("")}
            className="text-xs font-bold text-stone-500 p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Cancelled Order Notice (When Full Order Was Cancelled by Staff) */}
      {cancelledOrderNotice && !activeOrder && (
        <div className="mx-4 mt-3 p-4 rounded-xl border border-red-200 bg-red-50/95 shadow-sm text-center space-y-2 animate-in fade-in">
          <div className="w-10 h-10 mx-auto rounded-full bg-red-100 flex items-center justify-center text-lg text-red-600">
            ❌
          </div>
          <div>
            <div className="text-sm font-bold text-red-900">Order Cancelled by Captain</div>
            <p className="text-xs text-red-700 mt-1">
              {cancelledOrderNotice.reason || "Your order was cancelled by restaurant floor staff."}
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              You haven&apos;t been charged. Please call your captain or place a new order below.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsCallModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white shadow-xs cursor-pointer hover:bg-red-700 transition-colors"
            >
              🛎️ Call Waiter
            </button>
            <button
              type="button"
              onClick={() => setCancelledOrderNotice(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 bg-white text-stone-700 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Cancelled Item Notification Alert */}
      {cancelledItems.length > 0 && dismissedCancelledId !== cancelledItems[0].id && (
        <div className="mx-4 mt-3 p-3.5 rounded-xl border border-red-200 bg-red-50 flex items-start justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <span className="text-lg mt-0.5">⚠️</span>
            <div>
              <div className="text-xs font-bold text-red-900">
                Dish Cancelled by Staff
              </div>
              <p className="text-[11px] text-red-800 mt-0.5">
                <span className="font-semibold">&quot;{cancelledItems[0].dishName}&quot;</span> (Qty: {cancelledItems[0].qty}) was cancelled by captain/kitchen: <em>{cancelledItems[0].reason}</em>
              </p>
              <p className="text-[10px] text-red-600 mt-1">
                Your order total has been adjusted automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedCancelledId(cancelledItems[0].id)}
            className="text-stone-400 hover:text-stone-700 text-xs font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Compact Order Status */}
      {activeOrder && activeOrder.order_items.length > 0 && (
        <TableCompactStatus
          activeOrder={activeOrder}
          activeStage={activeStage}
          isApprovalPending={isApprovalPending}
          remainingMinutesText={remainingMinutesText}
        />
      )}

      {/* Post-Meal Dining Feedback */}
      {features.feedbackReview && activeStage === "served" && (
        <div
          className="mx-4 mt-3 p-4 rounded-xl border shadow-xs text-center bg-white space-y-2"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div className="text-xs font-bold text-stone-800">
            How was your dining experience at Table {tableNumber}?
          </div>
          {!feedbackSubmitted ? (
            <div className="flex items-center justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    setFeedbackRating(star);
                    setFeedbackSubmitted(true);
                  }}
                  className="text-xl cursor-pointer hover:scale-110 transition-transform p-1 text-amber-500"
                >
                  <i className={star <= (feedbackRating || 0) ? "fa-solid fa-star" : "fa-regular fa-star text-stone-300"} />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs font-medium text-emerald-800 py-1">
              Thank you for dining with us. Your feedback has been shared with restaurant management.
            </div>
          )}
        </div>
      )}



      {/* Success Notification */}
      {orderSuccessMsg && (
        <div
          className="mx-4 mt-3 p-3 rounded-xl text-xs font-semibold border shadow-sm flex items-center justify-between animate-fade-in"
          style={{
            backgroundColor: "#EFF6EF",
            color: "var(--sage)",
            borderColor: "#C5D8C3",
          }}
        >
          <div className="flex items-center gap-2">
            <span>🎉</span>
            <span>{orderSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setOrderSuccessMsg("")}
            className="text-xs font-bold text-stone-500 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Small Offer Banner */}
      {features.loyaltyOffers !== false && offerConfig.active && !isOfferDismissed && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg border flex items-center justify-between" style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}>
          <span className="text-xs font-semibold text-amber-900 truncate">
            🔥 {offerConfig.bannerText || `FLAT ${offerConfig.discountPercent}% OFF on orders above ₹${offerConfig.minOrderValue}`}
          </span>
          <button type="button" onClick={() => setIsOfferDismissed(true)} className="text-stone-400 hover:text-stone-600 text-xs ml-2 cursor-pointer shrink-0">✕</button>
        </div>
      )}

      {/* Menu Section */}
      <div id="menu-catalog-start" className="px-4 pt-4 pb-2 space-y-3">
        {/* Menu Heading & AI Waiter Pill */}
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold" style={{ color: "var(--ink)" }}>
            Menu
          </h2>
          {features.aiWaiter !== false && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setIsAiWaiterOpen(true);
              }}
              className="relative group px-3.5 py-1.5 rounded-full text-xs font-bold border border-amber-300 bg-linear-to-r from-amber-50 via-orange-50 to-amber-100 hover:from-amber-100 hover:to-orange-100 text-amber-950 flex items-center gap-1.5 shadow-2xs hover:shadow-xs cursor-pointer transition-all active:scale-95"
            >
              <span className="relative flex items-center justify-center w-4 h-4 text-amber-600 animate-ai-sparkle">
                <i className="fa-solid fa-wand-magic-sparkles text-xs" />
              </span>
              <span className="font-bold tracking-tight">Ask AI Waiter</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping ml-0.5" />
            </button>
          )}
        </div>

        {/* Search Bar + Voice Ordering Mic */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: "var(--paper-dim)",
                borderColor: "var(--hairline)",
                color: "var(--ink)",
              }}
            />
            <span className="absolute left-3 top-3 text-sm text-stone-400">
              <i className="fa-solid fa-magnifying-glass" />
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-sm text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {features.aiVoiceOrder !== false && (
            <button
              type="button"
              title="Voice Ordering (Speak to Order)"
              onClick={() => {
                triggerHaptic(12);
                setIsVoiceOrderOpen(true);
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center border bg-white text-stone-800 hover:bg-amber-50 hover:border-amber-400 transition-all active:scale-95 shadow-xs cursor-pointer shrink-0"
              style={{ borderColor: "var(--hairline)" }}
            >
              <i className="fa-solid fa-microphone text-amber-600 text-sm" />
            </button>
          )}
        </div>

        {/* Category Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => { setSelectedCat("all"); setDietFilter("all"); }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer transition-all border ${
              selectedCat === "all" && dietFilter === "all"
                ? "bg-linear-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-xs"
                : "bg-white border-stone-200 text-stone-700 hover:border-amber-400 hover:text-amber-800"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => { setDietFilter(dietFilter === "veg" ? "all" : "veg"); setSelectedCat("all"); }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer transition-all border flex items-center gap-1.5 ${
              dietFilter === "veg"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${dietFilter === "veg" ? "bg-white" : "bg-emerald-600"}`} />
            Veg Only
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => { setSelectedCat(cat.id); setDietFilter("all"); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 cursor-pointer transition-all border ${
                selectedCat === cat.id
                  ? "bg-linear-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-xs"
                  : "bg-white border-stone-200 text-stone-700 hover:border-amber-400 hover:text-amber-800"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Dish List */}
      <div className="px-4 space-y-3.5 mt-1">
        {filteredItems.length === 0 ? (
          <div
            className="py-14 text-center rounded-2xl border border-dashed p-6"
            style={{
              borderColor: "var(--hairline)",
              backgroundColor: "var(--paper-dim)",
            }}
          >
            <span className="text-3xl block mb-2">🍽️</span>
            <div
              className="font-heading text-base font-bold"
              style={{ color: "var(--ink)" }}
            >
              No dishes match your filter
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>
              Try clearing filters or search by another keyword.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <TableDishCard
              key={item.id}
              item={item}
              halfQty={cart[`${item.id}__half`]?.qty || 0}
              fullQty={cart[`${item.id}__full`]?.qty || cart[item.id]?.qty || 0}
              showPortions={features.halfFullPortions !== false}
              showDescription={Boolean(features.showDishDescription)}
              onPreviewDish={(dish) => setPreviewDish(dish)}
              onAddToCart={(id, portion, e) => addToCart(id, portion, e)}
              onRemoveFromCart={(id, portion) => removeFromCart(id, portion)}
            />
          ))
        )}
      </div>

      {/* Online Ordering QR & Delivery / Pickup Banner */}
      {Boolean(features.onlineOrdering) && (
        <TableOnlineOrderBanner
          restaurantName={restaurantName}
          slug={restaurantSlug}
          enabled={Boolean(features.onlineOrdering)}
        />
      )}

      {/* Footer Legal & Info (Admin configurable) */}
      {features.showTableFooter === true && (
        <footer className="mt-8 mb-4 px-6 text-center text-xs text-stone-500 space-y-2 border-t pt-6" style={{ borderColor: "var(--hairline)" }}>
          <div className="font-heading font-bold text-stone-700 tracking-wide">
            {restaurantName} • Table {tableNumber}
          </div>
          <p className="text-[11px] text-stone-400">
            Direct kitchen dispatch • Orders routed to floor captain
          </p>
          <div className="flex items-center justify-center gap-4 text-[11px] font-medium text-stone-500 pt-1">
            <a href="/privacy" target="_blank" rel="noreferrer" className="hover:underline hover:text-stone-800 transition-colors">
              Privacy Policy
            </a>
            <span>•</span>
            <a href="/terms" target="_blank" rel="noreferrer" className="hover:underline hover:text-stone-800 transition-colors">
              Terms &amp; Conditions
            </a>
          </div>
        </footer>
      )}

      {/* STICKY BOTTOM FIXED CART BAR */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-3 bg-white/95 backdrop-blur-md border-t shadow-lg" style={{ borderColor: "var(--hairline)" }}>
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-sm font-bold block" style={{ color: "var(--ink)" }}>
                {totalCartCount} {totalCartCount === 1 ? "item" : "items"} · ₹{grandTotal}
              </span>
              <span className="text-[11px] text-stone-500 block">
                Taxes included
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(14);
                setIsReviewOpen(true);
              }}
              className="px-6 py-3 rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-2"
              style={{
                backgroundColor: "var(--rust)",
                color: "var(--rust-text)",
              }}
            >
              <span>Review Order</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Flying Particle Micro-Interaction Overlay */}
      {flyingParticles.map((p) => (
        <div
          key={p.id}
          className="flying-dot flex items-center justify-center w-8 h-8 rounded-full bg-amber-400 text-stone-900 font-black text-sm shadow-2xl border border-stone-900"
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            // @ts-expect-error CSS variable
            "--tx": `${p.tx}px`,
            "--ty": `${p.ty}px`,
          }}
        >
          {p.emoji}
        </div>
      ))}

      {/* MODALS */}
      {/* 1. Advanced Call Waiter Modal */}
      <CallWaiterModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        tableNumber={tableNumber}
        features={features}
        isCallingWaiter={isCallingWaiter}
        waiterCooldown={waiterCooldown}
        customCallNote={customCallNote}
        setCustomCallNote={setCustomCallNote}
        billPaymentMode={billPaymentMode}
        setBillPaymentMode={setBillPaymentMode}
        onCallWaiter={handleCallWaiter}
      />

      {/* 2. UPI Settlement Modal */}
      <TableUpiModal
        isOpen={showUpiQrModal}
        onClose={() => setShowUpiQrModal(false)}
        tableNumber={tableNumber}
        restaurantName={restaurantName}
        payableBillTotal={payableBillTotal}
      />

      {/* 3. Floating Category Quick-Jump Sheet Modal */}
      <TableCategorySheet
        isOpen={isCategorySheetOpen}
        onClose={() => setIsCategorySheetOpen(false)}
        categories={categories}
        items={items}
        selectedCat={selectedCat}
        onSelectCategory={(catId) => setSelectedCat(catId)}
      />

      {/* 4. Cart Review & Bill Split Drawer */}
      <TableCartDrawer
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        tableNumber={tableNumber}
        restaurantName={restaurantName}
        cartEntries={cartEntries}
        items={items}
        features={features}
        upsellConfig={upsellConfig}
        offerConfig={offerConfig}
        upsellCandidates={upsellCandidates}
        subtotalCart={subtotalCart}
        discountAmount={discountAmount}
        cgst={cgst}
        sgst={sgst}
        grandTotal={grandTotal}
        isSubmitting={isSubmitting}
        onAddToCart={(key, e) => addToCart(key, "full", e)}
        onRemoveFromCart={(key) => removeFromCart(key)}
        onPlaceOrder={handlePlaceOrder}
      />

      {/* 5. Dish Zoom & Detailed Nutrition Preview Modal */}
      <DishPreviewModal
        dish={previewDish}
        onClose={() => setPreviewDish(null)}
        features={features}
        cartItem={
          previewDish
            ? cart[`${previewDish.id}__full`] ||
              cart[`${previewDish.id}__half`] ||
              cart[previewDish.id]
            : undefined
        }
        onAddToCart={(id, e) => addToCart(id, "full", e)}
        onRemoveFromCart={(id) => removeFromCart(id, "full")}
      />

      {/* 6. Scratch Card Mystery Reward Modal */}
      <ScratchCardModal
        isOpen={isScratchModalOpen}
        onClose={() => setIsScratchModalOpen(false)}
        data={{
          restaurantName,
          tableNumber,
          rewardTitle:
            offerConfig.bounceBackReward || "Flat ₹100 OFF on your next visit",
          rewardSubtitle: `Valid on orders above ₹${
            offerConfig.minOrderValue || 399
          } on your next visit`,
          voucherCode: `${offerConfig.bounceBackCode || "REPEAT100"}-T${
            tableNumber.replace(/\D/g, "") || "4"
          }`,
          shareUrl: typeof window !== "undefined" ? window.location.href : "",
          validityDays: offerConfig.validityDays || 15,
        }}
      />

      {/* 7. Post-Order Celebratory Dispatch & Live Routing Modal */}
      <TableDispatchModal
        isOpen={showDispatchModal}
        tableNumber={tableNumber}
        onClose={() => setShowDispatchModal(false)}
        onTrackJourney={() => {
          setShowDispatchModal(false);
          if (currentJourneyLayout === "floating_capsule") {
            setIsJourneySheetOpen(true);
          } else {
            const el = document.getElementById("live-order-journey-map");
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }
        }}
      />

      {/* 8. Order History Drawer */}
      <TableOrderHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        token={token}
        tableNumber={tableNumber}
        restaurantName={restaurantName}
      />

      {/* 9. Smart AI Waiter Recommendation Modal */}
      <TableAiWaiterModal
        isOpen={isAiWaiterOpen}
        onClose={() => setIsAiWaiterOpen(false)}
        menuItems={items}
        categories={categories}
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        tableNumber={tableNumber}
        features={features}
        activeOrder={activeOrder}
        cart={cart}
        onAddToCart={(dishId, portion) => addToCart(dishId, portion)}
        onRemoveFromCart={(dishId, portion) => removeFromCart(dishId, portion)}
      />

      {/* 10. Voice Ordering Modal */}
      <TableVoiceOrderModal
        isOpen={isVoiceOrderOpen}
        onClose={() => setIsVoiceOrderOpen(false)}
        menuItems={items}
        onBatchAddToCart={handleBatchAddToCart}
      />

      {/* 11. Welcome Table Scan Offer Popup Modal */}
      <TableOfferPopupModal
        offerConfig={offerConfig}
        restaurantName={restaurantName}
        tableNumber={tableNumber}
      />
    </div>
  );
}
