"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

type KitchenOrderItem = {
  id: string;
  menu_item_id: string;
  customer_name: string | null;
  qty: number;
  notes: string | null;
  item_status: "pending" | "preparing" | "served";
  created_at: string;
  menu_items?: {
    name: string;
    is_veg: boolean;
  };
};

type KitchenOrder = {
  id: string;
  table_id: string | null;
  status: string;
  opened_at: string;
  order_type?: "dine_in" | "delivery" | "pickup";
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  scheduled_for?: string | null;
  restaurant_tables?: {
    table_number: string;
  };
  order_items: KitchenOrderItem[];
  prepEstimate?: {
    orderId: string;
    minutes: number;
    setAt: string;
    setBy: string;
  } | null;
};

type TodayStats = {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  dishesCooked: number;
};

type DayWiseStat = {
  date: string;
  label: string;
  totalOrders: number;
  completedOrders: number;
  totalDishes: number;
};

export default function KitchenDisplayPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [todayStats, setTodayStats] = useState<TodayStats>({
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    dishesCooked: 0,
  });
  const [dayWiseStats, setDayWiseStats] = useState<DayWiseStat[]>([]);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [highlightDish, setHighlightDish] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "dine_in" | "delivery" | "pickup">("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string } | null>(null);
  const previousOrderCountRef = useRef(0);
  const kitchenRequestInFlightRef = useRef(false);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  // Audio unlock helper for iOS Safari / Mobile
  const unlockAudioContext = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (audioCtx.state === "suspended") {
        audioCtx
          .resume()
          .then(() => setIsAudioUnlocked(true))
          .catch(() => setIsAudioUnlocked(true));
      } else {
        setIsAudioUnlocked(true);
      }
    } catch {
      setIsAudioUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleFirstGesture = () => {
      unlockAudioContext();
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
    };
    window.addEventListener("click", handleFirstGesture);
    window.addEventListener("touchstart", handleFirstGesture);
    return () => {
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
    };
  }, [unlockAudioContext]);

  // Audio Synthesizer: Chime on New Incoming Order
  const playChime = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // C6
      osc.frequency.exponentialRampToValueAtTime(1318.5, audioCtx.currentTime + 0.08); // E6

      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.65);
    } catch {
      // Audio context might be restricted
    }
  }, [soundEnabled]);

  // Success Chime: Upbeat Chord when Dish/Ticket is Ready
  const playSuccessChime = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.18, audioCtx.currentTime + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.06 + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + idx * 0.06);
        osc.stop(audioCtx.currentTime + idx * 0.06 + 0.38);
      });
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  // Cook Action Click Chime
  const playCookChime = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  const fetchKitchenTickets = useCallback(
    async (isInitial = false) => {
      if (kitchenRequestInFlightRef.current) return;
      kitchenRequestInFlightRef.current = true;
      try {
        const res = await fetch("/api/kitchen");
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch kitchen orders");

        const fetchedOrders: KitchenOrder[] = data.orders || [];
        fetchedOrders.sort(
          (a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()
        );

        if (!isInitial && fetchedOrders.length > previousOrderCountRef.current) {
          playChime();
        }
        previousOrderCountRef.current = fetchedOrders.length;
        setOrders(fetchedOrders);

        if (data.todayStats) {
          setTodayStats(data.todayStats);
        }
        if (data.dayWiseStats) {
          setDayWiseStats(data.dayWiseStats);
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Error loading tickets");
      } finally {
        kitchenRequestInFlightRef.current = false;
        setIsLoading(false);
      }
    },
    [playChime]
  );

  useEffect(() => {
    fetchKitchenTickets(true);
    const interval = setInterval(() => {
      fetchKitchenTickets(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchKitchenTickets]);

  // Realtime live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active staff identity
  useEffect(() => {
    async function loadIdentity() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCurrentUser({
              name: data.user.name || data.user.email || "Chef Station",
              role: data.user.role || "kitchen",
            });
          }
        }
      } catch {
        // ignore
      }
    }
    loadIdentity();
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  }

  // Set manual cooking duration target
  async function handleSetPrepTime(orderId: string, minutes: number) {
    try {
      const res = await fetch("/api/orders/prep-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, prepMinutes: minutes, setBy: currentUser?.name || "kitchen" }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  prepEstimate: {
                    orderId,
                    minutes,
                    setAt: new Date().toISOString(),
                    setBy: currentUser?.name || "kitchen",
                  },
                }
              : o
          )
        );
      }
    } catch {
      // ignore
    }
  }

  // Bump individual dish status
  async function bumpItem(itemId: string, currentStatus: "pending" | "preparing" | "served") {
    const nextStatus = currentStatus === "pending" ? "preparing" : "served";
    if (nextStatus === "preparing") {
      playCookChime();
    } else {
      playSuccessChime();
    }

    setOrders((prev) =>
      prev.map((ord) => ({
        ...ord,
        order_items: ord.order_items.map((it) =>
          it.id === itemId ? { ...it, item_status: nextStatus } : it
        ),
      }))
    );

    try {
      const res = await fetch("/api/kitchen", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, nextStatus }),
      });
      if (!res.ok) throw new Error("Status update failed");
    } catch {
      fetchKitchenTickets();
    }
  }

  // Bump entire ticket
  async function bumpOrder(orderId: string, markAllStatus: "preparing" | "served") {
    if (markAllStatus === "served") {
      playSuccessChime();
    } else {
      playCookChime();
    }

    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId
          ? {
              ...ord,
              order_items: ord.order_items.map((it) => ({
                ...it,
                item_status: markAllStatus,
              })),
            }
          : ord
      )
    );

    try {
      const res = await fetch("/api/kitchen", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, markAllStatus }),
      });
      if (!res.ok) throw new Error("Order bump failed");
    } catch {
      fetchKitchenTickets();
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function getElapsedMinutes(openedAt: string): number {
    const diff = currentTime - new Date(openedAt).getTime();
    return Math.max(0, Math.floor(diff / 60000));
  }

  // Filter orders based on status tab and search query
  const activeOrders = orders.filter((ord) => {
    const unservedItems = ord.order_items.filter((it) => it.item_status !== "served");
    if (unservedItems.length === 0) return false;

    // Order Type Filter
    const ordType = ord.order_type || (ord.table_id ? "dine_in" : "pickup");
    if (filter === "dine_in" && ordType !== "dine_in") return false;
    if (filter === "delivery" && ordType !== "delivery") return false;
    if (filter === "pickup" && ordType !== "pickup") return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const tableMatch = (ord.restaurant_tables?.table_number || "").toLowerCase().includes(q);
      const nameMatch = (ord.customer_name || "").toLowerCase().includes(q);
      const phoneMatch = (ord.customer_phone || "").toLowerCase().includes(q);
      const addressMatch = (ord.delivery_address || "").toLowerCase().includes(q);
      const itemMatch = ord.order_items.some((it) =>
        (it.menu_items?.name || "").toLowerCase().includes(q)
      );
      if (!tableMatch && !nameMatch && !phoneMatch && !addressMatch && !itemMatch) return false;
    }

    return true;
  });

  // Calculate Consolidated Pending Dishes (Batch Cooking Aggregator)
  const pendingDishMap: { [name: string]: { count: number; isVeg: boolean; tables: string[] } } =
    {};
  activeOrders.forEach((order) => {
    const ordType = order.order_type || (order.table_id ? "dine_in" : "pickup");
    const tableNum =
      ordType === "dine_in"
        ? order.restaurant_tables?.table_number
          ? `T${order.restaurant_tables.table_number}`
          : "Dine-In"
        : ordType === "delivery"
        ? "Delivery"
        : "Pickup";
    order.order_items.forEach((item) => {
      if (item.item_status !== "served") {
        const name = item.menu_items?.name || "Dish";
        const isVeg = !!item.menu_items?.is_veg;
        if (!pendingDishMap[name]) {
          pendingDishMap[name] = { count: 0, isVeg, tables: [] };
        }
        pendingDishMap[name].count += item.qty;
        if (!pendingDishMap[name].tables.includes(tableNum)) {
          pendingDishMap[name].tables.push(tableNum);
        }
      }
    });
  });
  const consolidatedDishes = Object.entries(pendingDishMap).sort(
    (a, b) => b[1].count - a[1].count
  );

  const isKitchenRole = currentUser?.role === "kitchen";

  return (
    <div className="min-h-screen flex flex-col select-none bg-slate-950 text-slate-100 font-sans antialiased w-full max-w-full overflow-x-hidden">
      {/* 1. Sleek, Minimal Unified Header */}
      <header className="h-14 px-4 sm:px-6 bg-slate-900/95 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between gap-3 sticky top-0 z-30 shadow-md">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3">
          {!isKitchenRole && (
            <Link
              href="/"
              className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 border border-slate-700/60"
              title="Return to Admin"
            >
              <i className="fa-solid fa-arrow-left text-[11px]" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="font-bold text-sm sm:text-base text-white tracking-tight">
                Kitchen Display
              </h1>
            </div>

            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-purple-950/70 border border-purple-500/30 text-purple-300 font-bold">
              {activeOrders.length} {activeOrders.length === 1 ? "ticket" : "tickets"}
            </span>
          </div>
        </div>

        {/* Center: Clean Segmented View Filter */}
        <div className="hidden sm:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              filter === "all"
                ? "bg-slate-800 text-white font-bold shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("dine_in")}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              filter === "dine_in"
                ? "bg-purple-600 text-white font-bold shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <i className="fa-solid fa-utensils text-[10px]" />
            <span>Dine-In</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("delivery")}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              filter === "delivery"
                ? "bg-amber-600 text-white font-bold shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <i className="fa-solid fa-motorcycle text-[10px]" />
            <span>Delivery</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("pickup")}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              filter === "pickup"
                ? "bg-blue-600 text-white font-bold shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <i className="fa-solid fa-bag-shopping text-[10px]" />
            <span>Pickup</span>
          </button>
        </div>

        {/* Right: Search, Sound, Stats Modal, Fullscreen & Exit */}
        <div className="flex items-center gap-2">
          {/* Compact Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table/dish..."
              className="h-8 px-2.5 pl-7 rounded-lg text-xs bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-28 sm:w-40 transition-all"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-2 top-2.5 text-slate-500 text-[11px]" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          {/* Sound Toggle Icon */}
          <button
            type="button"
            onClick={() => {
              unlockAudioContext();
              setSoundEnabled(!soundEnabled);
            }}
            className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer ${
              soundEnabled
                ? "bg-slate-800/80 border-slate-700 text-emerald-400"
                : "bg-slate-900 border-slate-800 text-slate-500"
            }`}
            title={soundEnabled ? "Chime enabled (click to mute)" : "Muted (click to enable)"}
          >
            <i className={`fa-solid ${soundEnabled ? "fa-bell" : "fa-bell-slash"} text-xs`} />
            <span className="hidden md:inline text-[11px]">
              {soundEnabled ? "Sound" : "Mute"}
            </span>
          </button>

          {/* Shift Stats Popover Trigger */}
          <button
            type="button"
            onClick={() => setIsStatsModalOpen(true)}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="View today's shift velocity and 7-day analytics"
          >
            <i className="fa-solid fa-chart-simple text-purple-400 text-xs" />
            <span className="hidden lg:inline text-[11px]">Shift Stats</span>
            <span className="text-[10px] bg-slate-950 px-1.5 py-0.2 rounded font-mono font-bold text-slate-300">
              {todayStats.completedOrders}
            </span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="h-8 w-8 rounded-lg text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 border border-slate-700/60 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
            title="Toggle Fullscreen TV Mode"
          >
            <i className={`fa-solid ${isFullscreen ? "fa-compress" : "fa-expand"} text-xs`} />
          </button>

          {/* Exit / Sign Out */}
          <button
            type="button"
            onClick={handleSignOut}
            className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-400 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 transition-colors flex items-center justify-center cursor-pointer"
            title="Exit / Logout"
          >
            <i className="fa-solid fa-arrow-right-from-bracket text-xs" />
          </button>
        </div>
      </header>

      {/* Audio permission banner if audio not yet activated */}
      {soundEnabled && !isAudioUnlocked && (
        <div
          onClick={unlockAudioContext}
          className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-300 flex items-center justify-center gap-2 cursor-pointer hover:bg-amber-500/20 transition-colors"
        >
          <i className="fa-solid fa-volume-high text-xs" />
          <span>Tap anywhere on the screen to enable audio chimes for new orders</span>
        </div>
      )}

      {/* Consolidated Batch Cooking Ribbon (Only shown if duplicate dishes exist across tables) */}
      {consolidatedDishes.length > 0 && (
        <div className="px-4 sm:px-6 py-2 bg-slate-900/60 border-b border-slate-800/60 flex items-center gap-2.5 overflow-x-auto text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 shrink-0 flex items-center gap-1">
            <i className="fa-solid fa-fire text-amber-500" />
            <span>Batch Prep:</span>
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {consolidatedDishes.map(([name, data]) => {
              const isSelected = highlightDish === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setHighlightDish(isSelected ? null : name)}
                  className={`h-7 px-2.5 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? "bg-purple-600 text-white border-purple-400 shadow-sm"
                      : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      data.isVeg ? "bg-emerald-400" : "bg-rose-400"
                    }`}
                  />
                  <span className="font-mono text-purple-300 font-bold">{data.count}×</span>
                  <span className="truncate max-w-[140px]">{name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    [{data.tables.join(",")}]
                  </span>
                </button>
              );
            })}

            {highlightDish && (
              <button
                type="button"
                onClick={() => setHighlightDish(null)}
                className="h-7 px-2 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800 border border-slate-700 shrink-0 cursor-pointer flex items-center gap-1"
              >
                <i className="fa-solid fa-xmark text-[10px]" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Order Rail Content */}
      <main className="flex-1 p-4 sm:p-6 overflow-x-auto">
        {isLoading && (
          <div className="py-24 text-center text-xs font-medium text-slate-400 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            <span>Connecting to live kitchen feed...</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl text-xs font-medium bg-rose-950/60 text-rose-200 border border-rose-800/80 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 2. Premium, Minimalist Clean Empty State ("Kitchen Rail Clear") */}
        {!isLoading && activeOrders.length === 0 && (
          <div className="py-16 sm:py-24 flex flex-col items-center justify-center max-w-lg mx-auto text-center animate-in fade-in duration-300">
            {/* Ambient Glowing Beacon */}
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl" />
              <div className="relative w-20 h-20 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl shadow-xl">
                <i className="fa-solid fa-check" />
              </div>
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight">
              All Caught Up · Rail Clear
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-sm leading-relaxed">
              All tickets have been cooked and served. Standing by for incoming table orders.
            </p>

            {/* Quick Shift Summary Cards */}
            <div className="mt-8 grid grid-cols-3 gap-3 w-full max-w-md">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">
                  Today Total
                </span>
                <span className="text-xl font-black text-slate-200 font-mono mt-0.5 block">
                  {todayStats.totalOrders}
                </span>
                <span className="text-[10px] text-slate-500">Orders Placed</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">
                  Dispatched
                </span>
                <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">
                  {todayStats.completedOrders}
                </span>
                <span className="text-[10px] text-slate-500">Served to Tables</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center shadow-xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">
                  Dishes Cooked
                </span>
                <span className="text-xl font-black text-blue-400 font-mono mt-0.5 block">
                  {todayStats.dishesCooked}
                </span>
                <span className="text-[10px] text-slate-500">Items Prepared</span>
              </div>
            </div>

            {/* Live Indicator */}
            <div className="mt-6 flex items-center gap-2 text-[11px] font-mono text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Real-time sync active (5s) · Sound chime ready</span>
            </div>
          </div>
        )}

        {/* 3. High-Contrast, Big-Format Order Ticket Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {activeOrders.map((order) => {
            const elapsed = getElapsedMinutes(order.opened_at);
            const isCritical = elapsed >= 20; // 20+ min overdue
            const isLate = elapsed >= 10 && !isCritical;
            const isAllPreparing = order.order_items.every((it) => it.item_status === "preparing");

            const containsHighlightedDish =
              highlightDish &&
              order.order_items.some(
                (it) => it.menu_items?.name === highlightDish && it.item_status !== "served"
              );

            const readyCount = order.order_items.filter(
              (it) => it.item_status === "served"
            ).length;
            const totalCount = order.order_items.length;
            const isFullyReady = readyCount === totalCount && totalCount > 0;

            const cardBorder = isCritical
              ? "border-rose-500 ring-2 ring-rose-500/30 shadow-lg shadow-rose-950/30"
              : isLate
              ? "border-amber-500/80 shadow-md"
              : "border-slate-800";

            return (
              <div
                key={order.id}
                className={`rounded-2xl flex flex-col justify-between shadow-xl overflow-hidden transition-all duration-200 border bg-slate-900 ${cardBorder} ${
                  containsHighlightedDish
                    ? "ring-4 ring-purple-400 scale-[1.02] shadow-purple-500/20"
                    : highlightDish
                    ? "opacity-40"
                    : ""
                }`}
              >
                <div>
                  {/* Top Critical Packaging Banner for Delivery & Takeaway */}
                  {order.order_type === "delivery" && (
                    <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white font-black text-[11px] px-3 py-1.5 flex items-center justify-between tracking-wide uppercase shadow-sm">
                      <span className="flex items-center gap-1.5 animate-pulse">
                        <i className="fa-solid fa-box-open text-xs" />
                        <span>⚠️ DELIVERY — PACK IN CONTAINER (DO NOT PLATE)</span>
                      </span>
                      <span className="text-[9px] font-mono bg-black/40 px-1.5 py-0.5 rounded font-bold">PARCEL</span>
                    </div>
                  )}
                  {order.order_type === "pickup" && (
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[11px] px-3 py-1.5 flex items-center justify-between tracking-wide uppercase shadow-sm">
                      <span className="flex items-center gap-1.5">
                        <i className="fa-solid fa-bag-shopping text-xs" />
                        <span>🛍️ TAKEAWAY / PICKUP — PACK IN PARCEL BAG</span>
                      </span>
                      <span className="text-[9px] font-mono bg-black/40 px-1.5 py-0.5 rounded font-bold">PICKUP</span>
                    </div>
                  )}

                  {/* Ticket Header: Table + Time Elapsed */}
                  <div className="p-3.5 border-b border-slate-800 bg-slate-950/70 flex items-start justify-between">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono uppercase font-bold text-slate-400">
                          #{order.id.slice(-4).toUpperCase()}
                        </span>

                        {/* Order Type Badge */}
                        {order.order_type === "delivery" ? (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <i className="fa-solid fa-motorcycle text-[9px]" />
                            <span>Delivery</span>
                          </span>
                        ) : order.order_type === "pickup" ? (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                            <i className="fa-solid fa-bag-shopping text-[9px]" />
                            <span>Pickup</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                            <i className="fa-solid fa-utensils text-[9px]" />
                            <span>Dine-In</span>
                          </span>
                        )}

                        {isFullyReady ? (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            ✓ Ready
                          </span>
                        ) : readyCount > 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {readyCount}/{totalCount} Ready
                          </span>
                        ) : null}
                      </div>

                      {order.order_type === "delivery" || order.order_type === "pickup" ? (
                        <div>
                          <strong className="text-xl font-black tracking-tight text-white block truncate">
                            {order.customer_name || (order.order_type === "delivery" ? "Delivery Customer" : "Pickup Customer")}
                          </strong>
                          {order.customer_phone && (
                            <span className="text-xs font-mono text-purple-300 block font-semibold mt-0.5">
                              📞 {order.customer_phone}
                            </span>
                          )}
                        </div>
                      ) : (
                        <strong className="text-2xl font-black tracking-tight text-white block">
                          Table {order.restaurant_tables?.table_number || "T--"}
                        </strong>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-lg border font-mono font-bold inline-block ${
                          isCritical
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse"
                            : isLate
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {elapsed}m
                      </span>
                      <span className="text-[10px] uppercase font-bold block mt-1 text-slate-400">
                        {isCritical ? "Overdue" : isLate ? "Delayed" : "Normal"}
                      </span>
                    </div>
                  </div>

                  {/* Delivery Address Banner */}
                  {order.order_type === "delivery" && order.delivery_address && (
                    <div className="px-3.5 py-1.5 bg-amber-950/40 border-b border-amber-600/30 text-[11px] text-amber-200 flex items-start gap-1.5">
                      <i className="fa-solid fa-location-dot text-amber-400 mt-0.5 shrink-0 text-[10px]" />
                      <span className="line-clamp-2 leading-tight">{order.delivery_address}</span>
                    </div>
                  )}

                  {/* Cooking Target Pill Strip */}
                  <div className="px-3.5 py-1.5 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 font-medium">
                      Target:{" "}
                      {order.prepEstimate ? (
                        <strong className="text-purple-300 font-mono">
                          {order.prepEstimate.minutes}m
                        </strong>
                      ) : (
                        <span className="text-slate-500">Auto</span>
                      )}
                    </span>

                    <div className="flex items-center gap-1">
                      {[10, 15, 20].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => handleSetPrepTime(order.id, mins)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                            order.prepEstimate?.minutes === mins
                              ? "bg-purple-600 text-white"
                              : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dishes Item List */}
                  <div className="p-3 space-y-2 text-xs">
                    {order.order_items.map((item) => {
                      const isItemServed = item.item_status === "served";
                      const isItemCooking = item.item_status === "preparing";
                      const isItemHighlighted = highlightDish === item.menu_items?.name;

                      return (
                        <div
                          key={item.id}
                          className={`p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all border ${
                            isItemHighlighted
                              ? "ring-2 ring-purple-400 bg-purple-950/60 border-purple-500"
                              : isItemServed
                              ? "bg-slate-950/30 border-slate-800/50 opacity-50"
                              : isItemCooking
                              ? "bg-amber-950/30 border-amber-500/40 shadow-xs"
                              : "bg-slate-950 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                item.menu_items?.is_veg ? "bg-emerald-400" : "bg-rose-400"
                              }`}
                            />
                            <div className="min-w-0">
                              <div
                                className={`font-bold text-sm truncate ${
                                  isItemServed ? "line-through text-slate-500" : "text-white"
                                }`}
                              >
                                <span className="text-purple-400 font-mono font-black mr-1.5">
                                  {item.qty}×
                                </span>
                                {item.menu_items?.name || "Dish"}
                              </div>
                              {item.notes && (
                                <div className="text-[10px] font-bold mt-0.5 text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-600/40 inline-flex items-center gap-1">
                                  <i className="fa-solid fa-circle-exclamation text-[9px]" />
                                  <span>{item.notes}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Bump Action */}
                          <div className="shrink-0 flex items-center">
                            {item.item_status === "pending" && (
                              <button
                                type="button"
                                onClick={() => bumpItem(item.id, "pending")}
                                className="h-7 px-3 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <i className="fa-solid fa-fire text-[10px]" />
                                <span>Cook</span>
                              </button>
                            )}

                            {item.item_status === "preparing" && (
                              <button
                                type="button"
                                onClick={() => bumpItem(item.id, "preparing")}
                                className="h-7 px-3 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <i className="fa-solid fa-check text-[10px]" />
                                <span>Ready</span>
                              </button>
                            )}

                            {item.item_status === "served" && (
                              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                <i className="fa-solid fa-check" />
                                <span>Done</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Direct Action Bottom Bar */}
                <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
                  {!isAllPreparing && (
                    <button
                      type="button"
                      onClick={() => bumpOrder(order.id, "preparing")}
                      className="flex-1 h-9 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <i className="fa-solid fa-fire text-xs" />
                      <span>Start All</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => bumpOrder(order.id, "served")}
                    className="flex-1 h-9 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <i className="fa-solid fa-check-double text-xs" />
                    <span>
                      {order.order_type === "delivery"
                        ? "Packed for Rider"
                        : order.order_type === "pickup"
                        ? "Ready at Counter"
                        : "Complete Order"}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 4. Shift & 7-Day Velocity Report Modal (Keeps main screen 100% clean) */}
      {isStatsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl p-6 space-y-5 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
                  <i className="fa-solid fa-chart-line text-sm" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Shift Velocity &amp; Analytics
                  </h3>
                  <p className="text-xs text-slate-400">
                    Order volume &amp; dish preparation performance
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsStatsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Today Quick Stats */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono">
                  Orders
                </span>
                <span className="text-xl font-black text-purple-400 font-mono mt-0.5 block">
                  {todayStats.totalOrders}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono">
                  Active
                </span>
                <span className="text-xl font-black text-blue-400 font-mono mt-0.5 block">
                  {activeOrders.length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono">
                  Served
                </span>
                <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">
                  {todayStats.completedOrders}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 block font-mono">
                  Dishes
                </span>
                <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">
                  {todayStats.dishesCooked}
                </span>
              </div>
            </div>

            {/* 7-Day Velocity History */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Last 7 Days Breakdown
              </h4>
              {dayWiseStats.map((item) => {
                const completionRate =
                  item.totalOrders > 0
                    ? Math.round((item.completedOrders / item.totalOrders) * 100)
                    : 0;

                return (
                  <div
                    key={item.date}
                    className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="font-bold text-white">{item.label}</strong>
                        <span className="text-[10px] text-slate-500 font-mono">({item.date})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                        <span>Cooked: <strong className="text-slate-200">{item.totalDishes}</strong> dishes</span>
                        <span>•</span>
                        <span>Served: <strong className="text-emerald-400">{item.completedOrders}</strong> / {item.totalOrders}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-purple-400 font-mono text-sm">
                        {item.totalOrders} Orders
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {completionRate}% Dispatched
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Close Button */}
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsStatsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
