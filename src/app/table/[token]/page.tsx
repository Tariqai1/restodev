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
import TableDishCard from "@/components/table/TableDishCard";
import CallWaiterModal from "@/components/table/CallWaiterModal";
import TableUpiModal from "@/components/table/TableUpiModal";
import TableCategorySheet from "@/components/table/TableCategorySheet";
import TableCartDrawer from "@/components/table/TableCartDrawer";
import DishPreviewModal from "@/components/table/DishPreviewModal";
import TableDispatchModal from "@/components/table/TableDispatchModal";

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
  const [tableNumber, setTableNumber] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [joinedNotice, setJoinedNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState<RestaurantThemeType>("amber");
  const [branding, setBranding] = useState<RestaurantBrandingConfig>(
    DEFAULT_BRANDING_CONFIG
  );

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
  });

  const [isApprovalPending, setIsApprovalPending] = useState<boolean>(false);

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
  const [quickAddNotice, setQuickAddNotice] = useState<string>("");

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
          return;
        }

        setRestaurantName(data.restaurant?.name || "Order Desk");
        setTableNumber(data.table?.table_number || "T--");
        setCategories(data.categories || []);
        setItems(data.items || []);
        setActiveOrder(data.activeOrder || null);
        if (data.isApprovalPending !== undefined)
          setIsApprovalPending(Boolean(data.isApprovalPending));
        if (data.joinedNotice !== undefined)
          setJoinedNotice(data.joinedNotice);
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
        setTableNumber(data.table?.table_number || "T--");
        setCategories(data.categories || []);
        setItems(data.items || []);
        setActiveOrder(data.activeOrder || null);
        if (data.isApprovalPending !== undefined)
          setIsApprovalPending(Boolean(data.isApprovalPending));
        if (data.joinedNotice !== undefined)
          setJoinedNotice(data.joinedNotice);
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
      setIsCallModalOpen(false);
      setCustomCallNote("");
      setWaiterCooldown(45);

      if (type === "bill" && paymentMode === "upi") {
        setShowUpiQrModal(true);
      }

      setTimeout(() => setWaiterCallSuccess(""), 7000);
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
        setTheme={setTheme}
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
      className="min-h-screen max-w-md mx-auto flex flex-col pb-32"
      style={{ backgroundColor: "var(--paper)", color: "var(--ink)" }}
    >
      {/* Sticky Table Header */}
      <TableHeroBanner
        restaurantName={restaurantName}
        tableNumber={tableNumber}
        branding={branding}
        theme={theme}
        setTheme={setTheme}
        features={features}
        waiterCooldown={waiterCooldown}
        onOpenCallModal={() => setIsCallModalOpen(true)}
        cartCount={totalCartCount}
        onOpenCart={() => {
          triggerHaptic(14);
          setIsReviewOpen(true);
        }}
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
          <div className="flex items-center gap-2">
            <span className="text-lg">🛎️</span>
            <span>{waiterCallSuccess}</span>
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

      {/* Live Order Journey Tracker */}
      {activeOrder && activeOrder.order_items.length > 0 && (
        <TableLiveJourney
          currentJourneyLayout={currentJourneyLayout}
          activeOrder={activeOrder}
          activeStage={activeStage}
          isApprovalPending={isApprovalPending}
          remainingMinutesText={remainingMinutesText}
          tableNumber={tableNumber}
          features={features}
          offerConfig={offerConfig}
          isJourneySheetOpen={isJourneySheetOpen}
          setIsJourneySheetOpen={setIsJourneySheetOpen}
          isTicketExpanded={isTicketExpanded}
          setIsTicketExpanded={setIsTicketExpanded}
          handleReorderItem={handleReorderItem}
          setIsScratchModalOpen={setIsScratchModalOpen}
          setIsCallModalOpen={setIsCallModalOpen}
          onAddFoodClick={() => {
            const el = document.getElementById("menu-catalog-start");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          onCancelItem={handleCancelOrderItem}
          onUpdateItemQty={handleUpdateOrderItemQty}
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

      {/* Dynamic Restaurant Offer & Scratch Reward Ticker (Ultra-Slim & Dismissible) */}
      {features.loyaltyOffers !== false && offerConfig.active && !isOfferDismissed && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 flex items-center justify-between shadow-xs select-none animate-fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0 animate-pulse">🔥</span>
            <div className="min-w-0">
              <span className="text-xs font-black text-amber-950 truncate block">
                {offerConfig.bannerText}
                {subtotalCart > 0 && subtotalCart < offerConfig.minOrderValue ? (
                  <span className="text-[10px] font-medium text-amber-800 ml-1.5">
                    (Add ₹{offerConfig.minOrderValue - subtotalCart} for {offerConfig.discountPercent}% OFF)
                  </span>
                ) : subtotalCart >= offerConfig.minOrderValue ? (
                  <span className="text-[10px] font-bold text-emerald-800 ml-1.5">
                    (🎉 Saved ₹{discountAmount})
                  </span>
                ) : null}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(12);
                setIsScratchModalOpen(true);
              }}
              className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-900 font-extrabold text-[10px] shadow-2xs active:scale-95 transition-transform flex items-center gap-1 cursor-pointer"
            >
              <span>🎁</span>
              <span>Reward</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(6);
                setIsOfferDismissed(true);
              }}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 cursor-pointer transition-colors"
              title="Dismiss offer banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Search Bar with Misspelling Tolerance & Dietary Filter Pills */}
      <div id="menu-catalog-start" className="p-4 pb-2 space-y-2.5">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dishes (e.g. biryani, paneer, naan)..."
            className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 transition-all shadow-inner"
            style={{
              backgroundColor: "var(--paper-dim)",
              borderColor: "var(--hairline)",
              color: "var(--ink)",
            }}
          />
          <span className="absolute left-3 top-3 text-xs text-stone-400">
            <i className="fa-solid fa-magnifying-glass" />
          </span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(6);
                setSearchQuery("");
              }}
              className="absolute right-2.5 top-2.5 text-xs font-bold text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* 5 Fast Dietary & Quick Filter Buttons */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setDietFilter(dietFilter === "veg" ? "all" : "veg");
            }}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-xs shrink-0 ${
              dietFilter === "veg"
                ? "bg-emerald-100 text-emerald-800 border-emerald-500 ring-1 ring-emerald-500"
                : "bg-white text-stone-700 border-stone-200"
            }`}
          >
            <span className="veg-indicator" />
            <span>Veg Only</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setDietFilter(dietFilter === "nonveg" ? "all" : "nonveg");
            }}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-xs shrink-0 ${
              dietFilter === "nonveg"
                ? "bg-red-100 text-red-800 border-red-500 ring-1 ring-red-500"
                : "bg-white text-stone-700 border-stone-200"
            }`}
          >
            <span className="nonveg-indicator" />
            <span>Non-Veg</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setDietFilter(
                dietFilter === "bestseller" ? "all" : "bestseller"
              );
            }}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-xs shrink-0 ${
              dietFilter === "bestseller"
                ? "bg-amber-100 text-amber-900 border-amber-500 ring-1 ring-amber-500"
                : "bg-white text-stone-700 border-stone-200"
            }`}
          >
            <i className="fa-solid fa-star text-amber-500 text-[10px]" />
            <span>Bestsellers</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setDietFilter(dietFilter === "under_199" ? "all" : "under_199");
            }}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-xs shrink-0 ${
              dietFilter === "under_199"
                ? "bg-blue-100 text-blue-900 border-blue-500 ring-1 ring-blue-500"
                : "bg-white text-stone-700 border-stone-200"
            }`}
          >
            <i className="fa-solid fa-tag text-blue-600 text-[10px]" />
            <span>Under ₹199</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setDietFilter(dietFilter === "spicy" ? "all" : "spicy");
            }}
            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-xs shrink-0 ${
              dietFilter === "spicy"
                ? "bg-orange-100 text-orange-950 border-orange-500 ring-1 ring-orange-500"
                : "bg-white text-stone-700 border-stone-200"
            }`}
          >
            <i className="fa-solid fa-pepper-hot text-orange-600 text-[10px]" />
            <span>Spicy</span>
          </button>

          {dietFilter !== "all" && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(6);
                setDietFilter("all");
              }}
              className="px-2 py-1.5 text-[11px] text-stone-400 hover:text-stone-700 cursor-pointer shrink-0"
            >
              Reset
            </button>
          )}
        </div>

        {/* Category Navigation Bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setSelectedCat("all");
            }}
            className="px-3.5 py-2 rounded-xl flex-shrink-0 cursor-pointer transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
            style={{
              backgroundColor:
                selectedCat === "all"
                  ? "var(--dark-surface)"
                  : "var(--paper-dim)",
              color:
                selectedCat === "all"
                  ? theme === "amber"
                    ? "#FFBE0B"
                    : "#FFC6A8"
                  : "var(--ink-soft)",
              border: "1px solid var(--hairline)",
            }}
          >
            <i className="fa-solid fa-layer-group text-xs" />
            <span>All ({items.length})</span>
          </button>

          {categories.map((cat) => {
            const count = items.filter((i) => i.category_id === cat.id).length;
            const isSelected = selectedCat === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  triggerHaptic(8);
                  setSelectedCat(cat.id);
                }}
                className="px-3.5 py-2 rounded-xl flex-shrink-0 cursor-pointer transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
                style={{
                  backgroundColor: isSelected
                    ? "var(--dark-surface)"
                    : "var(--paper-dim)",
                  color: isSelected
                    ? theme === "amber"
                      ? "#FFBE0B"
                      : "#FFC6A8"
                    : "var(--ink-soft)",
                  border: "1px solid var(--hairline)",
                }}
              >
                <span>{cat.name}</span>
                {count > 0 && (
                  <span className="text-[10px] opacity-75 font-mono">
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1-Tap Quick Adds Carousel: Garam Rotis, Cold Drinks, Bestsellers */}
      {features.quickAdds === true &&
        quickReorderCandidates.length > 0 &&
        selectedCat === "all" &&
        !searchQuery && (
          <div className="px-4 mb-2">
            <div className="flex items-center justify-between pb-2">
              <div
                className="flex items-center gap-1.5 text-xs font-extrabold"
                style={{ color: "var(--ink)" }}
              >
                <i className="fa-solid fa-bolt text-amber-500 text-xs" />
                <span>Quick Adds</span>
                <span className="text-[10px] font-normal text-stone-500">
                  (Hot Rotis, Cold Drinks & Extras)
                </span>
              </div>
              {quickAddNotice && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 animate-fade-in">
                  ✓ {quickAddNotice}
                </span>
              )}
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 scrollbar-none">
              {quickReorderCandidates.map((qItem) => {
                const inCartQty =
                  (cart[`${qItem.id}__full`]?.qty || cart[qItem.id]?.qty || 0) +
                  (cart[`${qItem.id}__half`]?.qty || 0);
                const emoji = getFoodEmoji(qItem.name, qItem.is_veg);
                return (
                  <div
                    key={qItem.id}
                    className="flex-shrink-0 w-36 sm:w-40 p-2.5 rounded-2xl border bg-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                    style={{
                      borderColor:
                        inCartQty > 0 ? "var(--rust)" : "var(--hairline)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-2xl">{emoji}</span>
                      <span
                        className={
                          qItem.is_veg ? "veg-indicator" : "nonveg-indicator"
                        }
                      />
                    </div>

                    <div className="my-1">
                      <div
                        onClick={() => setPreviewDish(qItem)}
                        className="font-bold text-xs leading-snug text-stone-900 line-clamp-1 cursor-pointer hover:underline"
                        title={qItem.name}
                      >
                        {qItem.name}
                      </div>
                      <div className="font-receipt text-xs font-black text-stone-800 pt-0.5">
                        ₹{qItem.price}
                      </div>
                    </div>

                    <div className="mt-1">
                      {inCartQty === 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            addToCart(qItem.id, "full", e);
                            setQuickAddNotice(`${qItem.name} added!`);
                            setTimeout(() => setQuickAddNotice(""), 2000);
                          }}
                          className="w-full py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
                          style={{
                            backgroundColor: "var(--rust)",
                            color: "var(--rust-text)",
                          }}
                        >
                          <span>+ ADD</span>
                        </button>
                      ) : (
                        <div
                          className="h-7 flex items-center justify-between rounded-xl border shadow-xs overflow-hidden bg-white"
                          style={{ borderColor: "var(--rust)" }}
                        >
                          <button
                            type="button"
                            onClick={() => removeFromCart(qItem.id, "full")}
                            className="w-7 h-full flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-stone-100"
                            style={{ color: "var(--rust)" }}
                          >
                            -
                          </button>
                          <span
                            className="font-receipt text-xs font-black px-1 text-center"
                            style={{ color: "var(--ink)" }}
                          >
                            {inCartQty}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => addToCart(qItem.id, "full", e)}
                            className="w-7 h-full flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-stone-100"
                            style={{ color: "var(--rust)" }}
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
          </div>
        )}

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
              onPreviewDish={(dish) => setPreviewDish(dish)}
              onAddToCart={(id, portion, e) => addToCart(id, portion, e)}
              onRemoveFromCart={(id, portion) => removeFromCart(id, portion)}
            />
          ))
        )}
      </div>

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

      {/* STICKY BOTTOM FLOATING CART BAR */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(14);
                setIsReviewOpen(true);
              }}
              className={`w-full h-14 px-5 rounded-2xl flex items-center justify-between shadow-2xl active:scale-[0.99] transition-all cursor-pointer border backdrop-blur ${
                isCartBouncing ? "cart-bounce" : ""
              }`}
              style={{
                backgroundColor: "var(--dark-surface)",
                borderColor: "var(--hairline)",
                color: "#FFFFFF",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shadow-sm"
                  style={{
                    backgroundColor: "var(--rust)",
                    color: "var(--rust-text)",
                  }}
                >
                  {totalCartCount}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold leading-tight">
                    Review Table Ticket
                  </div>
                  <div className="text-[11px] opacity-90 font-receipt flex items-center gap-1.5">
                    <span>₹{grandTotal} incl. GST</span>
                    {discountAmount > 0 && (
                      <span className="text-emerald-300 font-extrabold text-[10px]">
                        (Saved ₹{discountAmount}!)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-sm"
                style={{
                  backgroundColor: "var(--rust)",
                  color: "var(--rust-text)",
                }}
              >
                <span>View Cart</span>
                <span>→</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Floating Order Journey Capsule (Zomato / Swiggy Mode) */}
      {activeOrder &&
        activeOrder.order_items.length > 0 &&
        currentJourneyLayout === "floating_capsule" &&
        !isJourneySheetOpen &&
        !isReviewOpen &&
        !isCallModalOpen && (
          <div
            className={`fixed left-4 right-4 z-45 max-w-md mx-auto pointer-events-none transition-all duration-300 ${
              totalCartCount > 0 ? "bottom-20" : "bottom-4"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic(12);
                setIsJourneySheetOpen(true);
              }}
              className="w-full p-2.5 sm:p-3 rounded-2xl shadow-2xl flex items-center justify-between cursor-pointer pointer-events-auto border backdrop-blur-md transition-all active:scale-[0.98]"
              style={{
                backgroundColor: "rgba(24, 20, 16, 0.95)",
                borderColor: isApprovalPending
                  ? "rgba(245, 158, 11, 0.5)"
                  : activeStage === "preparing"
                  ? "rgba(59, 130, 246, 0.5)"
                  : activeStage === "served"
                  ? "rgba(16, 185, 129, 0.5)"
                  : "rgba(217, 107, 39, 0.5)",
                color: "#FFFFFF",
                boxShadow: "0 10px 30px -4px rgba(0, 0, 0, 0.5)",
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 shadow-xs"
                  style={{
                    backgroundColor: isApprovalPending
                      ? "rgba(245, 158, 11, 0.2)"
                      : activeStage === "preparing"
                      ? "rgba(59, 130, 246, 0.2)"
                      : activeStage === "served"
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(217, 107, 39, 0.2)",
                    border: "1px solid",
                    borderColor: isApprovalPending
                      ? "rgba(245, 158, 11, 0.4)"
                      : activeStage === "preparing"
                      ? "rgba(59, 130, 246, 0.4)"
                      : activeStage === "served"
                      ? "rgba(16, 185, 129, 0.4)"
                      : "rgba(217, 107, 39, 0.4)",
                  }}
                >
                  {activeStage === "served"
                    ? "🍽️"
                    : activeStage === "preparing"
                    ? "🔥"
                    : isApprovalPending
                    ? "👨‍💼"
                    : "📱"}
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-xs font-black tracking-wide flex items-center gap-1.5 text-stone-100">
                    <span className="truncate">
                      {isApprovalPending
                        ? "Captain Verifying Order"
                        : activeStage === "preparing"
                        ? "Chef Cooking in Kitchen"
                        : activeStage === "served"
                        ? "Dishes Served at Table"
                        : "Order Registered"}
                    </span>
                    {activeStage === "preparing" && remainingMinutesText && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-900/60 text-blue-200 border border-blue-500/40 font-bold shrink-0">
                        ⏳ {remainingMinutesText}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-400 truncate">
                    Table {tableNumber} • {activeOrder.order_items.length} items
                    (₹
                    {activeOrder.order_items.reduce(
                      (s, it) => s + Number(it.unit_price) * Number(it.qty),
                      0
                    )}
                    )
                  </div>
                </div>
              </div>

              <div
                className="flex items-center gap-1 shrink-0 text-[11px] font-black px-3 py-1.5 rounded-xl shadow-xs"
                style={{
                  backgroundColor: isApprovalPending
                    ? "#D97706"
                    : activeStage === "preparing"
                    ? "#2563EB"
                    : activeStage === "served"
                    ? "#059669"
                    : "#D96B27",
                  color: "#FFFFFF",
                }}
              >
                <span>{isApprovalPending ? "Edit / Track" : "Track"}</span>
                <span className="text-xs">▴</span>
              </div>
            </button>
          </div>
        )}

      {/* Floating Category Jump Button (Swiggy / Zomato style) */}
      {!isReviewOpen && !isCallModalOpen && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic(12);
            setIsCategorySheetOpen(true);
          }}
          className={`fixed z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-xl shadow-xl active:scale-95 transition-all cursor-pointer border backdrop-blur ${
            activeOrder &&
            activeOrder.order_items.length > 0 &&
            currentJourneyLayout === "floating_capsule" &&
            !isJourneySheetOpen
              ? totalCartCount > 0
                ? "bottom-40 left-4"
                : "bottom-24 left-4"
              : totalCartCount > 0
              ? "bottom-20 left-4"
              : "bottom-5 left-4"
          }`}
          style={{
            backgroundColor: "rgba(31, 41, 55, 0.95)",
            color: "#F9FAFB",
            borderColor: "rgba(255, 190, 11, 0.4)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
          }}
        >
          <i className="fa-solid fa-book-open text-xs text-amber-400" />
          <span className="text-xs font-bold tracking-wide">Menu</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-amber-400 text-stone-900 font-extrabold">
            {categories.length}
          </span>
        </button>
      )}

      {/* Floating Call Staff Buzzer Button */}
      {features.callWaiter && !isReviewOpen && !isCallModalOpen && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic(15);
            setIsCallModalOpen(true);
          }}
          className={`fixed z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-xl shadow-xl active:scale-95 transition-all cursor-pointer border ${
            activeOrder &&
            activeOrder.order_items.length > 0 &&
            currentJourneyLayout === "floating_capsule" &&
            !isJourneySheetOpen
              ? totalCartCount > 0
                ? "bottom-40 right-4"
                : "bottom-24 right-4"
              : totalCartCount > 0
              ? "bottom-20 right-4"
              : "bottom-5 right-4"
          }`}
          style={{
            backgroundColor: "#1F2937",
            color: "#F9FAFB",
            borderColor: "rgba(255,255,255,0.2)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
          }}
        >
          <i className="fa-solid fa-bell text-amber-400 text-xs" />
          <span className="text-xs font-bold tracking-wide">
            {waiterCooldown > 0 ? `Wait ${waiterCooldown}s` : "Call Waiter"}
          </span>
        </button>
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
    </div>
  );
}
